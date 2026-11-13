import assert from "node:assert/strict";
import { test } from "node:test";
import { callTool, registry } from "../tools/index.ts";
import { ToolError } from "../tools/safety.ts";
import { createWebContext } from "./web-context.ts";

test("public-web context grants only the supported tools without Google scopes", async () => {
    const ctx = createWebContext("run-one");
    assert.equal(ctx.runId, "run-one");
    assert.equal(await ctx.grants.hasGrant("", "web.search"), true);
    assert.equal(await ctx.grants.hasGrant("", "web.fetch_page"), true);
    assert.equal(await ctx.grants.hasGrant("", "gmail.search_threads"), false);
    assert.equal(await ctx.grants.hasGrant("account-one", "web.search"), false);
    assert.deepEqual(await ctx.grants.grantedScopes(""), []);
    assert.equal(createWebContext("run-two").runId, "run-two");
});

test("unsupported integrations fail explicitly", () => {
    const ctx = createWebContext("run-one");
    for (const name of ["gmail", "calendar", "contacts", "drive", "jobs", "applications", "approvals"] as const) {
        assert.throws(() => ctx[name], (error: unknown) =>
            error instanceof ToolError && error.code === "NO_GRANT");
    }
});

test("search uses the real tool validation and configured web service", async (t) => {
    let requests = 0;
    t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
        requests++;
        const request = new URL(String(url));
        assert.equal(request.pathname, "/search");
        assert.equal(request.searchParams.get("q"), "technology news");
        return new Response(JSON.stringify({ results: [
            { title: "News", url: "https://example.com/news", content: "A report" },
        ] }), { headers: { "content-type": "application/json" } });
    });
    const ctx = createWebContext("run-one");
    const result = await callTool(registry, "web.search", { query: "technology news" }, ctx);
    assert.deepEqual(result, { results: [
        { title: "News", url: "https://example.com/news", snippet: "A report" },
    ] });
    await assert.rejects(callTool(registry, "web.search", { query: "", count: 99 }, ctx),
        (error: unknown) => error instanceof ToolError && error.code === "INVALID_INPUT");
    await assert.rejects(callTool(registry, "gmail.search_threads", { query: "news" }, ctx),
        (error: unknown) => error instanceof ToolError && error.code === "NO_GRANT");
    assert.equal(requests, 1);
});
