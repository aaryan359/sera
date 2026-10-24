import assert from "node:assert/strict";
import { test } from "node:test";
import { reconcileApproval, requestApproval, runApproved } from "../safety.ts";
import { callTool, registry } from "../index.ts";
import { ToolError, type Context } from "../safety.ts";
import { createGmailApi, emailsIn, type GmailApi, type Thread, type ThreadSummary } from "./client/api.ts";
import { buildReply } from "./client/mime.ts";
import { expectError, makeContext, unusedCalendar } from "../test-kit.ts";

// ---------- a fake Gmail ----------

class FakeGmail implements GmailApi {
  threads = new Map<string, Thread>();
  sent: { threadId: string; messageId: string; marker: string; raw: string }[] = [];
  failAfterWrite = false; // the send happens, but the caller gets a timeout
  private counter = 0;

  async searchThreads(_query: string, max: number): Promise<ThreadSummary[]> {
    return [...this.threads.values()].slice(0, max).map((t) => {
      const last = t.messages.at(-1)!;
      return { threadId: t.threadId, subject: last.subject, from: last.from, date: last.date, snippet: t.snippet };
    });
  }

  async getThread(threadId: string): Promise<Thread> {
    const thread = this.threads.get(threadId);
    if (!thread) throw new ToolError("NOT_FOUND", "no such thread");
    return structuredClone(thread);
  }

  async sendRaw(raw: string, threadId: string) {
    const text = Buffer.from(raw, "base64url").toString("utf8");
    const marker = text.match(/^Message-ID: <(.+)>$/m)?.[1] ?? "";
    const messageId = `sent${++this.counter}`;
    this.sent.push({ threadId, messageId, marker, raw });
    this.threads.get(threadId)!.messages.push({
      messageId,
      rfcMessageId: `<${marker}>`,
      from: "Me <me@example.com>",
      to: "maya@example.com",
      cc: "",
      participants: ["me@example.com", "maya@example.com"],
      date: new Date().toISOString(),
      subject: "Re: Meeting next week",
      body: "sent",
      bodyTruncated: false,
    });
    if (this.failAfterWrite) {
      this.failAfterWrite = false;
      throw new ToolError("PROVIDER_ERROR", "timed out", true);
    }
    return { messageId, threadId };
  }

  async findSentMessage(marker: string) {
    const hit = this.sent.find((s) => s.marker === marker);
    return hit ? { messageId: hit.messageId, threadId: hit.threadId } : null;
  }
}

function world() {
  const gmail = new FakeGmail();
  gmail.threads.set("t1", {
    threadId: "t1",
    snippet: "Can we meet next week?",
    messages: [
      {
        messageId: "m1",
        rfcMessageId: "<orig@maya.example>",
        from: "Maya <maya@example.com>",
        to: "me@example.com",
        cc: "",
        participants: ["maya@example.com", "me@example.com"],
        date: "2026-10-23T09:00:00.000Z",
        subject: "Meeting next week",
        body: "Can we meet next week?",
        bodyTruncated: false,
      },
    ],
  });
  const { ctx, approvals, clock } = makeContext({
    gmail,
    calendar: unusedCalendar(),
    now: new Date("2026-10-24T10:00:00Z"),
  });
  return { gmail, ctx, approvals, clock };
}

async function propose(ctx: Context): Promise<string> {
  const out = (await callTool(
    registry,
    "gmail.propose_reply",
    { threadId: "t1", to: "maya@example.com", body: "Tuesday 3pm works." },
    ctx,
  )) as { approvalId: string };
  return out.approvalId;
}

// ---------- reading ----------

test("search works through callTool", async () => {
  const { ctx } = world();
  const out = (await callTool(registry, "gmail.search_threads", { query: "from:maya" }, ctx)) as {
    threads: ThreadSummary[];
  };
  assert.equal(out.threads.length, 1);
  assert.equal(out.threads[0]?.subject, "Meeting next week");
});

test("an empty search query is rejected", async () => {
  const { ctx } = world();
  await expectError(callTool(registry, "gmail.search_threads", { query: "" }, ctx), "INVALID_INPUT");
});

