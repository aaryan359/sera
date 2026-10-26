import { createHash } from "node:crypto";
import type { z } from "zod";
import type { ApplicationStore } from "./applications/client/store.ts";
import type { CalendarApi } from "./calendar/client/api.ts";
import type { ContactsApi } from "./contacts/client/api.ts";
import type { DriveApi } from "./drive/client/api.ts";
import type { GmailApi } from "./gmail/client/api.ts";
import type { JobsApi } from "./jobs/client/api.ts";
import type { WebApi } from "./web/client/api.ts";



// =====================================================================
// PART 1: Basic words
// =====================================================================

// READ:        only looks at data. The assistant may call it directly.
// PROPOSE:     prepares an action and saves it for approval. Changes nothing outside Sera.
// WRITE_LOCAL: changes only Sera's own records (for example, a job-application log).
//              The assistant may call it directly; nothing leaves Sera.
// EXECUTE:     does the real action outside Sera (sends an email, creates an event).
//              Runs only after the user approves. The assistant can never call it.
export type ToolKind = "READ" | "PROPOSE" | "WRITE_LOCAL" | "EXECUTE";

export type ErrorCode =
  | "UNKNOWN_TOOL"
  | "NOT_CALLABLE_BY_MODEL"
  | "NO_GRANT"
  | "MISSING_SCOPE"
  | "INVALID_INPUT"
  | "INVALID_OUTPUT"
  | "TIMEOUT"
  | "NOT_FOUND"
  | "RECIPIENT_NOT_IN_THREAD"
  | "THREAD_CHANGED"
  | "UNSAFE_HEADER"
  | "BAD_TIME_RANGE"
  | "SLOT_BUSY"
  | "BLOCKED_URL"
  | "FILE_NOT_ALLOWED"
  | "FILE_CHANGED"
  | "APPROVAL_NOT_FOUND"
  | "NOT_APPROVED"
  | "APPROVAL_EXPIRED"
  | "ACTION_CHANGED"
  | "ALREADY_DONE"
  | "AUTH_EXPIRED"
  | "RATE_LIMITED"
  | "PROVIDER_ERROR";

// An error with a code. ambiguous = true means the action MAY have happened
// (for example, a send timed out). Such an action must never be retried automatically.
export class ToolError extends Error {
  readonly code: ErrorCode;
  readonly ambiguous: boolean;

  constructor(code: ErrorCode, message: string, ambiguous = false) {
    super(message);
    this.name = "ToolError";
    this.code = code;
    this.ambiguous = ambiguous;
  }
}

// What every tool looks like. Input and output are zod schemas.
export interface ToolDef {
  name: string; // for example "gmail.search_threads"
  kind: ToolKind;
  description: string; // the assistant reads this to decide when to use the tool
  scopes: string[]; // Google permissions the tool needs
  timeoutMs: number;
  input: z.ZodType;
  output: z.ZodType;
  run: (args: any, ctx: Context) => Promise<any>;
  // Optional. Asks the provider whether an UNKNOWN action happened. Never repeats it.
  reconcile?: (args: any, ctx: Context) => Promise<any>;
}

// Wraps a tool so its input and output types are checked inside its own file.
export function defineTool<I extends z.ZodType, O extends z.ZodType>(tool: {
  name: string;
  kind: ToolKind;
  description: string;
  scopes: string[];
  timeoutMs: number;
  input: I;
  output: O;
  run: (args: z.infer<I>, ctx: Context) => Promise<z.infer<O>>;
  reconcile?: (args: z.infer<I>, ctx: Context) => Promise<z.infer<O> | null>;
}): ToolDef {
  return tool;
}

// =====================================================================
// PART 2: What a tool can use while it runs
// =====================================================================

export interface Context {
  runId: string;
  connectionId: string; // which connected Google account
  gmail: GmailApi;
  calendar: CalendarApi;
  web: WebApi;
  contacts: ContactsApi;
  drive: DriveApi; // Google Drive and Google Docs
  jobs: JobsApi;
  applications: ApplicationStore; // the user's job-application log
  approvals: ApprovalStore;
  grants: GrantStore;
  now: () => Date;
}




