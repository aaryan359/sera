import assert from "node:assert/strict";
import { test } from "node:test";
import { RunStatus } from "../db/enums.js";
import { assertRunTransition, decideExpiredRun, InvalidRunTransition } from "./run-state.js";

test("pre-write work can recover, but interrupted writes cannot be retried", () => {
  assert.equal(decideExpiredRun(RunStatus.RUNNING, 1, 3), "RETRY");
  assert.equal(decideExpiredRun(RunStatus.RUNNING, 3, 3), "FAIL");
  assert.equal(decideExpiredRun(RunStatus.EXECUTING, 0, 3), "RECONCILE");
  assert.equal(decideExpiredRun(RunStatus.VERIFYING, 0, 0), "RECONCILE");
  assert.equal(decideExpiredRun(RunStatus.AWAITING_APPROVAL, 0, 3), "SKIP");
});

test("the state machine prevents replaying writes or reopening terminal runs", () => {
  assertRunTransition(RunStatus.RUNNING, RunStatus.QUEUED);
  assertRunTransition(RunStatus.EXECUTING, RunStatus.OUTCOME_UNKNOWN);
  assert.throws(() => assertRunTransition(RunStatus.EXECUTING, RunStatus.QUEUED), InvalidRunTransition);
  assert.throws(() => assertRunTransition(RunStatus.OUTCOME_UNKNOWN, RunStatus.EXECUTING), InvalidRunTransition);
  assert.throws(() => assertRunTransition(RunStatus.COMPLETED, RunStatus.PLANNING), InvalidRunTransition);
});
