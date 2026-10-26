import { createGoogleDownload } from "../../google/download.ts";
import { createGoogleRequest } from "../../google/http.ts";

const DRIVE_URL = "https://www.googleapis.com/drive/v3";
const DOCS_URL = "https://docs.googleapis.com/v1";
const FIELDS = "id,name,mimeType,modifiedTime,size,md5Checksum";
const TEXT_LIMIT = 4000;

export interface FileInfo {
  fileId: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size: number | null;
  md5: string | null; // present for binary files (PDF, images), absent for Google Docs
}

export interface DocText {
  fileId: string;
  title: string;
  text: string;
  truncated: boolean;
}

// Google Drive and Google Docs. Tests use a fake that implements the same interface.
export interface DriveApi {
  searchFiles(query: string, max: number): Promise<FileInfo[]>;
  fileInfo(fileId: string): Promise<FileInfo>;
  readDoc(fileId: string): Promise<DocText>;
  // A write. If it times out, the text may or may not have been added.
  appendToDoc(fileId: string, text: string): Promise<{ fileId: string }>;
  download(fileId: string, maxBytes: number): Promise<Buffer>;
}

export interface DriveOptions {
  getAccessToken: () => Promise<string>;
  fetchImpl?: typeof fetch | undefined;
}

export function createDriveApi(options: DriveOptions): DriveApi {
  const drive = createGoogleRequest({ baseUrl: DRIVE_URL, getAccessToken: options.getAccessToken, fetchImpl: options.fetchImpl });
  const docs = createGoogleRequest({ baseUrl: DOCS_URL, getAccessToken: options.getAccessToken, fetchImpl: options.fetchImpl });
  const download = createGoogleDownload({ baseUrl: DRIVE_URL, getAccessToken: options.getAccessToken, fetchImpl: options.fetchImpl });

  return {
    async searchFiles(query, max) {
      // Quotes inside the name must be escaped for Drive's query language.
      const escaped = query.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      const params = new URLSearchParams({
        q: `name contains '${escaped}' and trashed = false`,
        pageSize: String(max),
        fields: `files(${FIELDS})`,
      });
      const data = await drive(`/files?${params}`);
      return (data.files ?? []).map(toFileInfo);
    },

    async fileInfo(fileId) {
      const data = await drive(`/files/${encodeURIComponent(fileId)}?fields=${FIELDS}`);
      return toFileInfo(data);
    },

    async readDoc(fileId) {
      const data = await docs(`/documents/${encodeURIComponent(fileId)}`);
      const full = docText(data);
      return {
        fileId,
        title: data.title ?? "",
        text: full.slice(0, TEXT_LIMIT),
        truncated: full.length > TEXT_LIMIT,
      };
    },

    async appendToDoc(fileId, text) {
      // endOfSegmentLocation with an empty segmentId means "the end of the document body".
      await docs(
        `/documents/${encodeURIComponent(fileId)}:batchUpdate`,
        { requests: [{ insertText: { endOfSegmentLocation: { segmentId: "" }, text: `\n${text}` } }] },
        true,
      );
      return { fileId };
    },

    async download(fileId, maxBytes) {
      return download(`/files/${encodeURIComponent(fileId)}?alt=media`, maxBytes);
    },
  };
}

function toFileInfo(raw: any): FileInfo {
  return {
    fileId: raw.id,
    name: raw.name ?? "",
    mimeType: raw.mimeType ?? "",
    modifiedTime: raw.modifiedTime ?? "",
    size: raw.size ? Number(raw.size) : null,
    md5: raw.md5Checksum ?? null,
  };
}

// Joins the text runs of a Google Docs body.
function docText(doc: any): string {
  let text = "";
  for (const item of doc.body?.content ?? []) {
    for (const element of item.paragraph?.elements ?? []) {
      text += element.textRun?.content ?? "";
    }
  }
  return text.trim();
}
