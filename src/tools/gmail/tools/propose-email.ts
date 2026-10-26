import { randomUUID } from "node:crypto";
import { defineTool, requestApproval, ToolError } from "../../safety.ts";
import { ATTACHMENT_MIME_TYPES, MAX_ATTACHMENT_BYTES } from "../../drive/types.ts";
import { DRIVE_READ_SCOPE } from "../../drive/scopes.ts";
import { proposeEmailInput, proposeEmailOutput, sendEmailAction } from "../types.ts";
import { sendEmail } from "./send-email.ts";

export const proposeEmail = defineTool({
  name: "gmail.propose_email",
  kind: "PROPOSE",
  description:
    "Prepare a NEW email (not a reply) for the user to approve, optionally with files from Google " +
    "Drive attached. This sends NOTHING. Returns an approvalId and a preview to show the user. The " +
    "email is sent only after the user approves it.",
  scopes: [DRIVE_READ_SCOPE],
  timeoutMs: 15_000,
  input: proposeEmailInput,
  output: proposeEmailOutput,
  run: async ({ to, subject, body, attachmentFileIds }, ctx) => {
    const attachments = [];
    for (const fileId of attachmentFileIds) {
      const info = await ctx.drive.fileInfo(fileId);
      if (!ATTACHMENT_MIME_TYPES.includes(info.mimeType) || info.md5 === null) {
        throw new ToolError("FILE_NOT_ALLOWED", `${info.name} cannot be attached; use a PDF, Word, text, or image file`);
      }
      if (info.size === null || info.size <= 0 || info.size > MAX_ATTACHMENT_BYTES) {
        throw new ToolError("FILE_NOT_ALLOWED", `${info.name} must not be empty and must be 10 MB or smaller`);
      }
      attachments.push({ fileId, name: info.name, mimeType: info.mimeType, size: info.size, md5: info.md5 });
    }

    const action = sendEmailAction.parse({
      to,
      subject,
      body,
      attachments,
      marker: `${randomUUID()}@sera.local`,
    });
    const approval = await requestApproval(ctx, sendEmail.name, action);
    return {
      approvalId: approval.id,
      preview: {
        to,
        subject,
        body,
        attachments: attachments.map((a) => a.name),
        expiresAt: approval.expiresAt.toISOString(),
      },
    };
  },
});
