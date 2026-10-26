import { defineTool } from "../../safety.ts";
import { listApplicationsInput, listApplicationsOutput } from "../types.ts";

export const listApplications = defineTool({
  name: "applications.list",
  kind: "READ",
  description:
    "List the user's job applications, newest first in the log. Optionally filter by status " +
    "(SAVED, APPLIED, INTERVIEW, OFFER, REJECTED, WITHDRAWN).",
  scopes: [],
  timeoutMs: 5_000,
  input: listApplicationsInput,
  output: listApplicationsOutput,
  run: async ({ status }, ctx) => {
    return { applications: await ctx.applications.list(status) };
  },
});
