import { fetchPage, type PageResult } from "./page.ts";
import { createSearxngSearch } from "./searxng.ts";

// One search result, as the web tools return it.
export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

export type { PageResult };

// What the web tools need. Tests use a fake that implements the same interface.
export interface WebApi {
  search(query: string, count: number): Promise<SearchHit[]>;
  fetchPage(url: string): Promise<PageResult>;
}

export interface WebOptions {
  searxngUrl: string; // the self-hosted SearXNG instance, for example http://127.0.0.1:18888
  fetchImpl?: typeof fetch | undefined;
}

export function createWebApi(options: WebOptions): WebApi {
  if (!options.searxngUrl) {
    throw new Error("web search is not set up: SEARXNG_URL is missing");
  }
  return {
    search: createSearxngSearch({ baseUrl: options.searxngUrl, fetchImpl: options.fetchImpl }),
    fetchPage: (url) => fetchPage(url, { fetchImpl: options.fetchImpl }),
  };
}
