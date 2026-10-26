import type { ToolDef } from "../safety.ts";
import { getThread } from "./tools/get-thread.ts";
import { proposeEmail } from "./tools/propose-email.ts";
import { proposeReply } from "./tools/propose-reply.ts";
import { searchThreads } from "./tools/search-threads.ts";
import { sendEmail } from "./tools/send-email.ts";
import { sendReply } from "./tools/send-reply.ts";

export { createGmailApi, type GmailApi } from "./client/api.ts";

// Every Gmail tool. The registry hides the EXECUTE tools from the assistant.
export const gmailTools: ToolDef[] = [searchThreads, getThread, proposeReply, sendReply, proposeEmail, sendEmail];
