import { z } from "zod";
import { localDateTime, zoneSchema } from "../time/types.ts";

// A unique id we generate for each event, so an event can be found again after a timeout.
const marker = z.string().regex(/^[0-9a-f-]{36}@sera\.local$/, "marker must be a generated id");

// ---- calendar.list_events ----

export const listEventsInput = z.object({
  from: localDateTime,
  to: localDateTime,
  timeZone: zoneSchema,
  max: z.number().int().min(1).max(25).default(10),
});

export const eventSummary = z.object({
  eventId: z.string(),
  summary: z.string(),
  start: z.string(),
  end: z.string(),
  attendees: z.array(z.string()),
  link: z.string(),
});

export const listEventsOutput = z.object({
  events: z.array(eventSummary),
});

// ---- calendar.find_slots ----

export const findSlotsInput = z.object({
  from: localDateTime,
  to: localDateTime,
  timeZone: zoneSchema,
  durationMinutes: z.number().int().min(15).max(240).default(30),
  count: z.number().int().min(1).max(5).default(3),
  workdayStartHour: z.number().int().min(0).max(23).default(9),
  workdayEndHour: z.number().int().min(1).max(24).default(18),
});

export const timeSlot = z.object({
  start: z.string(),
  end: z.string(),
});

export const findSlotsOutput = z.object({
  slots: z.array(timeSlot),
});

// ---- calendar.propose_event ----

export const proposeEventInput = z.object({
  title: z.string().min(1).max(200),
  start: localDateTime,
  end: localDateTime,
  timeZone: zoneSchema,
  attendees: z.array(z.email()).max(10).default([]),
});

export const proposeEventOutput = z.object({
  approvalId: z.string(),
  preview: z.object({
    title: z.string(),
    start: z.string(),
    end: z.string(),
    timeZone: z.string(),
    attendees: z.array(z.string()),
    expiresAt: z.string(),
  }),
});

// ---- calendar.create_event (the approved action, frozen at proposal time) ----

export const createEventAction = z.object({
  title: z.string().min(1).max(200),
  startUtc: z.iso.datetime({ offset: true }),
  endUtc: z.iso.datetime({ offset: true }),
  timeZone: z.string(),
  attendees: z.array(z.email()).max(10),
  marker,
});

export const createEventOutput = z.object({
  providerId: z.string(),
  link: z.string(),
});

// ---- TypeScript types ----

export type ListEventsInput = z.infer<typeof listEventsInput>;
export type ListEventsOutput = z.infer<typeof listEventsOutput>;
export type EventSummary = z.infer<typeof eventSummary>;

export type FindSlotsInput = z.infer<typeof findSlotsInput>;
export type FindSlotsOutput = z.infer<typeof findSlotsOutput>;
export type TimeSlot = z.infer<typeof timeSlot>;

export type ProposeEventInput = z.infer<typeof proposeEventInput>;
export type ProposeEventOutput = z.infer<typeof proposeEventOutput>;

export type CreateEventAction = z.infer<typeof createEventAction>;
export type CreateEventOutput = z.infer<typeof createEventOutput>;
