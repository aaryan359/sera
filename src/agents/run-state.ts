import { RunStatus } from "../db/enums.js";

// The runtime, not the model, owns this graph. Recovery transitions to QUEUED
// are permitted only for pre-write work; executing writes go to OUTCOME_UNKNOWN.
const transitions: Record<RunStatus, readonly RunStatus[]> = {
  QUEUED: [RunStatus.PLANNING, RunStatus.CANCELLED, RunStatus.FAILED],
  PLANNING: [RunStatus.RUNNING, RunStatus.NEEDS_CLARIFICATION, RunStatus.QUEUED, RunStatus.CANCELLED, RunStatus.FAILED],
  RUNNING: [RunStatus.EVALUATING, RunStatus.NEEDS_CLARIFICATION, RunStatus.QUEUED, RunStatus.CANCELLED, RunStatus.FAILED],
  EVALUATING: [RunStatus.AWAITING_APPROVAL, RunStatus.REFLECTING, RunStatus.NEEDS_CLARIFICATION, RunStatus.COMPLETED, RunStatus.QUEUED, RunStatus.CANCELLED, RunStatus.FAILED],
  REFLECTING: [RunStatus.REPLANNING, RunStatus.NEEDS_CLARIFICATION, RunStatus.QUEUED, RunStatus.CANCELLED, RunStatus.FAILED],
  REPLANNING: [RunStatus.RUNNING, RunStatus.QUEUED, RunStatus.CANCELLED, RunStatus.FAILED],
  NEEDS_CLARIFICATION: [RunStatus.QUEUED, RunStatus.CANCELLED, RunStatus.FAILED],
  AWAITING_APPROVAL: [RunStatus.EXECUTING, RunStatus.QUEUED, RunStatus.CANCELLED, RunStatus.FAILED],
  EXECUTING: [RunStatus.VERIFYING, RunStatus.OUTCOME_UNKNOWN, RunStatus.FAILED],
  VERIFYING: [RunStatus.COMPLETED, RunStatus.OUTCOME_UNKNOWN, RunStatus.FAILED],
  OUTCOME_UNKNOWN: [RunStatus.VERIFYING, RunStatus.FAILED],
  COMPLETED: [],
  CANCELLED: [],
  FAILED: [],
};

export class InvalidRunTransition extends Error {
  constructor(from: RunStatus, to: RunStatus) {
    super(`Invalid run transition: ${from} -> ${to}`);
  }
}

export function assertRunTransition(from: RunStatus, to: RunStatus): void {
  if (!transitions[from].includes(to)) throw new InvalidRunTransition(from, to);
}

export type RecoveryDecision = "SKIP" | "RETRY" | "FAIL" | "RECONCILE";

const retryableStatuses: RunStatus[] = [
  RunStatus.PLANNING, RunStatus.RUNNING, RunStatus.EVALUATING,
  RunStatus.REFLECTING, RunStatus.REPLANNING,
];

export function decideExpiredRun(status: RunStatus, retryCount: number, maxRetries: number): RecoveryDecision {
  if (status === RunStatus.EXECUTING || status === RunStatus.VERIFYING) return "RECONCILE";
  if (!retryableStatuses.includes(status)) return "SKIP";
  return retryCount < maxRetries ? "RETRY" : "FAIL";
}
