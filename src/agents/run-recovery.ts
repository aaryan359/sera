import type { PrismaClient } from "@prisma/client";
import { ExecutionStatus, RunStatus } from "../db/enums.js";
import { assertRunTransition, decideExpiredRun } from "./run-state.js";

const leasedStates: RunStatus[] = [
  RunStatus.PLANNING, RunStatus.RUNNING, RunStatus.EVALUATING,
  RunStatus.REFLECTING, RunStatus.REPLANNING, RunStatus.EXECUTING, RunStatus.VERIFYING,
];
const terminalStates: RunStatus[] = [RunStatus.COMPLETED, RunStatus.FAILED, RunStatus.CANCELLED];

export class RunConflict extends Error {}

// Claiming a queued run and writing its transition are atomic. A duplicate
// queue delivery cannot claim the same run while its lease is valid.
export async function claimRun(db: PrismaClient, runId: string, workerId: string, now = new Date(), leaseMs = 30_000) {
  if (!workerId || leaseMs <= 0) throw new Error("A worker ID and positive lease are required");
  return db.$transaction(async (tx) => {
    const run = await tx.run.findUnique({ where: { id: runId } });
    if (!run || run.status !== RunStatus.QUEUED || (run.nextAttemptAt && run.nextAttemptAt > now)) return false;
    if (run.deadlineAt && run.deadlineAt <= now) {
      assertRunTransition(run.status, RunStatus.FAILED);
      const expired = await tx.run.updateMany({
        where: { id: runId, status: RunStatus.QUEUED, stateVersion: run.stateVersion },
        data: { status: RunStatus.FAILED, stateVersion: { increment: 1 }, statusChangedAt: now,
          completedAt: now, errorCode: "DEADLINE_EXCEEDED" },
      });
      if (expired.count === 1) await tx.runTransition.create({
        data: { runId, version: run.stateVersion + 1, fromStatus: RunStatus.QUEUED,
          toStatus: RunStatus.FAILED, reasonCode: "DEADLINE_EXCEEDED", workerId },
      });
      return false;
    }
    assertRunTransition(run.status, RunStatus.PLANNING);
    const updated = await tx.run.updateMany({
      where: { id: runId, status: RunStatus.QUEUED, stateVersion: run.stateVersion, leaseOwner: null },
      data: {
        status: RunStatus.PLANNING, stateVersion: { increment: 1 }, statusChangedAt: now,
        leaseOwner: workerId, leaseExpiresAt: new Date(now.getTime() + leaseMs),
        lastHeartbeatAt: now, nextAttemptAt: null,
      },
    });
    if (updated.count !== 1) return false;
    await tx.runTransition.create({
      data: { runId, version: run.stateVersion + 1, fromStatus: run.status, toStatus: RunStatus.PLANNING, workerId },
    });
    return true;
  });
}

export async function heartbeatRun(db: PrismaClient, runId: string, workerId: string, now = new Date(), leaseMs = 30_000) {
  if (!workerId || leaseMs <= 0) throw new Error("A worker ID and positive lease are required");
  const updated = await db.run.updateMany({
    where: { id: runId, leaseOwner: workerId, leaseExpiresAt: { gt: now }, status: { in: leasedStates } },
    data: { leaseExpiresAt: new Date(now.getTime() + leaseMs), lastHeartbeatAt: now },
  });
  return updated.count === 1;
}

// Approval decisions move a run to EXECUTING without a worker. A worker must
// claim that state before it can claim the corresponding provider write.
export async function claimExecutionRun(db: PrismaClient, runId: string, workerId: string, now = new Date(), leaseMs = 30_000) {
  if (!workerId || leaseMs <= 0) throw new Error("A worker ID and positive lease are required");
  const updated = await db.run.updateMany({
    where: { id: runId, status: RunStatus.EXECUTING, leaseOwner: null },
    data: { leaseOwner: workerId, leaseExpiresAt: new Date(now.getTime() + leaseMs), lastHeartbeatAt: now },
  });
  return updated.count === 1;
}

// Worker-owned transitions use compare-and-swap. Pausing for the user or
// finishing the task releases the lease in the same transaction.
export async function transitionWorkerRun(
  db: PrismaClient, runId: string, workerId: string, to: RunStatus, reasonCode?: string, now = new Date(),
) {
  return db.$transaction(async (tx) => {
    const run = await tx.run.findUnique({ where: { id: runId } });
    if (!run || run.leaseOwner !== workerId || !run.leaseExpiresAt || run.leaseExpiresAt <= now) throw new RunConflict("Worker lease is missing or expired");
    assertRunTransition(run.status, to);
    const release = !leasedStates.includes(to);
    const updated = await tx.run.updateMany({
      where: { id: runId, status: run.status, stateVersion: run.stateVersion, leaseOwner: workerId, leaseExpiresAt: { gt: now } },
      data: {
        status: to, stateVersion: { increment: 1 }, statusChangedAt: now,
        ...(release ? { leaseOwner: null, leaseExpiresAt: null } : {}),
        ...(reasonCode ? { errorCode: reasonCode } : {}),
        ...(terminalStates.includes(to) ? { completedAt: now } : {}),
      },
    });
    if (updated.count !== 1) throw new RunConflict("Run changed while transitioning");
    await tx.runTransition.create({
      data: { runId, version: run.stateVersion + 1, fromStatus: run.status, toStatus: to, reasonCode: reasonCode ?? null, workerId },
    });
  });
}

