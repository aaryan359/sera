import { z } from "zod";
import { APPLICATION_METHODS, APPLICATION_STATUSES } from "./client/store.ts";

const statusEnum = z.enum(APPLICATION_STATUSES);
const methodEnum = z.enum(APPLICATION_METHODS);

// ---- applications.record ----

export const recordApplicationInput = z.object({
  company: z.string().min(1).max(100),
  role: z.string().min(1).max(150),
  jobUrl: z.string().max(2000).default(""),
  status: statusEnum.default("APPLIED"),
  method: methodEnum.default("OTHER").describe("EMAIL if sent by email, FORM if submitted on a website"),
  notes: z.string().max(500).default(""),
});

export const applicationRecord = z.object({
  id: z.string(),
  company: z.string(),
  role: z.string(),
  jobUrl: z.string(),
  status: statusEnum,
  method: methodEnum,
  notes: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const recordApplicationOutput = z.object({
  application: applicationRecord,
});

// ---- applications.list ----

export const listApplicationsInput = z.object({
  status: statusEnum.optional(),
});

export const listApplicationsOutput = z.object({
  applications: z.array(applicationRecord),
});

// ---- applications.set_status ----

export const setApplicationStatusInput = z.object({
  id: z.string().min(1).max(64),
  status: statusEnum,
});

export const setApplicationStatusOutput = z.object({
  application: applicationRecord,
});

// ---- TypeScript types ----

export type RecordApplicationInput = z.infer<typeof recordApplicationInput>;
export type ApplicationRecord = z.infer<typeof applicationRecord>;
export type RecordApplicationOutput = z.infer<typeof recordApplicationOutput>;
export type ListApplicationsInput = z.infer<typeof listApplicationsInput>;
export type ListApplicationsOutput = z.infer<typeof listApplicationsOutput>;
export type SetApplicationStatusInput = z.infer<typeof setApplicationStatusInput>;
export type SetApplicationStatusOutput = z.infer<typeof setApplicationStatusOutput>;
