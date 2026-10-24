import { randomUUID } from "node:crypto";
import { defineTool, requestApproval, ToolError } from "../../safety.ts";
import { clashesWith, localToInstant } from "../../time/zone.ts";
import { CALENDAR_READ_SCOPE } from "../scopes.ts";
import { createEvent } from "./create-event.ts";
import { createEventAction, proposeEventInput, proposeEventOutput } from "../types.ts";

const MAX_EVENT_MS = 8 * 60 * 60 * 1000;

export const proposeEvent = defineTool({
  name: "calendar.propose_event",
  kind: "PROPOSE",
  description:
    "Prepare a calendar event for the user to approve. This creates NOTHING yet. Times are local to " +
    "timeZone. Fails if the time is in the past or already busy. Attendees receive an invitation " +
    "once the user approves. Returns an approvalId and a preview to show the user.",
  scopes: [CALENDAR_READ_SCOPE],
  timeoutMs: 10_000,
  input: proposeEventInput,
  output: proposeEventOutput,
  run: async (args, ctx) => {
    const start = localToInstant(args.start, args.timeZone);
    const end = localToInstant(args.end, args.timeZone);
    if (end <= start || end.getTime() - start.getTime() > MAX_EVENT_MS) {
      throw new ToolError("BAD_TIME_RANGE", "the event must end after it starts and last at most 8 hours");
    }
    if (start.getTime() <= ctx.now().getTime()) {
      throw new ToolError("BAD_TIME_RANGE", "the start time is in the past");
    }

    const busy = await ctx.calendar.freeBusy(start.toISOString(), end.toISOString());
    if (clashesWith(busy, start, end)) {
      throw new ToolError("SLOT_BUSY", "that time is already busy; find another slot");
    }

    const action = createEventAction.parse({
      title: args.title,
      startUtc: start.toISOString(),
      endUtc: end.toISOString(),
      timeZone: args.timeZone,
      attendees: args.attendees,
      marker: `${randomUUID()}@sera.local`,
    });
    const approval = await requestApproval(ctx, createEvent.name, action);

    return {
      approvalId: approval.id,
      preview: {
        title: args.title,
        start: args.start,
        end: args.end,
        timeZone: args.timeZone,
        attendees: args.attendees,
        expiresAt: approval.expiresAt.toISOString(),
      },
    };
  },
});
