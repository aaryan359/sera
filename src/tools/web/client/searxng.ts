import { ToolError } from "../../safety.ts";
import type { SearchHit } from "./api.ts";

export interface SearxngOptions {
  baseUrl: string; // for example http://localhost:8080
  fetchImpl?: typeof fetch | undefined;
}

// Calls a SearXNG instance (free, self-hosted meta-search). Needs JSON output enabled on the server.
export function createSearxngSearch(options: SearxngOptions) {
  const doFetch = options.fetchImpl ?? fetch;
  const base = options.baseUrl.replace(/\/+$/, "");

  return async function search(query: string, count: number): Promise<SearchHit[]> {
    const params = new URLSearchParams({ q: query, format: "json", language: "en" });

    let res: Response;
    try {
      res = await doFetch(`${base}/search?${params}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      throw new ToolError("PROVIDER_ERROR", `SearXNG did not respond at ${base}: ${String(err)}`);
    }
    if (res.status === 403) {
      throw new ToolError(
        "PROVIDER_ERROR",
        "SearXNG has JSON output turned off; add 'json' to search.formats in its settings.yml",
      );
    }
    if (res.status === 429) throw new ToolError("RATE_LIMITED", "SearXNG rate limit reached");
    if (!res.ok) throw new ToolError("PROVIDER_ERROR", `SearXNG returned ${res.status}`);

    const data = (await res.json()) as { results?: { title?: string; url?: string; content?: string }[] };
    return (data.results ?? [])
      .slice(0, count)
      .map((r) => ({
        title: (r.title ?? "").replace(/<[^>]+>/g, "").trim(),
        url: r.url ?? "",
        snippet: (r.content ?? "").replace(/<[^>]+>/g, "").trim().slice(0, 300),
      }))
      .filter((hit) => hit.url !== "");
  };
}
