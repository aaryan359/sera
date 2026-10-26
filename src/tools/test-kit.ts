import assert from "node:assert/strict";
import type { ApplicationStore } from "./applications/client/store.ts";
import { createMemoryApplicationStore } from "./applications/client/store.ts";
import type { CalendarApi } from "./calendar/client/api.ts";
import { CALENDAR_READ_SCOPE, CALENDAR_WRITE_SCOPE } from "./calendar/scopes.ts";
import type { ContactsApi } from "./contacts/client/api.ts";
import { CONTACTS_READ_SCOPE } from "./contacts/scopes.ts";
import type { DriveApi } from "./drive/client/api.ts";
import { DOCS_READ_SCOPE, DOCS_WRITE_SCOPE, DRIVE_READ_SCOPE } from "./drive/scopes.ts";
import type { GmailApi } from "./gmail/client/api.ts";
import { READ_SCOPE, SEND_SCOPE } from "./gmail/scopes.ts";
import type { JobsApi } from "./jobs/client/api.ts";
import { ToolError, type Approval, type ApprovalStore, type Context, type GrantStore } from "./safety.ts";
import type { WebApi } from "./web/client/api.ts";

// Shared test helpers. Only used by *.test.ts files.

const ALL_SCOPES = [
  READ_SCOPE,
  SEND_SCOPE,
  CALENDAR_READ_SCOPE,
  CALENDAR_WRITE_SCOPE,
  CONTACTS_READ_SCOPE,
  DRIVE_READ_SCOPE,
  DOCS_READ_SCOPE,
  DOCS_WRITE_SCOPE,
];

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

// A stand-in for a service a test does not use. Calling any method fails loudly.
export function unused<T>(name: string): T {
  return new Proxy(
    {},
    {
      get: () => async () => {
        throw new Error(`${name} is not used in this test`);
      },
    },
  ) as T;
}

export const unusedGmail = () => unused<GmailApi>("Gmail");
export const unusedCalendar = () => unused<CalendarApi>("Calendar");
export const unusedWeb = () => unused<WebApi>("web");
export const unusedContacts = () => unused<ContactsApi>("Contacts");
export const unusedDrive = () => unused<DriveApi>("Drive");
export const unusedJobs = () => unused<JobsApi>("Jobs");

// A context with in-memory stores. Pass a fake for each service a test uses.
export function makeContext(parts: {
  gmail?: GmailApi;
  calendar?: CalendarApi;
  web?: WebApi;
  contacts?: ContactsApi;
  drive?: DriveApi;
  jobs?: JobsApi;
  applications?: ApplicationStore;
  now: Date;
}) {
  const approvals = memoryApprovals();
  const clock = { now: parts.now };
  const ctx: Context = {
    runId: "r1",
    connectionId: "c1",
    gmail: parts.gmail ?? unusedGmail(),
    calendar: parts.calendar ?? unusedCalendar(),
    web: parts.web ?? unusedWeb(),
    contacts: parts.contacts ?? unusedContacts(),
    drive: parts.drive ?? unusedDrive(),
    jobs: parts.jobs ?? unusedJobs(),
    applications: parts.applications ?? createMemoryApplicationStore(),
    approvals,
    grants: allowAll,
    now: () => clock.now,
  };
  return { ctx, approvals, clock };
}

export async function expectError(promise: Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(promise, (err: unknown) => err instanceof ToolError && err.code === code);
}
