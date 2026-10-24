import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { ToolError } from "../../safety.ts";

// Reads one web page for the assistant. Blocks addresses inside the private network,
// because a link in an email or search result must not let the assistant reach internal services.

const MAX_BYTES = 1_000_000;
const TEXT_LIMIT = 4000;
const MAX_REDIRECTS = 3;

export interface PageResult {
  url: string;
  title: string;
  text: string;
  truncated: boolean;
}

export interface PageOptions {
  fetchImpl?: typeof fetch | undefined;
  // Looks up the IP addresses of a host. Replaceable for tests.
  resolveHost?: ((hostname: string) => Promise<string[]>) | undefined;
}

// Checks a URL before any network use. Throws BLOCKED_URL if it is not allowed.
export function checkUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw blocked("that is not a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw blocked("only http and https pages can be read");
  }
  if (url.username || url.password) throw blocked("URLs with a password are not allowed");
  if (url.port !== "" && url.port !== "80" && url.port !== "443") {
    throw blocked("only ports 80 and 443 are allowed");
  }
  const host = bare(url.hostname);
  if (host === "localhost" || host.endsWith(".localhost")) throw blocked("local addresses are not allowed");
  if (isIP(host) && isPrivateIp(host)) throw blocked("private network addresses are not allowed");
  return url;
}

// True for loopback, private, link-local, and other reserved addresses.
export function isPrivateIp(address: string): boolean {
  const ip = bare(address).toLowerCase();
  if (isIP(ip) === 4) {
    const [a = 0, b = 0] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  if (isIP(ip) === 6) {
    return (
      ip === "::" ||
      ip === "::1" ||
      ip.startsWith("::ffff:") ||
      /^f[cd]/.test(ip) || // fc00::/7 unique local
      /^fe[89ab]/.test(ip) // fe80::/10 link local
    );
  }
  return true; // not an IP address at all: treat as unsafe
}

// Reads a page. Checks every redirect and every resolved address before connecting.
export async function fetchPage(raw: string, options: PageOptions = {}): Promise<PageResult> {
  const doFetch = options.fetchImpl ?? fetch;
  const resolve = options.resolveHost ?? defaultResolve;
  let url = checkUrl(raw);

  for (let hop = 0; ; hop++) {
    const addresses = await resolve(bare(url.hostname));
    if (addresses.length === 0 || addresses.some(isPrivateIp)) {
      throw blocked("that site resolves to a private network address");
    }

    let res: Response;
    try {
      res = await doFetch(url.toString(), {
        redirect: "manual", // we follow redirects ourselves so each one is checked
        headers: { Accept: "text/html,text/plain", "User-Agent": "SeraAssistant/1.0" },
        signal: AbortSignal.timeout(8000),
      });
    } catch (err) {
      throw new ToolError("PROVIDER_ERROR", `could not load the page: ${String(err)}`);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location || hop >= MAX_REDIRECTS) throw new ToolError("PROVIDER_ERROR", "too many redirects");
      url = checkUrl(new URL(location, url).toString());
      continue;
    }

    if (!res.ok) throw new ToolError("PROVIDER_ERROR", `the page returned ${res.status}`);
    const type = res.headers.get("content-type") ?? "";
    if (!/^text\/(html|plain)/.test(type)) {
      throw new ToolError("PROVIDER_ERROR", "only HTML and plain-text pages can be read");
    }
    return toResult(url.toString(), await readLimited(res), type);
  }
}

async function defaultResolve(hostname: string): Promise<string[]> {
  const found = await lookup(hostname, { all: true });
  return found.map((entry) => entry.address);
}

// Reads at most MAX_BYTES of the response body.
async function readLimited(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Buffer[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(Buffer.from(value));
    total += value.byteLength;
  }
  await reader.cancel();
  return Buffer.concat(chunks).subarray(0, MAX_BYTES).toString("utf8");
}

function toResult(url: string, body: string, type: string): PageResult {
  const isHtml = type.startsWith("text/html");
  const titleMatch = isHtml ? body.match(/<title[^>]*>([\s\S]*?)<\/title>/i) : null;
  const title = decodeEntities((titleMatch?.[1] ?? "").replace(/<[^>]+>/g, "")).trim();
  const text = collapse(decodeEntities(isHtml ? stripTags(body) : body));
  return { url, title, text: text.slice(0, TEXT_LIMIT), truncated: text.length > TEXT_LIMIT };
}

// Removes the head section, scripts, styles, and all tags.
function stripTags(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// URL hostnames for IPv6 come in brackets, e.g. [::1]. Remove them.
function bare(host: string): string {
  return host.replace(/^\[|\]$/g, "");
}

function blocked(message: string): ToolError {
  return new ToolError("BLOCKED_URL", message);
}
