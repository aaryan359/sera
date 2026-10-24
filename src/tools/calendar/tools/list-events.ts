import { defineTool } from "../../safety.ts";
import { listEventsInput, listEventsOutput } from "../types.ts";
import { timeRange } from "../../time/zone.ts";
import { CALENDAR_READ_SCOPE } from "../scopes.ts";

export const listEvents = defineTool({
  name: "calendar.list_events",
  kind: "READ",
  description:
    "List the user's calendar events between two local times, for example from 2026-10-27T00:00 to " +
    "2026-10-28T00:00 in the user's time zone. Use it to see what is already scheduled.",
  scopes: [CALENDAR_READ_SCOPE],
  timeoutMs: 10_000,
  input: listEventsInput,
  output: listEventsOutput,
  run: async ({ from, to, timeZone, max }, ctx) => {
    const { start, end } = timeRange(from, to, timeZone);
    const events = await ctx.calendar.listEvents(start.toISOString(), end.toISOString(), max);
    return { events };
  },
});
