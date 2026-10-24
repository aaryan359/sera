import type { ToolDef } from "../safety.ts";
import { webFetchPage } from "./tools/fetch-page.ts";
import { webSearch } from "./tools/search.ts";

export { createWebApi, type WebApi } from "./client/api.ts";

// Every web tool. Neither tool needs a Google permission.
export const webTools: ToolDef[] = [webSearch, webFetchPage];
