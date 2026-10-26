import { defineTool, requestApproval } from "../../safety.ts";
import { DOCS_READ_SCOPE } from "../scopes.ts";
import { applyAppend } from "./apply-append.ts";
import { applyAppendAction, proposeAppendInput, proposeAppendOutput } from "../types.ts";

export const proposeAppend = defineTool({
  name: "docs.propose_append",
  kind: "PROPOSE",
  description:
    "Prepare text to add to the end of an existing Google Doc, for the user to approve. This changes " +
    "NOTHING yet. Returns an approvalId and a preview with the document title and the text.",
  scopes: [DOCS_READ_SCOPE],
  timeoutMs: 10_000,
  input: proposeAppendInput,
  output: proposeAppendOutput,
  run: async ({ fileId, text }, ctx) => {
    // Reading the document first confirms it exists and that Sera can access it.
    const doc = await ctx.drive.readDoc(fileId);
    const action = applyAppendAction.parse({ fileId, title: doc.title, text });
    const approval = await requestApproval(ctx, applyAppend.name, action);
    return {
      approvalId: approval.id,
      preview: { fileId, title: doc.title, text, expiresAt: approval.expiresAt.toISOString() },
    };
  },
});
