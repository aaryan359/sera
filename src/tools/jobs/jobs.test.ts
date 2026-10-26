import assert from "node:assert/strict";
import { test } from "node:test";
import { callTool, registry } from "../index.ts";
import { expectError, makeContext } from "../test-kit.ts";
import { createJobsApi } from "./client/api.ts";

function fakeFetch(handler: (url: string) => Response): typeof fetch {
  return (async (input: string | URL | Request) => handler(String(input))) as typeof fetch;
}

const BOARD_JOBS = {
  jobs: [
    {
      id: 101,
      title: "Data Analyst",
      location: { name: "Gwalior, India" },
      absolute_url: "https://boards.greenhouse.io/acme/jobs/101",
      updated_at: "2026-10-20T10:00:00Z",
    },
    {
      id: 102,
      title: "Senior Data Analyst",
      location: { name: "Remote" },
      absolute_url: "https://boards.greenhouse.io/acme/jobs/102",
      updated_at: "2026-10-21T10:00:00Z",
    },
    {
      id: 103,
      title: "Account Manager",
      location: { name: "Gwalior, India" },
      absolute_url: "https://boards.greenhouse.io/acme/jobs/103",
      updated_at: "2026-10-21T10:00:00Z",
    },
  ],
};

function jobsFetch(): typeof fetch {
  return fakeFetch((url) => {
    if (url.includes("/boards/acme/jobs/101")) {
      // Greenhouse returns the description encoded twice.
      return new Response(
        JSON.stringify({
          id: 101,
          title: "Data Analyst",
          location: { name: "Gwalior, India" },
          absolute_url: "https://boards.greenhouse.io/acme/jobs/101",
          content: "&amp;lt;p&amp;gt;Build &amp;amp; ship&amp;lt;/p&amp;gt;",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.includes("/boards/acme/jobs")) {
      return new Response(JSON.stringify(BOARD_JOBS), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response("", { status: 500 }); // the "down" board
  });
}

test("jobs.search matches every title word and reports unreadable boards", async () => {
  const jobs = createJobsApi({ boards: ["acme", "down"], fetchImpl: jobsFetch() });
  const out = await jobs.search("data analyst", "", 10);
  assert.deepEqual(out.jobs.map((j) => j.jobId), ["101", "102"]);
  assert.deepEqual(out.failedBoards, ["down"]);
});

test("jobs.search filters by location when one is given", async () => {
  const jobs = createJobsApi({ boards: ["acme"], fetchImpl: jobsFetch() });
  const out = await jobs.search("data analyst", "remote", 10);
  assert.deepEqual(out.jobs.map((j) => j.jobId), ["102"]);
});

test("jobs.get_posting decodes the description and removes tags", async () => {
  const { ctx } = makeContext({ jobs: createJobsApi({ boards: ["acme"], fetchImpl: jobsFetch() }), now: new Date() });
  const out = (await callTool(registry, "jobs.get_posting", { board: "acme", jobId: "101" }, ctx)) as {
    text: string;
    title: string;
  };
  assert.equal(out.title, "Data Analyst");
  assert.equal(out.text, "Build & ship");
});

test("an invalid job id is rejected before any request", async () => {
  const { ctx } = makeContext({ now: new Date() });
  await expectError(callTool(registry, "jobs.get_posting", { board: "acme", jobId: "abc" }, ctx), "INVALID_INPUT");
});

test("a board name with unsafe characters is refused when the service is built", () => {
  assert.throws(() => createJobsApi({ boards: ["../etc"] }), /invalid job board name/);
});
