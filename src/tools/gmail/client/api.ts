import { createGoogleRequest } from "../../google/http.ts";

// ---- What our tools need from Gmail ----

export interface ThreadSummary {
  threadId: string;
  subject: string;
  from: string;
  date: string; // ISO 8601, UTC
  snippet: string;
}

export interface Message {
  messageId: string; // Gmail's id
  rfcMessageId: string; // the Message-ID header, used for reply threading
  from: string;
  to: string;
  cc: string;
  participants: string[]; // email addresses only, lowercase
  date: string;
  subject: string;
  body: string; // plain text, quoted replies removed, length-limited
  bodyTruncated: boolean;
}

export interface Thread {
  threadId: string;
  snippet: string;
  messages: Message[];
}

export interface GmailApi {
  searchThreads(query: string, max: number): Promise<ThreadSummary[]>;
  getThread(threadId: string): Promise<Thread>;
  // A write. If it times out, the message may still have been sent.
  sendRaw(raw: string, threadId?: string): Promise<{ messageId: string; threadId: string }>;
  // Looks up a sent message by its Message-ID. Pass the id WITHOUT < >.
  findSentMessage(messageId: string): Promise<{ messageId: string; threadId: string } | null>;
}

// ---- The real HTTP client ----

const BASE_URL = "https://gmail.googleapis.com/gmail/v1/users/me";
const BODY_LIMIT = 4000;

export interface GmailOptions {
  getAccessToken: () => Promise<string>;
  fetchImpl?: typeof fetch | undefined; // replaceable for tests
}

export function createGmailApi(options: GmailOptions): GmailApi {
  const request = createGoogleRequest({
    baseUrl: BASE_URL,
    getAccessToken: options.getAccessToken,
    fetchImpl: options.fetchImpl,
  });

  async function summarize(threadId: string): Promise<ThreadSummary> {
    const thread = await request(
      `/threads/${encodeURIComponent(threadId)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
    );
    const last = thread.messages?.at(-1);
    const h = headerMap(last?.payload?.headers);
    return {
      threadId,
      subject: h.subject ?? "",
      from: h.from ?? "",
      date: isoDate(last?.internalDate),
      snippet: (thread.snippet ?? "").slice(0, 200),
    };
  }

  return {
    async searchThreads(query, max) {
      const list = await request(`/threads?${new URLSearchParams({ q: query, maxResults: String(max) })}`);
      const ids: string[] = (list.threads ?? []).map((t: { id: string }) => t.id);
      // The tool allows at most 10 results, so fetching them all at once is fine.
      return Promise.all(ids.map((id) => summarize(id)));
    },

    async getThread(threadId) {
      const thread = await request(`/threads/${encodeURIComponent(threadId)}?format=full`);
      return {
        threadId,
        snippet: thread.snippet ?? "",
        messages: (thread.messages ?? []).map(toMessage),
      };
    },

    async sendRaw(raw, threadId) {
      // Without a threadId, Gmail starts a new conversation.
      const body = threadId ? { raw, threadId } : { raw };
      const sent = await request("/messages/send", body, true);
      return { messageId: sent.id, threadId: sent.threadId };
    },

    async findSentMessage(messageId) {
      const query = new URLSearchParams({ q: `rfc822msgid:${messageId}`, maxResults: "1" });
      const list = await request(`/messages?${query}`);
      const hit = list.messages?.[0];
      return hit ? { messageId: hit.id, threadId: hit.threadId } : null;
    },
  };
}

// ---- Helpers for reading Gmail's raw JSON ----

function headerMap(headers: { name: string; value: string }[] | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  for (const h of headers ?? []) result[h.name.toLowerCase()] = h.value;
  return result;
}

function isoDate(millis: string | undefined): string {
  return new Date(Number(millis ?? 0)).toISOString();
}

// "Maya <Maya@Example.com>, bob@x.com" -> ["maya@example.com", "bob@x.com"]
export function emailsIn(text: string): string[] {
  return (text.match(/[^\s<>,"]+@[^\s<>,"]+/g) ?? []).map((email) => email.toLowerCase());
}

interface RawPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: RawPart[];
}

interface RawMessage {
  id: string;
  internalDate?: string;
  payload?: RawPart & { headers?: { name: string; value: string }[] };
}

function toMessage(raw: RawMessage): Message {
  const h = headerMap(raw.payload?.headers);
  const { text, truncated } = bodyText(raw.payload);
  return {
    messageId: raw.id,
    rfcMessageId: h["message-id"] ?? "",
    from: h.from ?? "",
    to: h.to ?? "",
    cc: h.cc ?? "",
    participants: [h.from, h.to, h.cc].flatMap((value) => emailsIn(value ?? "")),
    date: isoDate(raw.internalDate),
    subject: h.subject ?? "",
    body: text,
    bodyTruncated: truncated,
  };
}

// Plain text is preferred. If there is none, HTML is converted to rough text.
function bodyText(payload: RawPart | undefined): { text: string; truncated: boolean } {
  const plain = findText(payload, "text/plain");
  const html = findText(payload, "text/html");
  const text = removeQuotedReply(plain ?? stripHtml(html ?? ""));
  return { text: text.slice(0, BODY_LIMIT), truncated: text.length > BODY_LIMIT };
}

// Walks through message parts and returns the first one with the given type.
function findText(part: RawPart | undefined, type: string): string | null {
  if (!part) return null;
  if (part.mimeType === type && part.body?.data) {
    return Buffer.from(part.body.data, "base64url").toString("utf8");
  }
  for (const child of part.parts ?? []) {
    const found = findText(child, type);
    if (found !== null) return found;
  }
  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Removes earlier messages quoted inside a reply. This saves a lot of tokens.
function removeQuotedReply(text: string): string {
  const kept: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (/^On .+wrote:$/.test(trimmed) || /^-{2,}\s*Original Message/i.test(trimmed)) break;
    if (!line.startsWith(">")) kept.push(line);
  }
  return kept.join("\n").trim();
}