// Which tools the user has allowed, and which Google permissions the account gave.
export interface GrantStore {
  hasGrant(connectionId: string, toolName: string): Promise<boolean>;
  grantedScopes(connectionId: string): Promise<string[]>;
}




export type ApprovalStatus = | "PENDING" | "APPROVED" | "REJECTED" | "RUNNING" | "DONE" | "UNKNOWN" | "FAILED";



// One proposed action, saved until the user decides and it runs.
export interface Approval {
  id: string;
  runId: string;
  connectionId: string;
  toolName: string;
  args: Record<string, unknown>; // exactly what the user was shown
  fingerprint: string; // detects any change to args after approval
  status: ApprovalStatus;
  expiresAt: Date;
  providerId?: string | undefined; // the id Google gave the new item
}



export interface ApprovalStore {
  create(input: Omit<Approval, "id" | "status" | "providerId">): Promise<Approval>;
  get(id: string): Promise<Approval | null>;
  setStatus(id: string, status: ApprovalStatus, providerId?: string): Promise<void>;
  // Changes APPROVED to RUNNING in one atomic step.
  // Returns false if it was not APPROVED, so a duplicate request cannot run twice.
  startRun(id: string): Promise<boolean>;
}

// =====================================================================
// PART 3: The tool list
// =====================================================================

export interface Registry {
  get(name: string): ToolDef;
  forModel(): ToolDef[]; // tools the assistant may call directly
}

export function createRegistry(tools: ToolDef[]): Registry {
  const byName = new Map<string, ToolDef>();
  for (const tool of tools) {
    if (byName.has(tool.name)) throw new Error(`duplicate tool: ${tool.name}`);
    byName.set(tool.name, tool);
  }
  return {
    get(name) {
      const tool = byName.get(name);
      if (!tool) throw new ToolError("UNKNOWN_TOOL", `unknown tool: ${name}`);
      return tool;
    },
    forModel() {
      return [...byName.values()].filter((tool) => tool.kind !== "EXECUTE");
    },
  };
}

// =====================================================================
// PART 4: The only entry point the assistant uses
// =====================================================================

// Checks run in this order: tool exists, not a send tool, input valid,
// permission granted, run with a time limit, output valid.
export async function callTool(
  registry: Registry,
  name: string,
  rawArgs: unknown,
  ctx: Context,
): Promise<unknown> {
  const tool = registry.get(name);
  if (tool.kind === "EXECUTE") {
    throw new ToolError("NOT_CALLABLE_BY_MODEL", `${name} runs only after the user approves it`);
  }
  const args = checkShape(tool.input, rawArgs, "INVALID_INPUT");
  await checkPermission(tool, ctx);
  const result = await runWithTimeout(tool.run(args, ctx), tool.timeoutMs, tool.name, false);
  return checkShape(tool.output, result, "INVALID_OUTPUT");
}

// =====================================================================
// PART 5: Writes happen in two steps: propose, then run after approval
// =====================================================================

const APPROVAL_MINUTES = 30;

// Step 1: save the exact action so the user can approve it. Sends nothing.
export async function requestApproval(
  ctx: Context,
  toolName: string,
  args: Record<string, unknown>,
): Promise<Approval> {
  const expiresAt = new Date(ctx.now().getTime() + APPROVAL_MINUTES * 60_000);
  return ctx.approvals.create({
    runId: ctx.runId,
    connectionId: ctx.connectionId,
    toolName,
    args,
    fingerprint: fingerprint(ctx.connectionId, toolName, args),
    expiresAt,
  });
}

