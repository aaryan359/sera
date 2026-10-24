import { ToolError } from "../safety.ts";

// ---- Checks ----

// True if the name is a time zone this system knows.
export function isZone(name: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

// ---- Conversions ----

export interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
}

// The wall-clock parts of an instant in a time zone.
export function localParts(instant: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    weekday: "long",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: get("weekday"),
  };
}

// How far the zone is ahead of UTC at that instant, in milliseconds.
function offsetMs(timeZone: string, instant: Date): number {
  const p = localParts(instant, timeZone);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wallAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

// "2026-10-27T09:00" in a zone -> the exact moment. Handles daylight saving time.
export function localToInstant(local: string, timeZone: string): Date {
  const withSeconds = local.length === 16 ? `${local}:00` : local;
  const wallAsUtc = Date.parse(`${withSeconds}Z`);
  const firstGuess = wallAsUtc - offsetMs(timeZone, new Date(wallAsUtc));
  return new Date(wallAsUtc - offsetMs(timeZone, new Date(firstGuess)));
}

// A moment -> "2026-10-27T09:00" in a zone.
export function formatLocal(instant: Date, timeZone: string): string {
  const p = localParts(instant, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000;

// Converts a from/to pair and checks the range is valid (at most 31 days).
export function timeRange(from: string, to: string, timeZone: string): { start: Date; end: Date } {
  const start = localToInstant(from, timeZone);
  const end = localToInstant(to, timeZone);
  const span = end.getTime() - start.getTime();
  if (span <= 0 || span > MAX_RANGE_MS) {
    throw new ToolError("BAD_TIME_RANGE", "the end must be after the start, and the range must be 31 days or less");
  }
  return { start, end };
}

// Does [start, end) overlap any busy block?
export function clashesWith(busy: { start: string; end: string }[], start: Date, end: Date): boolean {
  return busy.some(
    (block) => start.getTime() < Date.parse(block.end) && end.getTime() > Date.parse(block.start),
  );
}
