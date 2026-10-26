import { defineTool } from "../../safety.ts";
import { CONTACTS_READ_SCOPE } from "../scopes.ts";
import { contactsSearchInput, contactsSearchOutput } from "../types.ts";

export const searchContacts = defineTool({
  name: "contacts.search",
  kind: "READ",
  description:
    "Find people in the user's Google Contacts by name. Returns each match with its email addresses. " +
    "Use it to turn a name like 'Maya' into an email address. If several contacts match, ask the user " +
    "which one they mean before drafting an email.",
  scopes: [CONTACTS_READ_SCOPE],
  timeoutMs: 10_000,
  input: contactsSearchInput,
  output: contactsSearchOutput,
  run: async ({ query, max }, ctx) => {
    return { contacts: await ctx.contacts.search(query, max) };
  },
});
