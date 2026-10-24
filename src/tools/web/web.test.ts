import assert from "node:assert/strict";
import { test } from "node:test";
import { callTool, registry } from "../index.ts";
import { ToolError } from "../safety.ts";
import { expectError, makeContext, unusedCalendar, unusedGmail } from "../test-kit.ts";
import type { WebApi } from "./client/api.ts";
import { checkUrl, fetchPage, isPrivateIp } from "./client/page.ts";
import { createSearxngSearch } from "./client/searxng.ts";

// ---------- helpers ----------

class FakeWeb implements WebApi {
  async search(query: string, count: number) {
    return [{ title: `Result for ${query}`, url: "https://a.example/x", snippet: "a snippet" }].slice(0, count);
  }
  async fetchPage(url: string) {
    return { url, title: "T", text: "body", truncated: false };
  }
}

function fakeFetch(handler: (url: string) => Response): typeof fetch {
  return (async (input: string | URL | Request) => handler(String(input))) as typeof fetch;
}

const publicHost = async () => ["93.184.216.34"];

// ---------- web.search and web.fetch_page through callTool ----------

test("web.search works through callTool and returns results", async () => {
  const { ctx } = makeContext({ gmail: unusedGmail(), calendar: unusedCalendar(), web: new FakeWeb(), now: new Date() });
  const out = (await callTool(registry, "web.search", { query: "greek restaurants" }, ctx)) as {
    results: { title: string }[];
  };
  assert.equal(out.results.length, 1);
  assert.equal(out.results[0]?.title, "Result for greek restaurants");
});

test("web.search rejects an empty query", async () => {
  const { ctx } = makeContext({ gmail: unusedGmail(), calendar: unusedCalendar(), web: new FakeWeb(), now: new Date() });
  await expectError(callTool(registry, "web.search", { query: "" }, ctx), "INVALID_INPUT");
});

test("the web tools are read-only and visible to the assistant", () => {
  assert.equal(registry.get("web.search").kind, "READ");
  assert.equal(registry.get("web.fetch_page").kind, "READ");
});

// ---------- the search client ----------

test("a SearXNG rate limit is reported as RATE_LIMITED", async () => {
  const search = createSearxngSearch({
    baseUrl: "http://127.0.0.1:18888",
    fetchImpl: fakeFetch(() => new Response("", { status: 429 })),
  });
  await assert.rejects(search("x", 3), (err: unknown) => err instanceof ToolError && err.code === "RATE_LIMITED");
});

// ---------- URL and address safety ----------

test("unsafe URLs are refused before any request is made", () => {
  const unsafe = [
    "file:///etc/passwd",
    "ftp://example.com/file",
    "http://localhost:8080/",
    "http://127.0.0.1/admin",
    "http://10.1.2.3/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/",
    "https://user:pw@example.com/",
    "http://example.com:8080/",
    "not a url",
  ];
  for (const url of unsafe) {
    assert.throws(
      () => checkUrl(url),
      (err: unknown) => err instanceof ToolError && err.code === "BLOCKED_URL",
      url,
    );
  }
});

test("an ordinary https URL is allowed", () => {
  assert.equal(checkUrl("https://example.com/page").hostname, "example.com");
});

test("private address ranges are recognised", () => {
  assert.equal(isPrivateIp("8.8.8.8"), false);
  assert.equal(isPrivateIp("172.20.1.1"), true);
  assert.equal(isPrivateIp("172.32.0.1"), false);
  assert.equal(isPrivateIp("100.64.0.1"), true);
});

test("a site that resolves to a private address is blocked", async () => {
  await assert.rejects(
    fetchPage("https://example.com/", { resolveHost: async () => ["10.0.0.7"], fetchImpl: fakeFetch(() => new Response("x")) }),
    (err: unknown) => err instanceof ToolError && err.code === "BLOCKED_URL",
  );
});

test("a redirect to a private address is blocked before it is followed", async () => {
  let calls = 0;
  await assert.rejects(
    fetchPage("https://example.com/", {
      resolveHost: publicHost,
      fetchImpl: fakeFetch(() => {
        calls++;
        return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } });
      }),
    }),
    (err: unknown) => err instanceof ToolError && err.code === "BLOCKED_URL",
  );
  assert.equal(calls, 1); // the private address was never requested
});

// ---------- reading pages ----------

test("an HTML page is reduced to its title and visible text", async () => {
  const html =
    "<html><head><title>Hello &amp; welcome</title><script>var x=1</script><style>p{}</style></head>" +
    "<body><p>First   line.</p><p>Second</p></body></html>";
  const page = await fetchPage("https://example.com/a", {
    resolveHost: publicHost,
    fetchImpl: fakeFetch(() => new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } })),
  });
  assert.equal(page.title, "Hello & welcome");
  assert.equal(page.text, "First line. Second");
  assert.equal(page.truncated, false);
});

test("a long page is cut to the text limit and marked truncated", async () => {
  const page = await fetchPage("https://example.com/long", {
    resolveHost: publicHost,
    fetchImpl: fakeFetch(() => new Response("a".repeat(5000), { status: 200, headers: { "content-type": "text/plain" } })),
  });
  assert.equal(page.text.length, 4000);
  assert.equal(page.truncated, true);
});

test("binary content such as a PDF is refused", async () => {
  await assert.rejects(
    fetchPage("https://example.com/file.pdf", {
      resolveHost: publicHost,
      fetchImpl: fakeFetch(() => new Response("%PDF", { status: 200, headers: { "content-type": "application/pdf" } })),
    }),
    (err: unknown) => err instanceof ToolError && err.code === "PROVIDER_ERROR",
  );
});
