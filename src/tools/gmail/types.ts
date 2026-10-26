import { z } from "zod";
import { driveFileId } from "../drive/types.ts";

// ---- Shared pieces ----

// A Gmail thread id. Only ids returned by gmail.search_threads are valid.
export const threadId = z
  .string()
  .regex(/^[A-Za-z0-9]{1,64}$/, "use a threadId from gmail.search_threads");

export const emailAddress = z.email().max(254);

// A unique id, also written into the Message-ID header, so a timed-out send can be found later.
const marker = z.string().regex(/^[0-9a-f-]{36}@sera\.local$/, "marker must be a generated id");

// ---- gmail.search_threads ----

export const searchThreadsInput = z.object({
  query: z.string().min(1).max(200).describe("Gmail search query"),
  maxResults: z.number().int().min(1).max(10).default(5),
});

export const threadSummary = z.object({
  threadId: z.string(),
  subject: z.string(),
  from: z.string(),
  date: z.string(),
  snippet: z.string(),
});

export const searchThreadsOutput = z.object({
  threads: z.array(threadSummary),
});

// ---- gmail.get_thread ----

export const getThreadInput = z.object({
  threadId,
});

export const threadMessage = z.object({
  messageId: z.string(),
  from: z.string(),
  to: z.string(),
  cc: z.string(),
  date: z.string(),
  subject: z.string(),
  body: z.string(),
  bodyTruncated: z.boolean(),
});

export const getThreadOutput = z.object({
  threadId: z.string(),
  messages: z.array(threadMessage),
});

// ---- gmail.propose_reply ----

export const proposeReplyInput = z.object({
  threadId,
  to: emailAddress,
  body: z.string().min(1).max(5000),
});

export const proposeReplyOutput = z.object({
  approvalId: z.string(),
  preview: z.object({
    to: z.string(),
    subject: z.string(),
    body: z.string(),
    expiresAt: z.string(),
  }),
});

// ---- gmail.send_reply (the approved action, frozen at proposal time) ----

export const sendReplyAction = z.object({
  threadId,
  to: emailAddress,
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  inReplyTo: z.string().min(1),
  references: z.string(),
  // The last message the user saw. If the thread has moved on, nothing is sent.
  expectedLastMessageId: z.string(),
  marker,
});

export const sendReplyOutput = z.object({
  providerId: z.string(),
  threadId: z.string(),
});

// ---- gmail.propose_email (a new email, optionally with Drive attachments) ----

export const proposeEmailInput = z.object({
  to: emailAddress,
  subject: z
    .string()
    .min(1)
    .max(200)
    .refine((s) => !/[\r\n\0]/.test(s), "the subject cannot contain line breaks"),
  body: z.string().min(1).max(5000),
  attachmentFileIds: z
    .array(driveFileId)
    .max(3)
    .default([])
    .describe("Drive fileIds to attach (PDF, Word, text, or image; 10 MB each at most)"),
});

export const proposeEmailOutput = z.object({
  approvalId: z.string(),
  preview: z.object({
    to: z.string(),
    subject: z.string(),
    body: z.string(),
    attachments: z.array(z.string()),
    expiresAt: z.string(),
  }),
});

// ---- gmail.send_email (the approved action) ----

// An attachment as it was approved: the md5 lets the send check the exact bytes.
export const attachmentRef = z.object({
  fileId: driveFileId,
  name: z.string().max(200),
  mimeType: z.string(),
  size: z.number().int().positive(),
  md5: z.string().min(1),
});

export const sendEmailAction = z.object({
  to: emailAddress,
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  attachments: z.array(attachmentRef).max(3),
  marker,
});

export const sendEmailOutput = z.object({
  providerId: z.string(),
  threadId: z.string(),
});

// ---- TypeScript types ----

export type SearchThreadsInput = z.infer<typeof searchThreadsInput>;
export type ThreadSummary = z.infer<typeof threadSummary>;
export type SearchThreadsOutput = z.infer<typeof searchThreadsOutput>;

export type GetThreadInput = z.infer<typeof getThreadInput>;
export type ThreadMessage = z.infer<typeof threadMessage>;
export type GetThreadOutput = z.infer<typeof getThreadOutput>;

export type ProposeReplyInput = z.infer<typeof proposeReplyInput>;
export type ProposeReplyOutput = z.infer<typeof proposeReplyOutput>;

export type SendReplyAction = z.infer<typeof sendReplyAction>;
export type SendReplyOutput = z.infer<typeof sendReplyOutput>;

export type ProposeEmailInput = z.infer<typeof proposeEmailInput>;
export type ProposeEmailOutput = z.infer<typeof proposeEmailOutput>;

export type AttachmentRef = z.infer<typeof attachmentRef>;
export type SendEmailAction = z.infer<typeof sendEmailAction>;
export type SendEmailOutput = z.infer<typeof sendEmailOutput>;
