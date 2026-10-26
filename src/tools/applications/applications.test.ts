import assert from "node:assert/strict";
import { test } from "node:test";
import { callTool, registry } from "../index.ts";
import { expectError, makeContext } from "../test-kit.ts";

test("an application is recorded with defaults, listed, and its status changed", async () => {
  const { ctx } = makeContext({ now: new Date("2026-10-24T10:00:00Z") });

  const recorded = (await callTool(
    registry,
    "applications.record",
    { company: "Acme", role: "Data Analyst", jobUrl: "https://boards.greenhouse.io/acme/jobs/101", method: "EMAIL" },
    ctx,
  )) as { application: { id: string; status: string; method: string; createdAt: string } };
  assert.equal(recorded.application.status, "APPLIED");
  assert.equal(recorded.application.method, "EMAIL");
  assert.equal(recorded.application.createdAt, "2026-10-24T10:00:00.000Z");

  const listed = (await callTool(registry, "applications.list", {}, ctx)) as { applications: unknown[] };
  assert.equal(listed.applications.length, 1);

  const updated = (await callTool(
    registry,
    "applications.set_status",
    { id: recorded.application.id, status: "INTERVIEW" },
    ctx,
  )) as { application: { status: string } };
  assert.equal(updated.application.status, "INTERVIEW");

  const onlyApplied = (await callTool(registry, "applications.list", { status: "APPLIED" }, ctx)) as {
    applications: unknown[];
  };
  assert.equal(onlyApplied.applications.length, 0);
});

test("changing the status of an unknown application fails", async () => {
  const { ctx } = makeContext({ now: new Date() });
  await expectError(
    callTool(registry, "applications.set_status", { id: "app999", status: "OFFER" }, ctx),
    "NOT_FOUND",
  );
});

test("the application log tools are callable by the assistant but never need approval", () => {
  assert.equal(registry.get("applications.record").kind, "WRITE_LOCAL");
  assert.equal(registry.get("applications.set_status").kind, "WRITE_LOCAL");
  assert.equal(registry.get("applications.list").kind, "READ");
});
