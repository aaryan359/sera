import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { callTool, registry } from "../index.ts";
import { reconcileApproval, runApproved, ToolError } from "../safety.ts";
import { expectError, makeContext } from "../test-kit.ts";
import type { DriveApi, FileInfo } from "../drive/client/api.ts";
import type { GmailApi, Thread, ThreadSummary } from "./client/api.ts";
import { buildEmail } from "./client/mime.ts";

// ---------- fakes ----------

class FakeDrive implements DriveApi {
  files = new Map<string, { info: FileInfo; bytes: Buffer }>();

  add(fileId: string, name: string, mimeType: string, bytes: Buffer, size?: number) {
    const md5 = createHash("md5").update(bytes).digest("hex");
    this.files.set(fileId, {
      info: { fileId, name, mimeType, modifiedTime: "2026-10-20T09:00:00Z", size: size ?? bytes.length, md5 },
      bytes,
    });
  }

  async searchFiles() {
    return [];
  }
  async fileInfo(fileId: string) {
    const f = this.files.get(fileId);
    if (!f) throw new ToolError("NOT_FOUND", "no such file");
    return f.info;
  }
  async readDoc(): Promise<never> {
    throw new Error("not used");
  }
  async appendToDoc(): Promise<never> {
    throw new Error("not used");
  }
  async download(fileId: string, maxBytes: number) {
    const f = this.files.get(fileId);
    if (!f) throw new ToolError("NOT_FOUND", "no such file");
    if (f.bytes.length > maxBytes) throw new ToolError("FILE_NOT_ALLOWED", "too large");
    return f.bytes;
  }
}

class FakeGmail implements GmailApi {
  sent: { marker: string; raw: string; messageId: string }[] = [];
  failAfterWrite = false;
  private counter = 0;

  async searchThreads(): Promise<ThreadSummary[]> {
    return [];
  }
  async getThread(): Promise<Thread> {
    throw new Error("not used");
  }
  async sendRaw(raw: string) {
    const text = Buffer.from(raw, "base64url").toString("utf8");
    const marker = text.match(/^Message-ID: <(.+)>$/m)?.[1] ?? "";
    const messageId = `sent${++this.counter}`;
    this.sent.push({ marker, raw: text, messageId });
    if (this.failAfterWrite) {
      this.failAfterWrite = false;
      throw new ToolError("PROVIDER_ERROR", "timed out", true);
    }
    return { messageId, threadId: `thread${this.counter}` };
  }
  async findSentMessage(marker: string) {
    const hit = this.sent.find((s) => s.marker === marker);
    return hit ? { messageId: hit.messageId, threadId: `thread-of-${hit.messageId}` } : null;
  }
}

function world() {
  const gmail = new FakeGmail();
  const drive = new FakeDrive();
  drive.add("file_cv_0000001", "resume.pdf", "application/pdf", Buffer.from("%PDF-1.4 my resume"));
  const made = makeContext({ gmail, drive, now: new Date("2026-10-24T10:00:00Z") });
  return { gmail, drive, ...made };
}

async function proposeWith(ctx: ReturnType<typeof world>["ctx"], attachmentFileIds: string[]) {
  const out = (await callTool(
    registry,
    "gmail.propose_email",
    { to: "hr@acme.example", subject: "Application for Data Analyst", body: "Please find my resume attached.", attachmentFileIds },
    ctx,
  )) as { approvalId: string; preview: { attachments: string[] } };
  return out;
}

// ---------- tests ----------

test("a new email with a PDF resume is sent once as a multipart message", async () => {
  const { gmail, ctx, approvals } = world();
  const out = await proposeWith(ctx, ["file_cv_0000001"]);
  assert.deepEqual(out.preview.attachments, ["resume.pdf"]);
  assert.equal(gmail.sent.length, 0);

  await ctx.approvals.setStatus(out.approvalId, "APPROVED");
  const result = await runApproved(out.approvalId, registry, ctx);
  assert.equal(gmail.sent.length, 1);
  assert.equal(result.providerId, "sent1");

  const raw = gmail.sent[0]!.raw;
  assert.match(raw, /^Content-Type: multipart\/mixed/m);
  assert.match(raw, /^Content-Disposition: attachment; filename="resume\.pdf"$/m);
  assert.match(raw, /^Subject: Application for Data Analyst$/m);
  assert.equal(approvals.rows.get(out.approvalId)?.status, "DONE");
});

