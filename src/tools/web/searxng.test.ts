import assert from "node:assert/strict";
import { test } from "node:test";
import { ToolError } from "../safety.ts";
import { createWebApi } from "./client/api.ts";
import { createSearxngSearch } from "./client/searxng.ts";

function fakeFetch(handler: (url: string) => Response): typeof fetch {
  return (async (input: string | URL | Request) => handler(String(input))) as typeof fetch;
}

test("SearXNG results are parsed into title, url, and snippet", async () => {
  let url = "";
  const search = createSearxngSearch({
    baseUrl: "http://localhost:8080/",
    fetchImpl: fakeFetch((u) => {
      url = u;
      return new Response(
        JSON.stringify({
          results: [
            { title: "Greek <b>Restaurants</b>", url: "https://a.example/r", content: "Top <b>Greek</b> spots" },
            { title: "no url", content: "skipped" },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }),
  });
  const hits = await search("greek restaurants", 5);
  assert.match(url, /^http:\/\/localhost:8080\/search\?/);
  assert.match(url, /format=json/);
  assert.deepEqual(hits, [{ title: "Greek Restaurants", url: "https://a.example/r", snippet: "Top Greek spots" }]);
});

test("a SearXNG server with JSON turned off gives a clear message", async () => {
  const search = createSearxngSearch({
    baseUrl: "http://localhost:8080",
    fetchImpl: fakeFetch(() => new Response("", { status: 403 })),
  });
  await assert.rejects(search("x", 3), (err: unknown) => {
    return err instanceof ToolError && err.code === "PROVIDER_ERROR" && /json/i.test(err.message);
  });
});

test("the web service sends searches to the configured SearXNG URL", async () => {
  let url = "";
  const web = createWebApi({
    searxngUrl: "http://localhost:8080",
    fetchImpl: fakeFetch((u) => {
      url = u;
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    }),
  });
  await web.search("anything", 3);
  assert.match(url, /localhost:8080\/search/);
});

test("the web service refuses to start without a SearXNG URL", () => {
  assert.throws(() => createWebApi({ searxngUrl: "" }), /SEARXNG_URL is missing/);
});
