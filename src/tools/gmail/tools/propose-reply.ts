import { randomUUID } from "node:crypto";
import { defineTool, requestApproval, ToolError } from "../../safety.ts";
import { READ_SCOPE } from "../scopes.ts";
import { proposeReplyInput, proposeReplyOutput, sendReplyAction } from "../types.ts";
import { sendReply } from "./send-reply.ts";

export const proposeReply = defineTool({
  name: "gmail.propose_reply",
  kind: "PROPOSE",
  description:
    "Prepare a reply in an existing thread for the user to approve. This sends NOTHING. " +
    "The subject is taken from the thread. The recipient must already be in the thread; if the " +
    "user names someone else, ask first. Returns an approvalId and a preview to show the user.",
  scopes: [READ_SCOPE],
  timeoutMs: 10_000,
  input: proposeReplyInput,
  output: proposeReplyOutput,
  run: async ({ threadId, to, body }, ctx) => {
    const thread = await ctx.gmail.getThread(threadId);
    const last = thread.messages.at(-1);
    if (!last) throw new ToolError("NOT_FOUND", "the thread has no messages");

    const participants = thread.messages.flatMap((m) => m.participants);
    if (!participants.includes(to.toLowerCase())) {
      throw new ToolError(
        "RECIPIENT_NOT_IN_THREAD",
        `${to} is not in this thread; ask the user to confirm the recipient`,
      );
    }

    const subject = /^re:/i.test(last.subject) ? last.subject : `Re: ${last.subject}`;
    const action = sendReplyAction.parse({
      threadId,
      to,
      subject,
      body,
      inReplyTo: last.rfcMessageId,
      references: thread.messages.map((m) => m.rfcMessageId).filter(Boolean).join(" "),
      expectedLastMessageId: last.messageId,
      marker: `${randomUUID()}@sera.local`,
    });

    const approval = await requestApproval(ctx, sendReply.name, action);
    return {
      approvalId: approval.id,
      preview: { to, subject, body, expiresAt: approval.expiresAt.toISOString() },
    };
  },
});
