import assert from "node:assert/strict";
import { test } from "node:test";
import { formatLocal, localToInstant } from "./zone.ts";

test("Kolkata has no daylight saving: 09:00 local is 03:30 UTC", () => {
  assert.equal(localToInstant("2026-10-27T09:00", "Asia/Kolkata").toISOString(), "2026-10-27T03:30:00.000Z");
});

test("New York in late October is on daylight time (UTC-4)", () => {
  assert.equal(localToInstant("2026-10-27T09:00", "America/New_York").toISOString(), "2026-10-27T13:00:00.000Z");
});

test("New York in January is on standard time (UTC-5)", () => {
  assert.equal(localToInstant("2026-01-15T09:00", "America/New_York").toISOString(), "2026-01-15T14:00:00.000Z");
});

test("formatLocal reverses localToInstant", () => {
  const instant = localToInstant("2026-10-27T09:00", "Asia/Kolkata");
  assert.equal(formatLocal(instant, "Asia/Kolkata"), "2026-10-27T09:00");
});
