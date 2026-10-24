import { calendarTools } from "./calendar/index.ts";
import { gmailTools } from "./gmail/index.ts";
import { timeTools } from "./time/index.ts";
import { webTools } from "./web/index.ts";
import { createRegistry } from "./safety.ts";

// Every tool the assistant can reach, in one registry.
export const registry = createRegistry([...gmailTools, ...calendarTools, ...timeTools, ...webTools]);

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
