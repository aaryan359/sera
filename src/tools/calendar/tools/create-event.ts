import { defineTool, ToolError } from "../../safety.ts";
import { clashesWith } from "../../time/zone.ts";
import { CALENDAR_WRITE_SCOPE } from "../scopes.ts";
import { createEventAction, createEventOutput } from "../types.ts";

export const createEvent = defineTool({
  name: "calendar.create_event",
  kind: "EXECUTE",
  description: "Creates an approved calendar event. Not callable by the assistant.",
  scopes: [CALENDAR_WRITE_SCOPE],
  timeoutMs: 15_000,
  input: createEventAction,
  output: createEventOutput,
  run: async (action, ctx) => {

    const start = new Date(action.startUtc);
    const end = new Date(action.endUtc);
    

    // Check again: the slot may have been taken since the user approved it.
    const busy = await ctx.calendar.freeBusy(action.startUtc, action.endUtc);
    if (clashesWith(busy, start, end)) {
      throw new ToolError("SLOT_BUSY", "that time was taken after approval; propose a new time");
    }

    const created = await ctx.calendar.createEvent({
      summary: action.title,
      start: action.startUtc,
      end: action.endUtc,
      timeZone: action.timeZone,
      attendees: action.attendees,
      marker: action.marker,
    });
    return { providerId: created.eventId, link: created.link };
  },
  // Only used after a timeout: looks for the event by its marker.
  reconcile: async (action, ctx) => {
    const found = await ctx.calendar.findEventByMarker(action.marker);
    return found ? { providerId: found.eventId, link: found.link } : null;
  },
});
