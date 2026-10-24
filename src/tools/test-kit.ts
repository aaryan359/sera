import assert from "node:assert/strict";
import type { CalendarApi } from "./calendar/client/api.ts";
import { CALENDAR_READ_SCOPE, CALENDAR_WRITE_SCOPE } from "./calendar/scopes.ts";
import type { GmailApi } from "./gmail/client/api.ts";
import { READ_SCOPE, SEND_SCOPE } from "./gmail/scopes.ts";
import { ToolError, type Approval, type ApprovalStore, type Context, type GrantStore } from "./safety.ts";
import type { WebApi } from "./web/client/api.ts";

// Shared test helpers. Only used by *.test.ts files.

const ALL_SCOPES = [READ_SCOPE, SEND_SCOPE, CALENDAR_READ_SCOPE, CALENDAR_WRITE_SCOPE];

export const allowAll: GrantStore = {
  async hasGrant() {
    return true;
  },
  async grantedScopes() {
    return ALL_SCOPES;
  },
};

export function memoryApprovals(): ApprovalStore & { rows: Map<string, Approval> } {
  const rows = new Map<string, Approval>();
  let counter = 0;
  return {
    rows,
    async create(input) {
      const approval: Approval = { ...input, id: `a${++counter}`, status: "PENDING" };
      rows.set(approval.id, approval);
      return approval;
    },
    async get(id) {
      return rows.get(id) ?? null;
    },
    async setStatus(id, status, providerId) {
      const approval = rows.get(id)!;
      approval.status = status;
      if (providerId !== undefined) approval.providerId = providerId;
    },
    async startRun(id) {
      const approval = rows.get(id);
      if (approval?.status !== "APPROVED") return false;
      approval.status = "RUNNING";
      return true;
    },
  };
}

// A context with in-memory stores. Pass a fake for the service a test uses.
export function makeContext(parts: { gmail: GmailApi; calendar: CalendarApi; web?: WebApi; now: Date }) {
  const approvals = memoryApprovals();
  const clock = { now: parts.now };
  const ctx: Context = {
    runId: "r1",
    connectionId: "c1",
    gmail: parts.gmail,
    calendar: parts.calendar,
    web: parts.web ?? unusedWeb(),
    approvals,
    grants: allowAll,
    now: () => clock.now,
  };
  return { ctx, approvals, clock };
}

// Stand-ins for services a test does not use. Calling them fails loudly.
export function unusedGmail(): GmailApi {
  const fail = async (): Promise<never> => {
    throw new Error("Gmail is not used in this test");
  };
  return { searchThreads: fail, getThread: fail, sendRaw: fail, findSentMessage: fail };
}

export function unusedCalendar(): CalendarApi {
  const fail = async (): Promise<never> => {
    throw new Error("Calendar is not used in this test");
  };
  return { listEvents: fail, freeBusy: fail, createEvent: fail, findEventByMarker: fail };
}

export function unusedWeb(): WebApi {
  const fail = async (): Promise<never> => {
    throw new Error("web is not used in this test");
  };
  return { search: fail, fetchPage: fail };
}

export async function expectError(promise: Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(promise, (err: unknown) => err instanceof ToolError && err.code === code);
}
