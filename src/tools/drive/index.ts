import type { ToolDef } from "../safety.ts";
import { applyAppend } from "./tools/apply-append.ts";
import { proposeAppend } from "./tools/propose-append.ts";
import { readDocument } from "./tools/read-doc.ts";
import { searchFiles } from "./tools/search-files.ts";

export { createDriveApi, type DriveApi } from "./client/api.ts";

// Every Drive and Docs tool. The registry hides the EXECUTE tool from the assistant.
export const driveTools: ToolDef[] = [searchFiles, readDocument, proposeAppend, applyAppend];
