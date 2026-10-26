import { defineTool, ToolError } from "../../safety.ts";
import { buildEmail } from "../client/mime.ts";
import { SEND_SCOPE } from "../scopes.ts";
import { sendReplyAction, sendReplyOutput } from "../types.ts";

export const sendReply = defineTool({
  name: "gmail.send_reply",
  kind: "EXECUTE",
  description: "Sends an approved reply. Not callable by the assistant.",
  scopes: [SEND_SCOPE],
  timeoutMs: 15_000,
  input: sendReplyAction,
  output: sendReplyOutput,
  run: async (action, ctx) => {
    const thread = await ctx.gmail.getThread(action.threadId);
    const last = thread.messages.at(-1);
    if (!last || last.messageId !== action.expectedLastMessageId) {
      throw new ToolError("THREAD_CHANGED", "the thread changed after approval; propose again");
    }

    const raw = buildEmail({
      to: action.to,
      subject: action.subject,
      body: action.body,
      messageId: `<${action.marker}>`,
      inReplyTo: action.inReplyTo,
      references: action.references,
      date: ctx.now(),
    });
    const sent = await ctx.gmail.sendRaw(raw, action.threadId);
    return { providerId: sent.messageId, threadId: sent.threadId };
  },
  // Only used after a timeout: looks for the sent message by its marker.
  reconcile: async (action, ctx) => {
    const found = await ctx.gmail.findSentMessage(action.marker);
    return found ? { providerId: found.messageId, threadId: found.threadId } : null;
  },
});
