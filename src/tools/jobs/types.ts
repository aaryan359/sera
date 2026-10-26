import { z } from "zod";

// ---- jobs.search ----

export const jobsSearchInput = z.object({
  query: z.string().min(1).max(100).describe("words that must appear in the job title, e.g. 'data analyst'"),
  location: z.string().max(100).default("").describe("optional place name that must appear in the location"),
  max: z.number().int().min(1).max(10).default(10),
});

export const jobHit = z.object({
  board: z.string(),
  jobId: z.string(),
  title: z.string(),
  location: z.string(),
  url: z.string(),
  updatedAt: z.string(),
});

export const jobsSearchOutput = z.object({
  jobs: z.array(jobHit),
  failedBoards: z.array(z.string()).describe("job boards that could not be read; results may be incomplete"),
});

// ---- jobs.get_posting ----

// A Greenhouse board token (the company's job-board name).
export const boardToken = z.string().regex(/^[a-z0-9_-]{1,80}$/i, "invalid job board name");

export const jobsGetPostingInput = z.object({
  board: boardToken,
  jobId: z.string().regex(/^\d{1,20}$/, "use a jobId from jobs.search"),
});

export const jobsGetPostingOutput = z.object({
  board: z.string(),
  jobId: z.string(),
  title: z.string(),
  location: z.string(),
  url: z.string(),
  text: z.string().max(4000),
  truncated: z.boolean(),
});

// ---- TypeScript types ----

export type JobsSearchInput = z.infer<typeof jobsSearchInput>;
export type JobHit = z.infer<typeof jobHit>;
export type JobsSearchOutput = z.infer<typeof jobsSearchOutput>;

export type JobsGetPostingInput = z.infer<typeof jobsGetPostingInput>;
export type JobsGetPostingOutput = z.infer<typeof jobsGetPostingOutput>;
