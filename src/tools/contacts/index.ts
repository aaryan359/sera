import type { ToolDef } from "../safety.ts";
import { searchContacts } from "./tools/search.ts";

export { createContactsApi, type ContactsApi } from "./client/api.ts";

export const contactsTools: ToolDef[] = [searchContacts];
