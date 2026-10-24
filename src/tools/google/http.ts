import { ToolError } from "../safety.ts";

export interface GoogleHttpOptions {
  baseUrl: string;
  getAccessToken: () => Promise<string>; // returns a valid token, refreshing if needed
  fetchImpl?: typeof fetch | undefined; // replaceable in tests
}

// Returns a function that calls one Google REST API.
// GET when there is no body, POST when there is one.
// isWrite marks calls that change data: if no answer comes back, the change may still have happened.
export function createGoogleRequest(options: GoogleHttpOptions) {
  const doFetch = options.fetchImpl ?? fetch;

  return async function request(path: string, body?: unknown, isWrite = false): Promise<any> {
    
    
    const headers: Record<string, string> = {
      Authorization: `Bearer ${await options.getAccessToken()}`,
    };


    const init: RequestInit = {
      method: body === undefined ? "GET" : "POST",
      headers,
      signal: AbortSignal.timeout(8000),
    };


    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    let res: Response;
    
    try {
      res = await doFetch(options.baseUrl + path, init);
    } catch (err) {
      throw new ToolError("PROVIDER_ERROR", `Google did not respond: ${String(err)}`, isWrite);
    }



    if (res.status === 401) throw new ToolError("AUTH_EXPIRED", "Google access expired; reconnect the account");
    if (res.status === 404) throw new ToolError("NOT_FOUND", "not found at Google");
    if (res.status === 429) throw new ToolError("RATE_LIMITED", "Google rate limit reached; try later");
    if (res.status >= 500) throw new ToolError("PROVIDER_ERROR", `Google error ${res.status}`, isWrite);
    if (!res.ok) throw new ToolError("PROVIDER_ERROR", `Google rejected the request (${res.status})`);
    return res.json();
  };
}
