import type { ToolDef } from "../safety.ts";
import { recordApplication } from "./tools/record.ts";
import { listApplications } from "./tools/list.ts";
import { setApplicationStatus } from "./tools/set-status.ts";

export { createMemoryApplicationStore, type ApplicationStore } from "./client/store.ts";

export const applicationTools: ToolDef[] = [recordApplication, listApplications, setApplicationStatus];
