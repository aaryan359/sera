import { defineTool, ToolError } from "../../safety.ts";
import { setApplicationStatusInput, setApplicationStatusOutput } from "../types.ts";

// WRITE_LOCAL: only changes the user's own application log.
export const setApplicationStatus = defineTool({
  name: "applications.set_status",
  kind: "WRITE_LOCAL",
  description:
    "Change the status of one logged application (use an id from applications.list). " +
    "Statuses: SAVED, APPLIED, INTERVIEW, OFFER, REJECTED, WITHDRAWN.",
  scopes: [],
  timeoutMs: 5_000,
  input: setApplicationStatusInput,
  output: setApplicationStatusOutput,
  run: async ({ id, status }, ctx) => {
    const application = await ctx.applications.setStatus(id, status, ctx.now().toISOString());
    if (!application) throw new ToolError("NOT_FOUND", "no application with that id");
    return { application };
  },
});
