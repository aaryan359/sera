import { defineTool } from "../../safety.ts";
import { DRIVE_READ_SCOPE } from "../scopes.ts";
import { driveSearchInput, driveSearchOutput } from "../types.ts";

export const searchFiles = defineTool({
  name: "drive.search_files",
  kind: "READ",
  description:
    "Search the user's Google Drive by file name. Returns fileId, name, type, and last modified time. " +
    "Use the fileId with docs.read_document or docs.propose_append.",
  scopes: [DRIVE_READ_SCOPE],
  timeoutMs: 10_000,
  input: driveSearchInput,
  output: driveSearchOutput,
  run: async ({ query, max }, ctx) => {
    const found = await ctx.drive.searchFiles(query, max);
    return {
      files: found.map(({ fileId, name, mimeType, modifiedTime }) => ({ fileId, name, mimeType, modifiedTime })),
    };
  },
});
