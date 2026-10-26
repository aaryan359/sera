import { ToolError } from "../../safety.ts";
import { boardToken, type JobHit, type JobsGetPostingOutput } from "../types.ts";

// Job search over public Greenhouse job boards. No key is needed, and only the boards listed
// in config are read. Tests use a fake that implements the same interface.
export interface JobsApi {
  search(query: string, location: string, max: number): Promise<{ jobs: JobHit[]; failedBoards: string[] }>;
  posting(board: string, jobId: string): Promise<JobsGetPostingOutput>;
}

export interface JobsOptions {
  boards: string[];
  fetchImpl?: typeof fetch | undefined;
}

const BASE = "https://boards-api.greenhouse.io/v1/boards";
const TEXT_LIMIT = 4000;

export function createJobsApi(options: JobsOptions): JobsApi {
  for (const board of options.boards) {
    if (!boardToken.safeParse(board).success) throw new Error(`invalid job board name: ${board}`);
  }
  const doFetch = options.fetchImpl ?? fetch;

  async function getJson(url: string): Promise<any> {
    const res = await doFetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new ToolError("PROVIDER_ERROR", `job board returned ${res.status}`);
    return res.json();
  }

  return {
    async search(query, location, max) {
      const words = query.toLowerCase().split(/\s+/).filter(Boolean);
      const place = location.toLowerCase();

      // Read every board at once. A board that fails is reported, not hidden.
      const boards = await Promise.all(
        options.boards.map(async (board) => {
          try {
            return { board, data: await getJson(`${BASE}/${board}/jobs`) };
          } catch {
            return { board, data: null };
          }
        }),
      );

      const jobs: JobHit[] = [];
      const failedBoards: string[] = [];
      for (const { board, data } of boards) {
        if (data === null) {
          failedBoards.push(board);
          continue;
        }
        for (const job of data.jobs ?? []) {
          const title = String(job.title ?? "").toLowerCase();
          const where = String(job.location?.name ?? "").toLowerCase();
          if (!words.every((word) => title.includes(word))) continue;
          if (place !== "" && !where.includes(place)) continue;
          jobs.push({
            board,
            jobId: String(job.id),
            title: String(job.title ?? ""),
            location: String(job.location?.name ?? ""),
            url: String(job.absolute_url ?? ""),
            updatedAt: String(job.updated_at ?? ""),
          });
        }
      }
      return { jobs: jobs.slice(0, max), failedBoards };
    },

    async posting(board, jobId) {
      if (!boardToken.safeParse(board).success) throw new ToolError("INVALID_INPUT", "invalid job board name");
      const job = await getJson(`${BASE}/${board}/jobs/${jobId}`);
      const full = describe(String(job.content ?? ""));
      return {
        board,
        jobId,
        title: String(job.title ?? ""),
        location: String(job.location?.name ?? ""),
        url: String(job.absolute_url ?? ""),
        text: full.slice(0, TEXT_LIMIT),
        truncated: full.length > TEXT_LIMIT,
      };
    },
  };
}

// Greenhouse returns the description HTML-encoded, sometimes twice. Decode it, then remove tags.
function describe(content: string): string {
  const decoded = decodeEntities(decodeEntities(content));
  return decoded
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
