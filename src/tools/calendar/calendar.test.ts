import assert from "node:assert/strict";
import { test } from "node:test";
import { callTool, registry } from "../index.ts";
import { reconcileApproval, runApproved, ToolError, type Context } from "../safety.ts";
import { expectError, makeContext, unusedGmail } from "../test-kit.ts";
import type { BusyBlock, CalendarApi, NewEvent } from "./client/api.ts";

// ---------- a fake Google Calendar ----------

class FakeCalendar implements CalendarApi {
  busy: BusyBlock[] = [];
  created: NewEvent[] = [];
  failAfterWrite = false; // the event is created, but the caller gets a timeout
  private byMarker = new Map<string, { eventId: string; link: string }>();

  async listEvents() {
    return [];
  }

  async freeBusy(timeMin: string, timeMax: string) {
    return this.busy.filter((b) => b.start < timeMax && b.end > timeMin);
  }

  async createEvent(event: NewEvent) {
    const eventId = `evt${this.created.length + 1}`;
    const link = `https://calendar.example/${eventId}`;
    this.created.push(event);
    this.byMarker.set(event.marker, { eventId, link });
    this.busy.push({ start: event.start, end: event.end });
    if (this.failAfterWrite) {
      this.failAfterWrite = false;
      throw new ToolError("PROVIDER_ERROR", "timed out", true);
    }
    return { eventId, link };
  }

  async findEventByMarker(marker: string) {
    return this.byMarker.get(marker) ?? null;
  }
}

function world(now = "2026-10-24T00:00:00Z") {
  const calendar = new FakeCalendar();
  const { ctx, approvals } = makeContext({ gmail: unusedGmail(), calendar, now: new Date(now) });
  return { calendar, ctx, approvals };
}

async function propose(ctx: Context, start: string, end: string): Promise<string> {
  const out = (await callTool(
    registry,
    "calendar.propose_event",
    { title: "Catch-up with Maya", start, end, timeZone: "UTC" },
    ctx,
  )) as { approvalId: string };
  return out.approvalId;
}

// ---------- finding slots ----------

test("find_slots skips busy time and returns the first free half-hours", async () => {
  const { calendar, ctx } = world();
  calendar.busy.push({ start: "2026-10-26T09:00:00.000Z", end: "2026-10-26T10:00:00.000Z" });
  const out = (await callTool(
    registry,
    "calendar.find_slots",
    { from: "2026-10-26T09:00", to: "2026-10-26T12:00", timeZone: "UTC", count: 3 },
    ctx,
  )) as { slots: { start: string; end: string }[] };

  assert.equal(out.slots.length, 3);
  assert.deepEqual(out.slots[0], { start: "2026-10-26T10:00", end: "2026-10-26T10:30" });
  assert.equal(out.slots[2]?.start, "2026-10-26T11:00");
});

test("find_slots returns nothing outside working hours", async () => {
  const { ctx } = world();
  const out = (await callTool(
    registry,
    "calendar.find_slots",
    { from: "2026-10-26T06:00", to: "2026-10-26T08:00", timeZone: "UTC" },
    ctx,
  )) as { slots: unknown[] };
  assert.deepEqual(out.slots, []);
});

test("an unknown time zone is rejected", async () => {
  const { ctx } = world();
  await expectError(
    callTool(registry, "calendar.find_slots", { from: "2026-10-26T09:00", to: "2026-10-26T12:00", timeZone: "Mars/Olympus" }, ctx),
    "INVALID_INPUT",
  );
});

// ---------- proposing and creating ----------

test("propose refuses a busy time and stores nothing", async () => {
  const { calendar, ctx, approvals } = world();
  calendar.busy.push({ start: "2026-10-26T10:00:00.000Z", end: "2026-10-26T11:00:00.000Z" });
  await expectError(propose(ctx, "2026-10-26T10:30", "2026-10-26T11:30").then(() => undefined), "SLOT_BUSY");
  assert.equal(approvals.rows.size, 0);
});

test("propose refuses a start time in the past", async () => {
  const { ctx } = world();
  await expectError(propose(ctx, "2026-10-01T10:00", "2026-10-01T10:30"), "BAD_TIME_RANGE");
});

test("propose refuses an event longer than 8 hours", async () => {
  const { ctx } = world();
  await expectError(propose(ctx, "2026-10-26T10:00", "2026-10-26T19:30"), "BAD_TIME_RANGE");
});

test("an approved event is created exactly once", async () => {
  const { calendar, ctx } = world();
  const id = await propose(ctx, "2026-10-26T14:00", "2026-10-26T14:30");
  await ctx.approvals.setStatus(id, "APPROVED");

  const result = await runApproved(id, registry, ctx);
  assert.equal(calendar.created.length, 1);
  assert.equal(result.link, "https://calendar.example/evt1");

  await expectError(runApproved(id, registry, ctx), "ALREADY_DONE");
  assert.equal(calendar.created.length, 1);
});

test("if the slot was taken after approval, nothing is created", async () => {
  const { calendar, ctx, approvals } = world();
  const id = await propose(ctx, "2026-10-26T14:00", "2026-10-26T14:30");
  calendar.busy.push({ start: "2026-10-26T14:00:00.000Z", end: "2026-10-26T14:30:00.000Z" });
  await ctx.approvals.setStatus(id, "APPROVED");

  await expectError(runApproved(id, registry, ctx), "SLOT_BUSY");
  assert.equal(calendar.created.length, 0);
  assert.equal(approvals.rows.get(id)?.status, "FAILED");
});

test("a create that times out is marked UNKNOWN, not repeated, and can be checked", async () => {
  const { calendar, ctx, approvals } = world();
  const id = await propose(ctx, "2026-10-26T14:00", "2026-10-26T14:30");
  await ctx.approvals.setStatus(id, "APPROVED");
  calendar.failAfterWrite = true;

  await assert.rejects(runApproved(id, registry, ctx), (err: unknown) => err instanceof ToolError && err.ambiguous);
  assert.equal(approvals.rows.get(id)?.status, "UNKNOWN");
  assert.equal(calendar.created.length, 1); // the event was created

  await expectError(runApproved(id, registry, ctx), "NOT_APPROVED"); // no duplicate
  const found = await reconcileApproval(id, registry, ctx);
  assert.equal(found.providerId, "evt1");
  assert.equal(approvals.rows.get(id)?.status, "DONE");
  assert.equal(calendar.created.length, 1);
});

// ---------- time zones ----------

test("time.now reports the local time and weekday in the user's zone", async () => {
  const { ctx } = world("2026-10-24T10:00:00Z");
  const out = (await callTool(registry, "time.now", { timeZone: "Asia/Kolkata" }, ctx)) as {
    local: string;
    weekday: string;
  };
  assert.equal(out.local, "2026-10-24T15:30");
  assert.equal(out.weekday, "Saturday");
});
