import { defineTool } from "../../safety.ts";
import { DOCS_WRITE_SCOPE } from "../scopes.ts";
import { applyAppendAction, applyAppendOutput } from "../types.ts";

// EXECUTE: adds approved text to the end of a document. Not callable by the assistant.
// There is no reconcile step: a timed-out append cannot be checked reliably, so it is marked
// UNKNOWN for the user to look at, and it is never repeated automatically.
export const applyAppend = defineTool({
  name: "docs.apply_append",
  kind: "EXECUTE",
  description: "Adds approved text to the end of a Google Doc. Not callable by the assistant.",
  scopes: [DOCS_WRITE_SCOPE],
  timeoutMs: 15_000,
  input: applyAppendAction,
  output: applyAppendOutput,
  run: async (action, ctx) => {
    const result = await ctx.drive.appendToDoc(action.fileId, action.text);
    return { providerId: result.fileId, fileId: result.fileId };
  },
});
