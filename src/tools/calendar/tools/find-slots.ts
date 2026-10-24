import { defineTool } from "../../safety.ts";
import { clashesWith, formatLocal, timeRange } from "../../time/zone.ts";
import { CALENDAR_READ_SCOPE } from "../scopes.ts";
import { findSlotsInput, findSlotsOutput } from "../types.ts";

const STEP_MINUTES = 30;

export const findSlots = defineTool({
  name: "calendar.find_slots",
  kind: "READ",
  description:
    "Find free time slots in the user's calendar between two local times. Only times inside working " +
    "hours are returned, and slots never overlap an existing event. Use this to offer meeting times. " +
    "Returned times are local to timeZone.",
  scopes: [CALENDAR_READ_SCOPE],
  timeoutMs: 10_000,
  input: findSlotsInput,
  output: findSlotsOutput,
  run: async (args, ctx) => {
    const { start, end } = timeRange(args.from, args.to, args.timeZone);
    const busy = await ctx.calendar.freeBusy(start.toISOString(), end.toISOString());
    const durationMs = args.durationMinutes * 60_000;
    const slots: { start: string; end: string }[] = [];

    for (let t = start.getTime(); t + durationMs <= end.getTime(); t += STEP_MINUTES * 60_000) {
      if (slots.length >= args.count) break;
      const candidateStart = new Date(t);
      const candidateEnd = new Date(t + durationMs);

      // Skip anything in the past.
      if (candidateStart.getTime() <= ctx.now().getTime()) continue;

      // Keep the whole slot inside working hours, in the user's time zone.
      const local = localMinutes(candidateStart, args.timeZone);
      const localEnd = local + args.durationMinutes;
      if (local < args.workdayStartHour * 60 || localEnd > args.workdayEndHour * 60) continue;

      if (clashesWith(busy, candidateStart, candidateEnd)) continue;

      slots.push({
        start: formatLocal(candidateStart, args.timeZone),
        end: formatLocal(candidateEnd, args.timeZone),
      });
    }
    return { slots };
  },
});

// Minutes since midnight, in a time zone.
function localMinutes(instant: Date, timeZone: string): number {
  const local = formatLocal(instant, timeZone); // 2026-10-27T09:30
  const [hour = "0", minute = "0"] = local.slice(11).split(":");
  return Number(hour) * 60 + Number(minute);
}
