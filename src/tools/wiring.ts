import { config } from "../config.ts";
import { createJobsApi, type JobsApi } from "./jobs/client/api.ts";
import { createWebApi, type WebApi } from "./web/client/api.ts";

// Builds the web service from the app config (SEARXNG_URL, or the local default).
export function webServiceFromConfig(): WebApi {
  return createWebApi({ searxngUrl: config.searxngUrl });
}

// Builds the job-search service from the configured Greenhouse boards.
export function jobsServiceFromConfig(): JobsApi {
  return createJobsApi({ boards: config.greenhouseBoards });
}
