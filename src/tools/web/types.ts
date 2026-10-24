import { z } from "zod";

// ---- web.search ----

export const searchInput = z.object({
  query: z.string().min(1).max(200),
  count: z.number().int().min(1).max(10).default(5),
});

export const searchResult = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
});

export const searchOutput = z.object({
  results: z.array(searchResult),
});

// ---- web.fetch_page ----

export const fetchPageInput = z.object({
  url: z.string().min(8).max(2000),
});

export const fetchPageOutput = z.object({
  url: z.string(),
  title: z.string(),
  text: z.string(),
  truncated: z.boolean(),
});

// ---- TypeScript types ----

export type SearchInput = z.infer<typeof searchInput>;
export type SearchResult = z.infer<typeof searchResult>;
export type SearchOutput = z.infer<typeof searchOutput>;

export type FetchPageInput = z.infer<typeof fetchPageInput>;
export type FetchPageOutput = z.infer<typeof fetchPageOutput>;
