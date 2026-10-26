import assert from "node:assert/strict";
import { test } from "node:test";
import { callTool, registry } from "../index.ts";
import { reconcileApproval, runApproved, ToolError } from "../safety.ts";
import { expectError, makeContext } from "../test-kit.ts";
import type { DocText, DriveApi, FileInfo } from "./client/api.ts";

class FakeDrive implements DriveApi {
  files = new Map<string, FileInfo>();
  docs = new Map<string, { title: string; text: string }>();
  appended: { fileId: string; text: string }[] = [];
  failAfterWrite = false; // the text is added, but the caller gets a timeout

  async searchFiles(query: string, max: number) {
    return [...this.files.values()].filter((f) => f.name.includes(query)).slice(0, max);
  }

  async fileInfo(fileId: string) {
    const info = this.files.get(fileId);
    if (!info) throw new ToolError("NOT_FOUND", "no such file");
    return info;
  }

  async readDoc(fileId: string): Promise<DocText> {
    const doc = this.docs.get(fileId);
    if (!doc) throw new ToolError("NOT_FOUND", "no such document");
    return { fileId, title: doc.title, text: doc.text, truncated: false };
  }

  async appendToDoc(fileId: string, text: string) {
    const doc = this.docs.get(fileId);
    if (!doc) throw new ToolError("NOT_FOUND", "no such document");
    doc.text += `\n${text}`;
    this.appended.push({ fileId, text });
    if (this.failAfterWrite) {
      this.failAfterWrite = false;
      throw new ToolError("PROVIDER_ERROR", "timed out", true);
    }
    return { fileId };
  }

  async download(): Promise<Buffer> {
    throw new Error("not used in drive tests");
  }
}

function world() {
  const drive = new FakeDrive();
  drive.files.set("file_resume_0001", {
    fileId: "file_resume_0001",
    name: "Resume Draft",
    mimeType: "application/vnd.google-apps.document",
    modifiedTime: "2026-10-20T09:00:00Z",
    size: null,
    md5: null,
  });
  drive.docs.set("doc_notes_000001", { title: "Job notes", text: "Existing notes." });
  const made = makeContext({ drive, now: new Date("2026-10-24T10:00:00Z") });
  return { drive, ...made };
}

test("drive.search_files returns only the visible fields", async () => {
  const { ctx } = world();
  const out = (await callTool(registry, "drive.search_files", { query: "Resume" }, ctx)) as {
    files: Record<string, unknown>[];
  };
  assert.equal(out.files.length, 1);
  assert.deepEqual(Object.keys(out.files[0]!).sort(), ["fileId", "mimeType", "modifiedTime", "name"]);
});

test("docs.read_document returns the text of a document", async () => {
  const { ctx } = world();
  const out = (await callTool(registry, "docs.read_document", { fileId: "doc_notes_000001" }, ctx)) as {
    title: string;
    text: string;
  };
  assert.equal(out.title, "Job notes");
  assert.equal(out.text, "Existing notes.");
});

test("proposing an append changes nothing until the user approves, then runs once", async () => {
  const { drive, ctx, approvals } = world();
  const out = (await callTool(
    registry,
    "docs.propose_append",
    { fileId: "doc_notes_000001", text: "Applied to Acme on Friday." },
    ctx,
  )) as { approvalId: string; preview: { title: string } };
  assert.equal(out.preview.title, "Job notes");
  assert.equal(drive.appended.length, 0);

  await ctx.approvals.setStatus(out.approvalId, "APPROVED");
  await runApproved(out.approvalId, registry, ctx);
  assert.equal(drive.appended.length, 1);
  assert.equal(approvals.rows.get(out.approvalId)?.status, "DONE");

  await expectError(runApproved(out.approvalId, registry, ctx), "ALREADY_DONE");
  assert.equal(drive.appended.length, 1);
});

test("an append that times out is UNKNOWN, is never repeated, and cannot be auto-checked", async () => {
  const { drive, ctx, approvals } = world();
  const out = (await callTool(
    registry,
    "docs.propose_append",
    { fileId: "doc_notes_000001", text: "Second note." },
    ctx,
  )) as { approvalId: string };
  await ctx.approvals.setStatus(out.approvalId, "APPROVED");
  drive.failAfterWrite = true;

  await assert.rejects(runApproved(out.approvalId, registry, ctx), (err: unknown) => err instanceof ToolError && err.ambiguous);
  assert.equal(approvals.rows.get(out.approvalId)?.status, "UNKNOWN");
  await expectError(runApproved(out.approvalId, registry, ctx), "NOT_APPROVED");
  assert.equal(drive.appended.length, 1);
  await expectError(reconcileApproval(out.approvalId, registry, ctx), "PROVIDER_ERROR");
});

test("the assistant cannot call the append action directly", async () => {
  const { ctx } = world();
  await expectError(
    callTool(registry, "docs.apply_append", { fileId: "doc_notes_000001", title: "x", text: "y" }, ctx),
    "NOT_CALLABLE_BY_MODEL",
  );
});

test("proposing an append to a missing document stores nothing", async () => {
  const { approvals, ctx } = world();
  await expectError(
    callTool(registry, "docs.propose_append", { fileId: "doc_missing_0001", text: "hi" }, ctx),
    "NOT_FOUND",
  );
  assert.equal(approvals.rows.size, 0);
});
