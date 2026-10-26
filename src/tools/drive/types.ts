import { z } from "zod";

// Files that may be attached to an email. Anything else is refused.
export const ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/png",
  "image/jpeg",
];

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

// A Drive file id. Only ids returned by drive.search_files are valid.
export const driveFileId = z.string().regex(/^[A-Za-z0-9_-]{10,128}$/, "use a fileId from drive.search_files");

// ---- drive.search_files ----

export const driveSearchInput = z.object({
  query: z.string().min(1).max(100).describe("part of a file name to look for"),
  max: z.number().int().min(1).max(20).default(10),
});

export const driveFile = z.object({
  fileId: z.string(),
  name: z.string(),
  mimeType: z.string(),
  modifiedTime: z.string(),
});

export const driveSearchOutput = z.object({
  files: z.array(driveFile),
});

// ---- docs.read_document ----

export const readDocInput = z.object({
  fileId: driveFileId,
});

export const readDocOutput = z.object({
  fileId: z.string(),
  title: z.string(),
  text: z.string().max(4000),
  truncated: z.boolean(),
});

// ---- docs.propose_append ----

export const proposeAppendInput = z.object({
  fileId: driveFileId,
  text: z.string().min(1).max(2000).describe("text to add to the end of the document"),
});

export const proposeAppendOutput = z.object({
  approvalId: z.string(),
  preview: z.object({
    fileId: z.string(),
    title: z.string(),
    text: z.string(),
    expiresAt: z.string(),
  }),
});

// ---- docs.apply_append (the approved action) ----

export const applyAppendAction = z.object({
  fileId: driveFileId,
  title: z.string(),
  text: z.string().min(1).max(2000),
});

export const applyAppendOutput = z.object({
  providerId: z.string(),
  fileId: z.string(),
});

// ---- TypeScript types ----

export type DriveSearchInput = z.infer<typeof driveSearchInput>;
export type DriveFile = z.infer<typeof driveFile>;
export type DriveSearchOutput = z.infer<typeof driveSearchOutput>;

export type ReadDocInput = z.infer<typeof readDocInput>;
export type ReadDocOutput = z.infer<typeof readDocOutput>;

export type ProposeAppendInput = z.infer<typeof proposeAppendInput>;
export type ProposeAppendOutput = z.infer<typeof proposeAppendOutput>;

export type ApplyAppendAction = z.infer<typeof applyAppendAction>;
export type ApplyAppendOutput = z.infer<typeof applyAppendOutput>;
