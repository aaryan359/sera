import { ToolError } from "../safety.ts";

export interface DownloadOptions {
  baseUrl: string;
  getAccessToken: () => Promise<string>;
  fetchImpl?: typeof fetch | undefined;
}

// Downloads raw file bytes from a Google REST API (used for Drive file contents).
// Refuses anything larger than maxBytes.
export function createGoogleDownload(options: DownloadOptions) {
  const doFetch = options.fetchImpl ?? fetch;

  return async function download(path: string, maxBytes: number): Promise<Buffer> {
    const token = await options.getAccessToken();
    let res: Response;
    try {
      res = await doFetch(options.baseUrl + path, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(20_000),
      });
    } catch (err) {
      throw new ToolError("PROVIDER_ERROR", `Google download failed: ${String(err)}`);
    }
    if (res.status === 401) throw new ToolError("AUTH_EXPIRED", "Google access expired; reconnect the account");
    if (res.status === 404) throw new ToolError("NOT_FOUND", "file not found at Google");
    if (!res.ok) throw new ToolError("PROVIDER_ERROR", `Google download returned ${res.status}`);

    const data = Buffer.from(await res.arrayBuffer());
    if (data.byteLength > maxBytes) throw new ToolError("FILE_NOT_ALLOWED", "the file is larger than the limit");
    return data;
  };
}
