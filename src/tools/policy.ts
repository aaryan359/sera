import { createHash } from "node:crypto";
import type { Approval, ActionExecution, Connection, Run, RunConnection, ToolGrant } from "@prisma/client";
import { ApprovalStatus, ConnectionStatus, ExecutionStatus, RunStatus, ToolGrantStatus, ToolKind } from "../db/enums.js";

export class ToolPermissionDenied extends Error {}

export type ToolDefinition = {
  name: string;
  version: number;
  kind: ToolKind;
  // Null is a first-party operation. Connected providers require explicit
  // run linkage, granted scopes, and a user-controlled tool grant.
  provider: string | null;
  requiredScopes: readonly string[];
  validateArgs: (value: unknown) => unknown;
};

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  register(definition: ToolDefinition) {
    if (!definition.name || !Number.isSafeInteger(definition.version) || definition.version < 1) throw new Error("Invalid tool definition");
    const key = `${definition.name}@${definition.version}`;
    if (this.tools.has(key)) throw new Error(`Duplicate tool: ${key}`);
    this.tools.set(key, definition);
  }

  get(name: string, version: number): ToolDefinition {
    const tool = this.tools.get(`${name}@${version}`);
    if (!tool) throw new ToolPermissionDenied("Tool is not registered");
    return tool;
  }
}

export type ConnectionAccess = {
  connection: Pick<Connection, "id" | "userId" | "provider" | "status">;
  runLink: Pick<RunConnection, "runId" | "connectionId" | "userId">;
  scopes: readonly string[];
  grant: Pick<ToolGrant, "toolName" | "toolVersion" | "status" | "expiresAt"> | null;
};

function checkConnection(tool: ToolDefinition, run: Pick<Run, "id" | "userId">, access: ConnectionAccess | null, now: Date) {
  if (tool.provider === null) {
    if (access !== null) throw new ToolPermissionDenied("First-party tool must not use a provider connection");
    return;
  }
  if (!access || access.connection.provider !== tool.provider || access.connection.status !== ConnectionStatus.ACTIVE
    || access.connection.userId !== run.userId || access.runLink.userId !== run.userId
    || access.runLink.runId !== run.id || access.runLink.connectionId !== access.connection.id) {
    throw new ToolPermissionDenied("No active, run-scoped connection for this tool");
  }
  if (tool.requiredScopes.some((scope) => !access.scopes.includes(scope))) throw new ToolPermissionDenied("Missing provider scope");
  if (!access.grant || access.grant.toolName !== tool.name || access.grant.toolVersion !== tool.version
    || access.grant.status !== ToolGrantStatus.ACTIVE
    || (access.grant.expiresAt !== null && access.grant.expiresAt <= now)) {
    throw new ToolPermissionDenied("Tool grant is absent, expired or revoked");
  }
}

// Stable JSON for an immutable action; rejects values that cannot be persisted
// as JSON. Hash binds the exact action to its owner, run, connection and tool.
function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype) {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  throw new ToolPermissionDenied("Action arguments must be JSON values");
}

export function hashApprovedAction(input: {
  userId: string; runId: string; connectionId: string | null;
  toolName: string; toolVersion: number; actionSnapshot: unknown;
}) {
  return createHash("sha256").update(canonicalJson(input)).digest("hex");
}

export function authorizeRead(input: {
  registry: ToolRegistry; actorUserId: string; run: Pick<Run, "id" | "userId" | "status">;
  toolName: string; toolVersion: number; args: unknown; access: ConnectionAccess | null; now?: Date;
}) {
  const tool = input.registry.get(input.toolName, input.toolVersion);
  const readableStates: RunStatus[] = [RunStatus.PLANNING, RunStatus.RUNNING, RunStatus.EVALUATING];
  if (tool.kind !== ToolKind.READ || input.actorUserId !== input.run.userId
    || !readableStates.includes(input.run.status)) {
    throw new ToolPermissionDenied("Read is not allowed for this actor or run state");
  }
  checkConnection(tool, input.run, input.access, input.now ?? new Date());
  return tool.validateArgs(input.args);
}

// Only the executor calls this; the Actor never receives a write-capable API.
// It must use the stored snapshot, not arguments newly proposed by the LLM.
export function authorizeApprovedWrite(input: {
  registry: ToolRegistry; actorUserId: string;
  run: Pick<Run, "id" | "userId" | "status">;
  approval: Pick<Approval, "id" | "runId" | "connectionId" | "toolName" | "toolVersion" | "actionSnapshot" | "actionHash" | "status" | "expiresAt">;
  execution: Pick<ActionExecution, "approvalId" | "status" | "dispatchAttemptCount" | "maxDispatchAttempts" | "providerRequestMarker">;
  access: ConnectionAccess | null; now?: Date;
}) {
  const { run, approval, execution } = input;
  const tool = input.registry.get(approval.toolName, approval.toolVersion);
  const now = input.now ?? new Date();
  if (tool.kind !== ToolKind.WRITE || input.actorUserId !== run.userId || run.status !== RunStatus.EXECUTING
    || approval.runId !== run.id || approval.status !== ApprovalStatus.APPROVED || approval.expiresAt <= now
    || execution.approvalId !== approval.id || execution.status !== ExecutionStatus.PREPARED
    || execution.dispatchAttemptCount !== 0 || execution.maxDispatchAttempts < 1
    || approval.connectionId !== (input.access?.connection.id ?? null)) {
    throw new ToolPermissionDenied("Write is not authorized for this run and approval");
  }
  checkConnection(tool, run, input.access, now);
  if (tool.provider !== null && !execution.providerRequestMarker) throw new ToolPermissionDenied("Provider write needs a stable request marker");
  const expectedHash = hashApprovedAction({
    userId: run.userId, runId: run.id, connectionId: approval.connectionId,
    toolName: approval.toolName, toolVersion: approval.toolVersion, actionSnapshot: approval.actionSnapshot,
  });
  if (approval.actionHash !== expectedHash) throw new ToolPermissionDenied("Approved action was changed");
  const validated = tool.validateArgs(approval.actionSnapshot);
  if (canonicalJson(validated) !== canonicalJson(approval.actionSnapshot)) {
    throw new ToolPermissionDenied("Validation changed the approved arguments");
  }
  return validated;
}
