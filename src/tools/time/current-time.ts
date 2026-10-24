import { defineTool } from "../safety.ts";
import { currentTimeInput, currentTimeOutput } from "./types.ts";
import { formatLocal, localParts } from "./zone.ts";

export const currentTime = defineTool({
  name: "time.now",
  kind: "READ",
  description:
    "Returns the current local date, time, and weekday in a time zone. Call this before working out " +
    "what words like 'tomorrow' or 'next Friday' mean.",
  scopes: [],
  timeoutMs: 1_000,
  input: currentTimeInput,
  output: currentTimeOutput,
  run: async ({ timeZone }, ctx) => {
    const now = ctx.now();
    return {
      local: formatLocal(now, timeZone),
      weekday: localParts(now, timeZone).weekday,
      timeZone,
    };
  },
});
