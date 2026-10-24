import { defineTool } from "../../safety.ts";
import { READ_SCOPE } from "../scopes.ts";
import { searchThreadsInput, searchThreadsOutput } from "../types.ts";

export const searchThreads = defineTool({
  name: "gmail.search_threads",
  kind: "READ",
  description:
    "Search the user's Gmail. Returns short summaries: threadId, subject, sender, date, snippet. " +
    "Use Gmail search syntax, for example 'from:maya newer_than:14d'. " +
    "To read a message, call gmail.get_thread. If several threads could match, ask the user which one.",
  scopes: [READ_SCOPE],
  timeoutMs: 10_000,
  input: searchThreadsInput,
  output: searchThreadsOutput,
  run: async ({ query, maxResults }, ctx) => {
    return { threads: await ctx.gmail.searchThreads(query, maxResults) };
  },
});
