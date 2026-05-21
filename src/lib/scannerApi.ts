import { createApiClient } from "./utils";

const scannerApi = createApiClient("/sane-api/api/v1");

export interface ScannerOption {
  name: string;
  title: string;
  desc: string;
  type: string;
  unit: string;
  size: number;
  cap: string[];
  constraint_type: string;
  constraint: unknown;
  value: unknown;
  options?: string[];
  limits?: number[];
  interval?: number;
  default?: unknown;
}

export interface ScannerSettings {
  filters?: { options?: string[] };
  [key: string]: unknown;
}

export interface Scanner {
  id: string;
  name: string;
  features: Record<string, ScannerOption>;
  settings: ScannerSettings;
  pipelines?: string[];
  [key: string]: unknown;
}

export interface PaperSize {
  name: string;
  dimensions: { x: number; y: number };
}

export interface ScannerContext {
  devices: Scanner[];
  paperSizes?: PaperSize[];
  [key: string]: unknown;
}

export interface ScanRequest {
  params: {
    deviceId: string;
    resolution: string;
    mode: string;
    [key: string]: unknown;
  };
  pipeline: string;
  [key: string]: unknown;
}

export interface ScanResponse {
  file: ScanFile;
  [key: string]: unknown;
}

export interface ScanFile {
  fullname: string;
  extension: string;
  lastModified: number | string;
  size: number;
  sizeString: string;
  isDirectory: boolean;
  name: string;
  path: string;
}

const normalizeExtension = (extension?: string): string =>
  extension?.replace(/^\./, "").toLowerCase() ?? "";

export const getScanFileDisplayName = (file: ScanFile): string => {
  if (file.fullname) return file.fullname;

  const extension = normalizeExtension(file.extension);
  if (!extension || file.name.toLowerCase().endsWith(`.${extension}`)) {
    return file.name;
  }

  return `${file.name}.${extension}`;
};

const getScanFileRequestName = (file: ScanFile | string): string =>
  typeof file === "string" ? file : file.name || file.fullname;

export const getScanFiles = async (): Promise<ScanFile[]> => {
  const response = await scannerApi.get<ScanFile[]>("/files");
  return response.data;
};

export const deleteScanFile = async (filename: string): Promise<void> => {
  await scannerApi.delete(`/files/${filename}`);
};

export const fetchContext = async (): Promise<{
  devices: Scanner[];
  paperSizes: PaperSize[];
}> => {
  const response = await scannerApi.get<ScannerContext>(
    "/context?_t=" + Date.now(),
  );
  return {
    devices: response.data.devices || [],
    paperSizes: response.data.paperSizes || [],
  };
};

export const submitScan = async (
  request: ScanRequest,
): Promise<ScanResponse> => {
  const response = await scannerApi.post<ScanResponse>(
    "/scan?_t=" + Date.now(),
    request,
  );
  return response.data;
};

const getMimeTypeFromExtension = (extension: string): string => {
  switch (normalizeExtension(extension)) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    default:
      return "";
  }
};

const getExtensionFromPath = (path: string): string => {
  const filename = path.split("/").pop() ?? path;
  const dotIndex = filename.lastIndexOf(".");
  return dotIndex >= 0 ? filename.slice(dotIndex + 1) : "";
};

const getMimeTypeFromScanFile = (file: ScanFile | string): string => {
  if (typeof file !== "string") {
    return (
      getMimeTypeFromExtension(file.extension) ||
      getMimeTypeFromExtension(getExtensionFromPath(file.fullname)) ||
      getMimeTypeFromExtension(getExtensionFromPath(file.path)) ||
      getMimeTypeFromExtension(getExtensionFromPath(file.name)) ||
      "application/octet-stream"
    );
  }

  return (
    getMimeTypeFromExtension(getExtensionFromPath(file)) ||
    "application/octet-stream"
  );
};

const normalizeMimeType = (mimeType?: string): string => {
  const type = mimeType?.split(";")[0]?.trim().toLowerCase() ?? "";
  return type && type !== "application/octet-stream" ? type : "";
};

export const isPdfScanFile = (file: ScanFile): boolean =>
  getMimeTypeFromScanFile(file) === "application/pdf";

const withBlobType = (blob: Blob, type: string): Blob => {
  if (!type || blob.type === type) return blob;
  return blob.slice(0, blob.size, type);
};

const getResponseContentType = (headers: unknown): string => {
  if (!headers) return "";
  const headerGetter = headers as {
    get?: (name: string) => string | null;
  };
  if (typeof headerGetter.get === "function") {
    return headerGetter.get("content-type") ?? "";
  }
  return (
    (headers as Record<string, string | undefined>)["content-type"] ??
    (headers as Record<string, string | undefined>)["Content-Type"] ??
    ""
  );
};

const getMimeTypeForDownloadedBlob = (
  blob: Blob,
  responseHeaders: unknown,
  file: ScanFile | string,
): string => {
  const metadataMimeType = getMimeTypeFromScanFile(file);
  return (
    normalizeMimeType(metadataMimeType) ||
    normalizeMimeType(blob.type) ||
    normalizeMimeType(getResponseContentType(responseHeaders)) ||
    metadataMimeType
  );
};

export const downloadScanFile = async (
  file: ScanFile | string,
  onProgress?: (event: { loaded: number; total?: number }) => void,
): Promise<Blob> => {
  const filename = getScanFileRequestName(file);
  const response = await scannerApi.get<Blob>(`/files/${filename}`, {
    responseType: "blob",
    onDownloadProgress: (e) =>
      onProgress?.({ loaded: e.loaded, total: e.total }),
  });
  const responseBlob =
    response.data instanceof Blob ? response.data : new Blob([response.data]);
  return withBlobType(
    responseBlob,
    getMimeTypeForDownloadedBlob(responseBlob, response.headers, file),
  );
};

export default scannerApi;
