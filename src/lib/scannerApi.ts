import axios from "axios";

// Create an API service module pointing to the proxied '/sane-api/api/v1' endpoint
const scannerApi = axios.create({
  baseURL: "/sane-api/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

scannerApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

scannerApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      if (!error.config._retry) {
        error.config._retry = true;
        await new Promise((resolve) => setTimeout(resolve, 500));
        return scannerApi(error.config);
      }
      localStorage.removeItem("token");
      window.location.href = "/";
    }
    return Promise.reject(error);
  },
);

export interface ScannerOption {
  name: string;
  title: string;
  desc: string;
  type: string;
  unit: string;
  size: number;
  cap: string[];
  constraint_type: string;
  constraint: any;
  value: any;
}

export interface Scanner {
  id: string;
  name: string;
  features: Record<string, ScannerOption>;
  settings: Record<string, any>;
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

/**
 * Get the list of scanned files on the server.
 */
export const getScanFiles = async (): Promise<ScanFile[]> => {
  const response = await scannerApi.get<ScanFile[]>("/files");
  return response.data;
};

/**
 * Delete a scanned file from the server.
 */
export const deleteScanFile = async (filename: string): Promise<void> => {
  await scannerApi.delete(`/files/${filename}`);
};

/**
 * Retrieve available scanners and configuration.
 */
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

/**
 * Send a ScanRequest and return a ScanResponse.
 */
export const submitScan = async (
  request: ScanRequest,
): Promise<ScanResponse> => {
  const response = await scannerApi.post<ScanResponse>(
    "/scan?_t=" + Date.now(),
    request,
  );
  return response.data;
};

/**
 * Helper to get MIME type from filename extension
 */
const getMimeTypeFromFilename = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    default:
      return 'application/octet-stream';
  }
};

/**
 * Fetch a scanned file as a Blob.
 */
export const downloadScanFile = async (
  filename: string,
  onProgress?: (event: { loaded: number; total?: number }) => void,
): Promise<Blob> => {
  const response = await scannerApi.get<Blob>(`/files/${filename}`, {
    responseType: "blob",
    onDownloadProgress: (progressEvent) => {
      if (onProgress) {
        onProgress({
          loaded: progressEvent.loaded,
          total: progressEvent.total,
        });
      }
    },
  });
  
  const mimeType = getMimeTypeFromFilename(filename);
  return new Blob([response.data], { type: mimeType });
};

export default scannerApi;
