import type { ToolDef } from "../safety.ts";
import { getPosting } from "./tools/get-posting.ts";
import { searchJobs } from "./tools/search.ts";

export { createJobsApi, type JobsApi } from "./client/api.ts";

export const jobsTools: ToolDef[] = [searchJobs, getPosting];
