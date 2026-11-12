import { config } from "../config.ts";
import { createJobsApi } from "./jobs/client/api.ts";
import { createWebApi } from "./web/client/api.ts";

// Builds the web service from the app config (SEARXNG_URL, or the local default).
export function webServiceFromConfig() {
    return createWebApi({ searxngUrl: config.searxngUrl });
}

// Builds the job-search service from the configured Greenhouse boards.
export function jobsServiceFromConfig() {
    return createJobsApi({ boards: config.greenhouseBoards });
}
