import { defineTool } from "../../safety.ts";
import { recordApplicationInput, recordApplicationOutput } from "../types.ts";

// WRITE_LOCAL: only changes the user's own application log. Nothing is sent anywhere.
export const recordApplication = defineTool({
  name: "applications.record",
  kind: "WRITE_LOCAL",
  description:
    "Add a job application to the user's log (company, role, link, method, status, notes). " +
    "Call it after an application is sent, so it can be tracked. It does not send anything.",
  scopes: [],
  timeoutMs: 5_000,
  input: recordApplicationInput,
  output: recordApplicationOutput,
  run: async (args, ctx) => {
    const application = await ctx.applications.add(args, ctx.now().toISOString());
    return { application };
  },
});