test("reading a thread drops quoted replies and decodes the body", async () => {
  const body = Buffer.from("Thanks!\n\nOn Mon, Oct 19 wrote:\n> old text").toString("base64url");
  const response = {
    id: "t9",
    snippet: "Thanks!",
    messages: [
      {
        id: "m9",
        internalDate: "1792800000000",
        payload: {
          mimeType: "multipart/alternative",
          headers: [
            { name: "From", value: "Maya <maya@example.com>" },
            { name: "To", value: "me@example.com" },
            { name: "Subject", value: "Hi" },
            { name: "Message-ID", value: "<x@y>" },
          ],
          parts: [{ mimeType: "text/plain", body: { data: body } }],
        },
      },
    ],
  };
  const api = createGmailApi({
    getAccessToken: async () => "token",
    fetchImpl: (async () =>
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch,
  });
  const thread = await api.getThread("t9");
  assert.equal(thread.messages[0]?.body, "Thanks!");
  assert.deepEqual(thread.messages[0]?.participants, ["maya@example.com", "me@example.com"]);
  assert.equal(thread.messages[0]?.rfcMessageId, "<x@y>");
});

test("emailsIn pulls lowercase addresses out of a header", () => {
  assert.deepEqual(emailsIn('"Maya S" <Maya@Example.com>, bob@x.com'), ["maya@example.com", "bob@x.com"]);
});

// ---------- safety of tool names and permissions ----------

test("the assistant cannot call the send tool", async () => {
  const { ctx } = world();
  await expectError(callTool(registry, "gmail.send_reply", {}, ctx), "NOT_CALLABLE_BY_MODEL");
});

test("unknown tool names are rejected", async () => {
  const { ctx } = world();
  await expectError(callTool(registry, "gmail.delete_everything", {}, ctx), "UNKNOWN_TOOL");
});

// ---------- proposing and sending ----------

test("propose refuses a recipient who is not in the thread, and stores nothing", async () => {
  const { ctx, approvals } = world();
  await expectError(
    callTool(registry, "gmail.propose_reply", { threadId: "t1", to: "evil@attacker.test", body: "hi" }, ctx),
    "RECIPIENT_NOT_IN_THREAD",
  );
  assert.equal(approvals.rows.size, 0);
});

test("an approved reply is sent exactly once, with correct threading headers", async () => {
  const { ctx, approvals, gmail } = world();
  const id = await propose(ctx);
  await ctx.approvals.setStatus(id, "APPROVED");

  const result = await runApproved(id, registry, ctx);
  assert.equal(gmail.sent.length, 1);
  assert.equal(result.providerId, gmail.sent[0]?.messageId);

  const raw = Buffer.from(gmail.sent[0]!.raw, "base64url").toString("utf8");
  assert.match(raw, /^Subject: Re: Meeting next week$/m);
  assert.match(raw, /^In-Reply-To: <orig@maya\.example>$/m);

  await expectError(runApproved(id, registry, ctx), "ALREADY_DONE");
  assert.equal(gmail.sent.length, 1);
  assert.equal(approvals.rows.get(id)?.status, "DONE");
});

test("nothing is sent without approval", async () => {
  const { ctx, gmail } = world();
  const id = await propose(ctx);
  await expectError(runApproved(id, registry, ctx), "NOT_APPROVED");
  assert.equal(gmail.sent.length, 0);
});

test("a rejected approval is never sent", async () => {
  const { ctx, gmail } = world();
  const id = await propose(ctx);
  await ctx.approvals.setStatus(id, "REJECTED");
  await expectError(runApproved(id, registry, ctx), "NOT_APPROVED");
  assert.equal(gmail.sent.length, 0);
});

test("an expired approval is never sent", async () => {
  const { ctx, clock, gmail } = world();
  const id = await propose(ctx);
  await ctx.approvals.setStatus(id, "APPROVED");
  clock.now = new Date(clock.now.getTime() + 31 * 60_000);
  await expectError(runApproved(id, registry, ctx), "APPROVAL_EXPIRED");
  assert.equal(gmail.sent.length, 0);
});

test("changed details after approval are refused", async () => {
  const { ctx, approvals, gmail } = world();
  const id = await propose(ctx);
  await ctx.approvals.setStatus(id, "APPROVED");
  approvals.rows.get(id)!.args.body = "Please send me your password.";
  await expectError(runApproved(id, registry, ctx), "ACTION_CHANGED");
  assert.equal(gmail.sent.length, 0);
});

test("if the thread changed after approval, nothing is sent", async () => {
  const { ctx, approvals, gmail } = world();
  const id = await propose(ctx);
  await ctx.approvals.setStatus(id, "APPROVED");
  gmail.threads.get("t1")!.messages.push({
    messageId: "m2",
    rfcMessageId: "<new@maya.example>",
    from: "Maya <maya@example.com>",
    to: "me@example.com",
    cc: "",
    participants: ["maya@example.com", "me@example.com"],
    date: new Date().toISOString(),
    subject: "Actually Friday",
    body: "Friday?",
    bodyTruncated: false,
  });
  await expectError(runApproved(id, registry, ctx), "THREAD_CHANGED");
  assert.equal(gmail.sent.length, 0);
  assert.equal(approvals.rows.get(id)?.status, "FAILED");
});

test("a send that times out is marked UNKNOWN, not resent, and can be checked", async () => {
  const { ctx, approvals, gmail } = world();
  const id = await propose(ctx);
  await ctx.approvals.setStatus(id, "APPROVED");
  gmail.failAfterWrite = true;

  await assert.rejects(runApproved(id, registry, ctx), (err: unknown) => err instanceof ToolError && err.ambiguous);
  assert.equal(approvals.rows.get(id)?.status, "UNKNOWN");
  assert.equal(gmail.sent.length, 1); // the message did go out

  await expectError(runApproved(id, registry, ctx), "NOT_APPROVED"); // no second copy
  assert.equal(gmail.sent.length, 1);

  const found = await reconcileApproval(id, registry, ctx);
  assert.equal(found.providerId, gmail.sent[0]?.messageId);
  assert.equal(approvals.rows.get(id)?.status, "DONE");
  assert.equal(gmail.sent.length, 1);
});

test("requestApproval stores a fingerprint of the exact action", async () => {
  const { ctx } = world();
  const approval = await requestApproval(ctx, "gmail.send_reply", { to: "a@b.co" });
  assert.equal(approval.fingerprint.length, 64);
  assert.equal(approval.status, "PENDING");
});

// ---------- MIME safety ----------

test("a header with a line break is rejected (header injection)", () => {
  assert.throws(
    () =>
      buildReply({
        to: "maya@example.com",
        subject: "Hi\r\nBcc: attacker@evil.test",
        body: "x",
        messageId: "<a@sera.local>",
        inReplyTo: "<b@x>",
        references: "<b@x>",
        date: new Date("2026-10-24T10:00:00Z"),
      }),
    (err: unknown) => err instanceof ToolError && err.code === "UNSAFE_HEADER",
  );
});