// Step 2: run the approved action, exactly once.
export async function runApproved(approvalId: string, registry: Registry, ctx: Context): Promise<any> {
  const approval = await ctx.approvals.get(approvalId);
  if (!approval || approval.runId !== ctx.runId || approval.connectionId !== ctx.connectionId) {
    throw new ToolError("APPROVAL_NOT_FOUND", "no approval for this run");
  }
  if (approval.status === "DONE") throw new ToolError("ALREADY_DONE", "this action already ran");
  if (approval.status !== "APPROVED") {
    throw new ToolError("NOT_APPROVED", `this action is ${approval.status}, not approved`);
  }
  if (approval.expiresAt.getTime() <= ctx.now().getTime()) {
    throw new ToolError("APPROVAL_EXPIRED", "the approval expired; propose again");
  }

  const tool = registry.get(approval.toolName);
  if (tool.kind !== "EXECUTE") throw new ToolError("UNKNOWN_TOOL", `${tool.name} is not an action`);

  // If anything in the saved action changed, do not run it.
  if (fingerprint(approval.connectionId, approval.toolName, approval.args) !== approval.fingerprint) {
    throw new ToolError("ACTION_CHANGED", "the details changed after approval; propose again");
  }

  const args = checkShape(tool.input, approval.args, "INVALID_INPUT");
  await checkPermission(tool, ctx); // checked again right before the write

  // Only one caller can move APPROVED to RUNNING. A duplicate request fails here.
  if (!(await ctx.approvals.startRun(approvalId))) {
    throw new ToolError("ALREADY_DONE", "this action is already running");
  }

  let result: any;
  try {
    result = await runWithTimeout(tool.run(args, ctx), tool.timeoutMs, tool.name, true);
  } catch (err) {
    // If the write might have happened, mark it UNKNOWN. Never repeat it automatically.
    const mightHaveHappened = err instanceof ToolError && err.ambiguous;
    await ctx.approvals.setStatus(approvalId, mightHaveHappened ? "UNKNOWN" : "FAILED");
    throw err;
  }

  // The write succeeded: record it before checking the output shape.
  await ctx.approvals.setStatus(approvalId, "DONE", result?.providerId);
  return checkShape(tool.output, result, "INVALID_OUTPUT");
}

// For an UNKNOWN action: asks the provider whether it happened. Never repeats it.
export async function reconcileApproval(approvalId: string, registry: Registry, ctx: Context): Promise<any> {
  const approval = await ctx.approvals.get(approvalId);
  if (!approval || approval.status !== "UNKNOWN") {
    throw new ToolError("NOT_APPROVED", "only UNKNOWN actions can be checked");
  }
  const tool = registry.get(approval.toolName);
  if (!tool.reconcile) {
    throw new ToolError("PROVIDER_ERROR", "this action cannot be checked automatically");
  }
  const args = checkShape(tool.input, approval.args, "INVALID_INPUT");
  const found = await tool.reconcile(args, ctx);
  if (found) await ctx.approvals.setStatus(approvalId, "DONE", found.providerId);
  return found;
}

// =====================================================================
// Small helpers
// =====================================================================

// A fingerprint of the exact action. Any change to it changes the fingerprint.
export function fingerprint(connectionId: string, toolName: string, args: unknown): string {
  const text = JSON.stringify(sortKeys({ connectionId, toolName, args }));
  return createHash("sha256").update(text).digest("hex");
}

// The database can reorder JSON keys, so sort them before hashing.
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(obj).sort().map((key) => [key, sortKeys(obj[key])]));
  }
  return value;
}

// Throws if the value does not match the schema. Returns the cleaned value.
export function checkShape(schema: z.ZodType, value: unknown, code: ErrorCode): any {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ToolError(code, result.error.issues.map((issue) => issue.message).join("; "));
  }
  return result.data;
}

// The user must have allowed the tool, and the account must have every scope it needs.
export async function checkPermission(tool: ToolDef, ctx: Context): Promise<void> {
  if (!(await ctx.grants.hasGrant(ctx.connectionId, tool.name))) {
    throw new ToolError("NO_GRANT", `the user has not allowed ${tool.name}`);
  }
  const granted = await ctx.grants.grantedScopes(ctx.connectionId);
  const missing = tool.scopes.filter((scope) => !granted.includes(scope));
  if (missing.length > 0) {
    throw new ToolError("MISSING_SCOPE", `${tool.name} needs: ${missing.join(", ")}`);
  }
}

// Gives up after `ms`. For a write, a timeout is ambiguous: the write may still succeed.
export async function runWithTimeout<T>(
  work: Promise<T>,
  ms: number,
  name: string,
  isWrite: boolean,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new ToolError("TIMEOUT", `${name} took longer than ${ms} ms`, isWrite)),
      ms,
    );
  });
  try {
    return await Promise.race([work, limit]);
  } finally {
    clearTimeout(timer);
  }
}
