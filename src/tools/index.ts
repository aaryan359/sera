import { applicationTools } from "./applications/index.ts";
import { calendarTools } from "./calendar/index.ts";
import { contactsTools } from "./contacts/index.ts";
import { driveTools } from "./drive/index.ts";
import { gmailTools } from "./gmail/index.ts";
import { jobsTools } from "./jobs/index.ts";
import { timeTools } from "./time/index.ts";
import { webTools } from "./web/index.ts";
import { createRegistry } from "./safety.ts";

// Every tool the assistant can reach, in one registry.
export const registry = createRegistry([
  ...gmailTools,
  ...calendarTools,
  ...timeTools,
  ...webTools,
  ...contactsTools,
  ...driveTools,
  ...jobsTools,
  ...applicationTools,
]);

export {
  callTool,
  requestApproval,
  reconcileApproval,
  runApproved,
  type Context,
  type ApprovalStore,
  type GrantStore,
  type Approval,
} from "./safety.ts";
