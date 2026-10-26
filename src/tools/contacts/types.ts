import { z } from "zod";

// ---- contacts.search ----

export const contactsSearchInput = z.object({
  query: z.string().min(1).max(100).describe("a name or part of a name, e.g. 'Maya'"),
  max: z.number().int().min(1).max(10).default(5),
});

export const contact = z.object({
  name: z.string(),
  emails: z.array(z.string()),
});

export const contactsSearchOutput = z.object({
  contacts: z.array(contact),
});

// ---- TypeScript types ----

export type ContactsSearchInput = z.infer<typeof contactsSearchInput>;
export type Contact = z.infer<typeof contact>;
export type ContactsSearchOutput = z.infer<typeof contactsSearchOutput>;
