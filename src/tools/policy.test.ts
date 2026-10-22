import assert from "node:assert/strict";
import { test } from "node:test";
import { ApprovalStatus, ConnectionStatus, ExecutionStatus, RunStatus, ToolGrantStatus, ToolKind } from "../db/enums.js";
import { authorizeApprovedWrite, authorizeRead, hashApprovedAction, ToolPermissionDenied, ToolRegistry } from "./policy.js";

const now = new Date("2026-10-23T12:00:00.000Z");
const registry = new ToolRegistry();
registry.register({ name: "gmail.getThread", version: 1, kind: ToolKind.READ,
  provider: "GOOGLE", requiredScopes: ["gmail.readonly"], validateArgs: (value) => value });
registry.register({ name: "gmail.sendReply", version: 1, kind: ToolKind.WRITE,
  provider: "GOOGLE", requiredScopes: ["gmail.send"], validateArgs: (value) => value });

const run = { id: "run-1", userId: "user-1", status: RunStatus.RUNNING };
const access = {
  connection: { id: "conn-1", userId: "user-1", provider: "GOOGLE", status: ConnectionStatus.ACTIVE },
  runLink: { runId: "run-1", connectionId: "conn-1", userId: "user-1" },
  scopes: ["gmail.readonly", "gmail.send"],
  grant: { toolName: "gmail.getThread", toolVersion: 1, status: ToolGrantStatus.ACTIVE, expiresAt: null },
};

test("read calls require registered read tools, the right owner, scope and grant", () => {
  const input = { registry, actorUserId: "user-1", run, toolName: "gmail.getThread", toolVersion: 1,
    args: { threadId: "t1" }, access, now };
  assert.deepEqual(authorizeRead(input), { threadId: "t1" });
  assert.throws(() => authorizeRead({ ...input, actorUserId: "user-2" }), ToolPermissionDenied);
  assert.throws(() => authorizeRead({ ...input, toolName: "gmail.sendReply" }), ToolPermissionDenied);
  assert.throws(() => authorizeRead({ ...input, toolName: "shell.run" }), ToolPermissionDenied);
  assert.throws(() => authorizeRead({ ...input, access: { ...access, scopes: [] } }), ToolPermissionDenied);
  assert.throws(() => authorizeRead({ ...input, access: { ...access, connection: { ...access.connection, userId: "user-2" } } }), ToolPermissionDenied);
  assert.throws(() => authorizeRead({ ...input, access: { ...access, grant: { ...access.grant, status: ToolGrantStatus.REVOKED } } }), ToolPermissionDenied);
});

test("approved writes are bound to the exact action, user, tool and connection", () => {
  const actionSnapshot = { to: "maya@example.com", body: "Tuesday at 11:30?" };
  const approvedRun = { ...run, status: RunStatus.EXECUTING };
  const approval = {
    id: "approval-1", runId: run.id, connectionId: "conn-1", toolName: "gmail.sendReply", toolVersion: 1,
    actionSnapshot, actionHash: hashApprovedAction({ userId: run.userId, runId: run.id,
      connectionId: "conn-1", toolName: "gmail.sendReply", toolVersion: 1, actionSnapshot }),
    status: ApprovalStatus.APPROVED, expiresAt: new Date("2026-10-23T13:00:00.000Z"),
  };
  const execution = { approvalId: approval.id, status: ExecutionStatus.PREPARED,
    dispatchAttemptCount: 0, maxDispatchAttempts: 1, providerRequestMarker: "stable-marker" };
  const writeAccess = { ...access, grant: { ...access.grant, toolName: "gmail.sendReply" } };
  const input = { registry, actorUserId: run.userId, run: approvedRun, approval, execution, access: writeAccess, now };
  assert.deepEqual(authorizeApprovedWrite(input), actionSnapshot);
  assert.throws(() => authorizeApprovedWrite({ ...input, approval: { ...approval, actionSnapshot: { ...actionSnapshot, to: "attacker@example.com" } } }), ToolPermissionDenied);
  assert.throws(() => authorizeApprovedWrite({ ...input, approval: { ...approval, status: ApprovalStatus.REJECTED } }), ToolPermissionDenied);
  assert.throws(() => authorizeApprovedWrite({ ...input, approval: { ...approval, expiresAt: now } }), ToolPermissionDenied);
  assert.throws(() => authorizeApprovedWrite({ ...input, execution: { ...execution, status: ExecutionStatus.OUTCOME_UNKNOWN } }), ToolPermissionDenied);
  assert.throws(() => authorizeApprovedWrite({ ...input, execution: { ...execution, dispatchAttemptCount: 1 } }), ToolPermissionDenied);
  assert.throws(() => authorizeApprovedWrite({ ...input, execution: { ...execution, providerRequestMarker: null } }), ToolPermissionDenied);
  assert.throws(() => authorizeApprovedWrite({ ...input, access: { ...writeAccess, grant: { ...writeAccess.grant, status: ToolGrantStatus.REVOKED } } }), ToolPermissionDenied);
});
