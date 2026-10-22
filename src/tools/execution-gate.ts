import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { ApprovalStatus, ExecutionStatus, RunStatus, ToolKind } from "../db/enums.js";
import { assertRunTransition } from "../agents/run-state.js";
import { authorizeApprovedWrite, hashApprovedAction, ToolPermissionDenied, type ConnectionAccess, type ToolRegistry } from "./policy.js";

// Atomically claims the one approved action before an adapter may dispatch it.
// An expired IN_FLIGHT claim is reconciled, never automatically claimed again.
export async function claimApprovedExecution(
  db: PrismaClient, registry: ToolRegistry, executionId: string, actorUserId: string,
  workerId: string, now = new Date(), leaseMs = 30_000,
) {
  if (!workerId || leaseMs <= 0) throw new Error("A worker ID and positive lease are required");
  return db.$transaction(async (tx) => {
    const execution = await tx.actionExecution.findUnique({
      where: { id: executionId }, include: { approval: { include: { run: true } } },
    });
    if (!execution) throw new ToolPermissionDenied("Unknown execution");
    const { approval } = execution;
    if (approval.run.leaseOwner !== workerId || !approval.run.leaseExpiresAt || approval.run.leaseExpiresAt <= now) {
      throw new ToolPermissionDenied("Execution worker does not hold the run lease");
    }
    const link = approval.connectionId ? await tx.runConnection.findUnique({
      where: { runId_connectionId: { runId: approval.runId, connectionId: approval.connectionId } },
      include: {
        connection: { include: { scopes: true, toolGrants: { where: { toolName: approval.toolName, toolVersion: approval.toolVersion } } } },
      },
    }) : null;
    const access: ConnectionAccess | null = link ? {
      runLink: link, connection: link.connection, scopes: link.connection.scopes.map((item) => item.scope),
      grant: link.connection.toolGrants[0] ?? null,
    } : null;
    const args = authorizeApprovedWrite({ registry, actorUserId, run: approval.run, approval, execution, access, now });
    const claimed = await tx.actionExecution.updateMany({
      where: { id: executionId, approvalId: approval.id, status: ExecutionStatus.PREPARED, dispatchAttemptCount: 0, leaseOwner: null },
      data: {
        status: ExecutionStatus.IN_FLIGHT, dispatchAttemptCount: { increment: 1 },
        leaseOwner: workerId, leaseExpiresAt: new Date(now.getTime() + leaseMs), startedAt: now,
      },
    });
    if (claimed.count !== 1) throw new ToolPermissionDenied("Action was already claimed");
    return { args, toolName: approval.toolName, toolVersion: approval.toolVersion, connectionId: approval.connectionId };
  });
}

// The authenticated user's decision, outbox row and run transition commit
// together. Repeated decisions cannot create another external action.
export async function decideApproval(
  db: PrismaClient, registry: ToolRegistry, approvalId: string, actorUserId: string,
  decision: "APPROVED" | "REJECTED", now = new Date(),
) {
  return db.$transaction(async (tx) => {
    const approval = await tx.approval.findUnique({
      where: { id: approvalId }, include: { run: true, execution: true },
    });
    if (!approval || approval.run.userId !== actorUserId || approval.status !== ApprovalStatus.PENDING
      || approval.expiresAt <= now || approval.run.status !== RunStatus.AWAITING_APPROVAL
      || approval.execution !== null) {
      throw new ToolPermissionDenied("No pending action for this user and run");
    }
    const tool = registry.get(approval.toolName, approval.toolVersion);
    const expectedHash = hashApprovedAction({ userId: approval.run.userId, runId: approval.runId,
      connectionId: approval.connectionId, toolName: approval.toolName,
      toolVersion: approval.toolVersion, actionSnapshot: approval.actionSnapshot });
    if (tool.kind !== ToolKind.WRITE || expectedHash !== approval.actionHash) {
      throw new ToolPermissionDenied("Proposed action is invalid or changed");
    }
    const to = decision === "APPROVED" ? RunStatus.EXECUTING : RunStatus.CANCELLED;
    assertRunTransition(approval.run.status, to);
    const changedApproval = await tx.approval.updateMany({
      where: { id: approvalId, status: ApprovalStatus.PENDING, expiresAt: { gt: now } },
      data: { status: decision === "APPROVED" ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED, decidedAt: now },
    });
    if (changedApproval.count !== 1) throw new ToolPermissionDenied("Approval changed concurrently");
    // An older proposal in the same run cannot become executable later.
    await tx.approval.updateMany({
      where: { runId: approval.runId, id: { not: approvalId }, status: ApprovalStatus.PENDING },
      data: { status: ApprovalStatus.INVALIDATED },
    });
    const changed = await tx.run.updateMany({
      where: { id: approval.runId, status: RunStatus.AWAITING_APPROVAL, stateVersion: approval.run.stateVersion, leaseOwner: null },
      data: { status: to, stateVersion: { increment: 1 }, statusChangedAt: now,
        ...(to === RunStatus.CANCELLED ? { completedAt: now } : {}) },
    });
    if (changed.count !== 1) throw new ToolPermissionDenied("Approval run changed concurrently");
    if (decision === "APPROVED") {
      await tx.actionExecution.create({
        data: { approvalId, idempotencyKey: randomUUID(),
          providerRequestMarker: tool.provider === null ? null : randomUUID() },
      });
    }
    await tx.runTransition.create({
      data: { runId: approval.runId, version: approval.run.stateVersion + 1,
        fromStatus: RunStatus.AWAITING_APPROVAL, toStatus: to,
        reasonCode: decision === "APPROVED" ? "USER_APPROVED" : "USER_REJECTED" },
    });
  });
}
