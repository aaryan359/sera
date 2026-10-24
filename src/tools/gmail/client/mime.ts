import { ToolError } from "../../safety.ts";

interface ReplyFields {
  to: string;
  subject: string;
  body: string;
  messageId: string; // with angle brackets, e.g. <uuid@sera.local>
  inReplyTo: string;
  references: string;
  date: Date;
}

// Builds a plain-text email, then encodes it the way Gmail's send endpoint expects.
// An email is headers, a blank line, then the body.
export function buildReply(fields: ReplyFields): string {
  const headers = [
    headerLine("To", fields.to),
    headerLine("Subject", fields.subject),
    headerLine("Date", fields.date.toUTCString()),
    headerLine("Message-ID", fields.messageId),
    headerLine("In-Reply-To", fields.inReplyTo),
    headerLine("References", fields.references),
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
  ].filter((line): line is string => line !== null);

  // The body is base64 encoded and split into lines of at most 76 characters.
  const body = Buffer.from(fields.body, "utf8").toString("base64").match(/.{1,76}/g)?.join("\r\n") ?? "";

  const message = [...headers, "", body].join("\r\n");
  return Buffer.from(message, "utf8").toString("base64url");
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