test("a plain email with no attachment is sent without multipart", async () => {
  const { gmail, ctx } = world();
  const out = await proposeWith(ctx, []);
  await ctx.approvals.setStatus(out.approvalId, "APPROVED");
  await runApproved(out.approvalId, registry, ctx);
  assert.doesNotMatch(gmail.sent[0]!.raw, /multipart/);
});

test("an unsupported file type is refused when the email is proposed", async () => {
  const { drive, ctx, approvals } = world();
  drive.add("file_app_0000002", "setup.exe", "application/x-msdownload", Buffer.from("MZ"));
  await expectError(proposeWith(ctx, ["file_app_0000002"]), "FILE_NOT_ALLOWED");
  assert.equal(approvals.rows.size, 0);
});

test("a file larger than 10 MB is refused when the email is proposed", async () => {
  const { drive, ctx } = world();
  drive.add("file_big_0000003", "scan.pdf", "application/pdf", Buffer.from("%PDF"), 11 * 1024 * 1024);
  await expectError(proposeWith(ctx, ["file_big_0000003"]), "FILE_NOT_ALLOWED");
});

test("if the file changes after approval, nothing is sent", async () => {
  const { gmail, drive, ctx, approvals } = world();
  const out = await proposeWith(ctx, ["file_cv_0000001"]);
  await ctx.approvals.setStatus(out.approvalId, "APPROVED");
  drive.add("file_cv_0000001", "resume.pdf", "application/pdf", Buffer.from("%PDF-1.4 a different resume"));

  await expectError(runApproved(out.approvalId, registry, ctx), "FILE_CHANGED");
  assert.equal(gmail.sent.length, 0);
  assert.equal(approvals.rows.get(out.approvalId)?.status, "FAILED");
});

test("a new email that times out is UNKNOWN, not resent, and can be checked by its marker", async () => {
  const { gmail, ctx, approvals } = world();
  const out = await proposeWith(ctx, []);
  await ctx.approvals.setStatus(out.approvalId, "APPROVED");
  gmail.failAfterWrite = true;

  await assert.rejects(runApproved(out.approvalId, registry, ctx), (err: unknown) => err instanceof ToolError && err.ambiguous);
  assert.equal(approvals.rows.get(out.approvalId)?.status, "UNKNOWN");
  await expectError(runApproved(out.approvalId, registry, ctx), "NOT_APPROVED");
  assert.equal(gmail.sent.length, 1);

  const found = (await reconcileApproval(out.approvalId, registry, ctx)) as { providerId: string };
  assert.equal(found.providerId, "sent1");
  assert.equal(gmail.sent.length, 1);
});

test("the assistant cannot send an email directly", async () => {
  const { ctx } = world();
  await expectError(callTool(registry, "gmail.send_email", {}, ctx), "NOT_CALLABLE_BY_MODEL");
});

test("a message with a line break in its subject is refused when proposed", async () => {
  const { ctx } = world();
  await expectError(
    callTool(
      registry,
      "gmail.propose_email",
      { to: "hr@acme.example", subject: "Hi\r\nBcc: spy@evil.test", body: "hello" },
      ctx,
    ),
    "INVALID_INPUT",
  );
});

test("the attachment builder produces a valid multipart body with base64 file content", () => {
  const raw = buildEmail({
    to: "hr@acme.example",
    subject: "Hello",
    body: "Body text",
    messageId: "<a@sera.local>",
    date: new Date("2026-10-24T10:00:00Z"),
    attachments: [{ filename: "my cv (final).pdf", mimeType: "application/pdf", data: Buffer.from("PDFDATA") }],
  });
  const text = Buffer.from(raw, "base64url").toString("utf8");
  assert.match(text, /filename="my_cv__final_.pdf"/);
  assert.match(text, new RegExp(Buffer.from("PDFDATA").toString("base64")));
  assert.match(text, /--sera-[0-9a-f-]+--/);
});
