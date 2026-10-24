import { config } from "../config.ts";
import { createWebApi, type WebApi } from "./web/client/api.ts";

// Builds the web service from the app config (SEARXNG_URL, or the local default).
// Other services (Gmail, Calendar, stores) are wired the same way when the backend builds the full context.
export function webServiceFromConfig(): WebApi {
  return createWebApi({ searxngUrl: config.searxngUrl });
}
