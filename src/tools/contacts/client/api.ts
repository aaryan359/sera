import { createGoogleRequest } from "../../google/http.ts";
import type { Contact } from "../types.ts";

const PEOPLE_URL = "https://people.googleapis.com/v1";

// Searches the user's Google Contacts. Tests use a fake that implements the same interface.
export interface ContactsApi {
  search(query: string, max: number): Promise<Contact[]>;
}

export interface ContactsOptions {
  getAccessToken: () => Promise<string>;
  fetchImpl?: typeof fetch | undefined;
}

export function createContactsApi(options: ContactsOptions): ContactsApi {
  const request = createGoogleRequest({
    baseUrl: PEOPLE_URL,
    getAccessToken: options.getAccessToken,
    fetchImpl: options.fetchImpl,
  });

  return {
    async search(query, max) {
      const params = new URLSearchParams({
        query,
        pageSize: String(max),
        readMask: "names,emailAddresses",
      });
      const data = await request(`/people:searchContacts?${params}`);
      return (data.results ?? [])
        .map((result: any) => ({
          name: result.person?.names?.[0]?.displayName ?? "",
          emails: (result.person?.emailAddresses ?? [])
            .map((e: { value?: string }) => (e.value ?? "").toLowerCase())
            .filter((email: string) => email !== ""),
        }))
        .filter((c: Contact) => c.emails.length > 0);
    },
  };
}
