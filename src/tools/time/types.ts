import { z } from "zod";
import { isZone } from "./zone.ts";

// ---- Shared inputs ----

// A time zone name such as Asia/Kolkata or America/New_York.
export const zoneSchema = z
  .string()
  .refine(isZone, "unknown time zone; use a name like Asia/Kolkata or America/New_York");

// A wall-clock time with no zone, for example 2026-10-27T09:00.
export const localDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, "use the format 2026-10-27T09:00");

// ---- time.now ----

export const currentTimeInput = z.object({
  timeZone: zoneSchema,
});

export const currentTimeOutput = z.object({
  local: z.string(),
  weekday: z.string(),
  timeZone: z.string(),
});

// ---- TypeScript types ----

export type ZoneName = z.infer<typeof zoneSchema>;
export type LocalDateTime = z.infer<typeof localDateTime>;
export type CurrentTimeInput = z.infer<typeof currentTimeInput>;
export type CurrentTimeOutput = z.infer<typeof currentTimeOutput>;