// Run at startup and periodically. Read-only/pre-write work may be requeued;
// an interrupted external write is quarantined, never dispatched again here.
export async function recoverExpiredRuns(db: PrismaClient, now = new Date(), limit = 100) {
  const candidates = await db.run.findMany({
    where: { status: { in: leasedStates }, leaseExpiresAt: { lte: now } },
    orderBy: { leaseExpiresAt: "asc" }, take: limit, select: { id: true },
  });
  const recovered: Array<{ runId: string; status: RunStatus }> = [];
  for (const candidate of candidates) {
    const result = await db.$transaction(async (tx) => {
      const run = await tx.run.findUnique({ where: { id: candidate.id } });
      if (!run?.leaseExpiresAt || run.leaseExpiresAt > now || !leasedStates.includes(run.status)) return null;
      const decision = run.deadlineAt && run.deadlineAt <= now && run.status !== RunStatus.EXECUTING && run.status !== RunStatus.VERIFYING
        ? "FAIL" : decideExpiredRun(run.status, run.retryCount, run.maxRetries);
      if (decision === "SKIP") return null;
      const to = decision === "RETRY" ? RunStatus.QUEUED : decision === "FAIL" ? RunStatus.FAILED : RunStatus.OUTCOME_UNKNOWN;
      assertRunTransition(run.status, to);
      const nextAttemptAt = decision === "RETRY"
        ? new Date(now.getTime() + Math.min(60_000, 1_000 * 2 ** run.retryCount)) : null;
      const updated = await tx.run.updateMany({
        where: { id: run.id, status: run.status, stateVersion: run.stateVersion, leaseOwner: run.leaseOwner, leaseExpiresAt: { lte: now } },
        data: {
          status: to, stateVersion: { increment: 1 }, statusChangedAt: now,
          leaseOwner: null, leaseExpiresAt: null, nextAttemptAt,
          retryCount: decision === "RETRY" ? { increment: 1 } : run.retryCount,
          errorCode: decision === "RECONCILE" ? "WRITE_OUTCOME_UNCERTAIN"
            : decision === "FAIL" ? (run.deadlineAt && run.deadlineAt <= now ? "DEADLINE_EXCEEDED" : "RETRY_LIMIT_REACHED") : null,
          ...(to === RunStatus.FAILED ? { completedAt: now } : {}),
        },
      });
      if (updated.count !== 1) return null;
      if (decision === "RECONCILE") {
        await tx.actionExecution.updateMany({
          where: { approval: { runId: run.id }, status: ExecutionStatus.IN_FLIGHT },
          data: { status: ExecutionStatus.OUTCOME_UNKNOWN, leaseOwner: null, leaseExpiresAt: null, reconcileAfterAt: now },
        });
      }
      await tx.runTransition.create({
        data: { runId: run.id, version: run.stateVersion + 1, fromStatus: run.status, toStatus: to,
          reasonCode: decision === "RECONCILE" ? "WRITE_OUTCOME_UNCERTAIN"
            : decision === "FAIL" ? (run.deadlineAt && run.deadlineAt <= now ? "DEADLINE_EXCEEDED" : "RETRY_LIMIT_REACHED") : "LEASE_EXPIRED" },
      });
      return { runId: run.id, status: to };
    });
    if (result) recovered.push(result);
  }
  return recovered;
}

// A provider call can time out while its run heartbeat is still alive. Its
// execution lease has an independent recovery path and is never auto-replayed.
export async function quarantineExpiredExecutions(db: PrismaClient, now = new Date(), limit = 100) {
  const candidates = await db.actionExecution.findMany({
    where: { status: ExecutionStatus.IN_FLIGHT, leaseExpiresAt: { lte: now } },
    orderBy: { leaseExpiresAt: "asc" }, take: limit, select: { id: true },
  });
  const quarantined: string[] = [];
  for (const candidate of candidates) {
    const changed = await db.$transaction(async (tx) => {
      const execution = await tx.actionExecution.findUnique({
        where: { id: candidate.id }, include: { approval: { include: { run: true } } },
      });
      if (!execution?.leaseExpiresAt || execution.leaseExpiresAt > now || execution.status !== ExecutionStatus.IN_FLIGHT) return false;
      const run = execution.approval.run;
      const isActive = run.status === RunStatus.EXECUTING || run.status === RunStatus.VERIFYING;
      if (isActive) {
        assertRunTransition(run.status, RunStatus.OUTCOME_UNKNOWN);
        const updated = await tx.run.updateMany({
          where: { id: run.id, status: run.status, stateVersion: run.stateVersion },
          data: { status: RunStatus.OUTCOME_UNKNOWN, stateVersion: { increment: 1 }, statusChangedAt: now,
            leaseOwner: null, leaseExpiresAt: null, errorCode: "WRITE_OUTCOME_UNCERTAIN" },
        });
        if (updated.count !== 1) return false;
        await tx.runTransition.create({ data: { runId: run.id, version: run.stateVersion + 1,
          fromStatus: run.status, toStatus: RunStatus.OUTCOME_UNKNOWN, reasonCode: "WRITE_OUTCOME_UNCERTAIN" } });
      }
      const updated = await tx.actionExecution.updateMany({
        where: { id: execution.id, status: ExecutionStatus.IN_FLIGHT, leaseExpiresAt: { lte: now } },
        data: { status: ExecutionStatus.OUTCOME_UNKNOWN, leaseOwner: null, leaseExpiresAt: null, reconcileAfterAt: now },
      });
      if (updated.count !== 1) throw new RunConflict("Execution changed while quarantining");
      return true;
    });
    if (changed) quarantined.push(candidate.id);
  }
  return quarantined;
}
