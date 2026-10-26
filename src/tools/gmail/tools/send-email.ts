import { createHash } from "node:crypto";
import { defineTool, ToolError } from "../../safety.ts";
import { MAX_ATTACHMENT_BYTES } from "../../drive/types.ts";
import { DRIVE_READ_SCOPE } from "../../drive/scopes.ts";
import { buildEmail } from "../client/mime.ts";
import { SEND_SCOPE } from "../scopes.ts";
import { sendEmailAction, sendEmailOutput } from "../types.ts";

// EXECUTE: sends the approved new email. Not callable by the assistant.
export const sendEmail = defineTool({
  name: "gmail.send_email",
  kind: "EXECUTE",
  description: "Sends an approved new email. Not callable by the assistant.",
  scopes: [SEND_SCOPE, DRIVE_READ_SCOPE],
  timeoutMs: 30_000,
  input: sendEmailAction,
  output: sendEmailOutput,
  run: async (action, ctx) => {
    // Each attachment must still be exactly the file the user approved.
    const files = [];
    for (const att of action.attachments) {
      const data = await ctx.drive.download(att.fileId, MAX_ATTACHMENT_BYTES);
      const md5 = createHash("md5").update(data).digest("hex");
      if (md5 !== att.md5) {
        throw new ToolError("FILE_CHANGED", `${att.name} changed after approval; propose again`);
      }
      files.push({ filename: att.name, mimeType: att.mimeType, data });
    }

    const raw = buildEmail({
      to: action.to,
      subject: action.subject,
      body: action.body,
      messageId: `<${action.marker}>`,
      date: ctx.now(),
      attachments: files,
    });
    const sent = await ctx.gmail.sendRaw(raw);
    return { providerId: sent.messageId, threadId: sent.threadId };
  },
  // Only used after a timeout: looks for the sent message by its marker.
  reconcile: async (action, ctx) => {
    const found = await ctx.gmail.findSentMessage(action.marker);
    return found ? { providerId: found.messageId, threadId: found.threadId } : null;
  },
});
