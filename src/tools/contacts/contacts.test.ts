import assert from "node:assert/strict";
import { test } from "node:test";
import { callTool, registry } from "../index.ts";
import { expectError, makeContext } from "../test-kit.ts";
import { createContactsApi, type ContactsApi } from "./client/api.ts";

class FakeContacts implements ContactsApi {
  contacts = [
    { name: "Maya Smith", emails: ["maya.smith@example.com"] },
    { name: "Maya Patel", emails: ["maya.patel@example.com"] },
  ];
  async search(query: string, max: number) {
    return this.contacts.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, max);
  }
}

test("contacts.search finds people by name and returns their emails", async () => {
  const { ctx } = makeContext({ contacts: new FakeContacts(), now: new Date() });
  const out = (await callTool(registry, "contacts.search", { query: "maya" }, ctx)) as {
    contacts: { name: string; emails: string[] }[];
  };
  assert.equal(out.contacts.length, 2);
  assert.deepEqual(out.contacts[0], { name: "Maya Smith", emails: ["maya.smith@example.com"] });
});

test("contacts.search can narrow to one person", async () => {
  const { ctx } = makeContext({ contacts: new FakeContacts(), now: new Date() });
  const out = (await callTool(registry, "contacts.search", { query: "patel" }, ctx)) as {
    contacts: { name: string }[];
  };
  assert.deepEqual(out.contacts.map((c) => c.name), ["Maya Patel"]);
});

test("an empty contacts query is rejected", async () => {
  const { ctx } = makeContext({ contacts: new FakeContacts(), now: new Date() });
  await expectError(callTool(registry, "contacts.search", { query: "" }, ctx), "INVALID_INPUT");
});

test("the contacts client keeps only people who have an email address", async () => {
  const api = createContactsApi({
    getAccessToken: async () => "token",
    fetchImpl: (async () =>
      new Response(
        JSON.stringify({
          results: [
            { person: { names: [{ displayName: "Maya" }], emailAddresses: [{ value: "Maya@Example.com" }] } },
            { person: { names: [{ displayName: "No Email" }] } },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as typeof fetch,
  });
  assert.deepEqual(await api.search("maya", 5), [{ name: "Maya", emails: ["maya@example.com"] }]);
});
