import { randomUUID } from "node:crypto";
import { ToolError } from "../../safety.ts";

export interface Attachment {
  filename: string;
  mimeType: string;
  data: Buffer;
}

export interface EmailFields {
  to: string;
  subject: string;
  body: string;
  messageId: string; // with angle brackets, e.g. <uuid@sera.local>
  inReplyTo?: string | undefined;
  references?: string | undefined;
  date: Date;
  attachments?: Attachment[] | undefined;
}

// Builds an email and encodes it the way Gmail's send endpoint expects (base64url).
// An email is headers, a blank line, then the body.
// With attachments, the body and each file become separate parts of one multipart message.
export function buildEmail(fields: EmailFields): string {
  const attachments = fields.attachments ?? [];
  const multipart = attachments.length > 0;
  const boundary = `sera-${randomUUID()}`;

  const headers = [
    headerLine("To", fields.to),
    headerLine("Subject", fields.subject),
    headerLine("Date", fields.date.toUTCString()),
    headerLine("Message-ID", fields.messageId),
    headerLine("In-Reply-To", fields.inReplyTo ?? ""),
    headerLine("References", fields.references ?? ""),
    "MIME-Version: 1.0",
    multipart
      ? `Content-Type: multipart/mixed; boundary="${boundary}"`
      : 'Content-Type: text/plain; charset="UTF-8"',
    multipart ? null : "Content-Transfer-Encoding: base64",
  ].filter((line): line is string => line !== null);

  if (!multipart) {
    return encode([...headers, "", wrap(Buffer.from(fields.body, "utf8").toString("base64"))]);
  }

  const lines = [
    ...headers,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrap(Buffer.from(fields.body, "utf8").toString("base64")),
  ];
  for (const file of attachments) {
    const name = safeFilename(file.filename);
    if (/[\r\n"]/.test(file.mimeType)) throw new ToolError("UNSAFE_HEADER", "attachment type contains bad characters");
    lines.push(
      `--${boundary}`,
      `Content-Type: ${file.mimeType}; name="${name}"`,
      `Content-Disposition: attachment; filename="${name}"`,
      "Content-Transfer-Encoding: base64",
      "",
      wrap(file.data.toString("base64")),
    );
  }
  lines.push(`--${boundary}--`);
  return encode(lines);
}

// Rejects line breaks in header values. A line break there would let someone
// add a hidden header such as Bcc.
function headerLine(name: string, value: string): string | null {
  if (value === "") return null;
  if (/[\r\n\0]/.test(value)) {
    throw new ToolError("UNSAFE_HEADER", `${name} contains a line break`);
  }
  // Non-English text is encoded so the header stays plain ASCII.
  const safe = /^[\x20-\x7e]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
  return `${name}: ${safe}`;
}

// Attachment names are reduced to plain characters, so they cannot break the headers.
function safeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 100) || "file";
}

// Base64 text is split into lines of at most 76 characters.
function wrap(base64: string): string {
  return base64.match(/.{1,76}/g)?.join("\r\n") ?? "";
}

function encode(lines: string[]): string {
  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}
