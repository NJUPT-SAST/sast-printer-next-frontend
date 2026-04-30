import { createApiClient } from './utils';

const scannerApi = createApiClient('/sane-api/api/v1');

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

export const getScanFiles = async (): Promise<ScanFile[]> => {
  const response = await scannerApi.get<ScanFile[]>('/files');
  return response.data;
};

export const deleteScanFile = async (filename: string): Promise<void> => {
  await scannerApi.delete(`/files/${filename}`);
};

export const fetchContext = async (): Promise<{ devices: Scanner[]; paperSizes: PaperSize[] }> => {
  const response = await scannerApi.get<ScannerContext>('/context?_t=' + Date.now());
  return {
    devices: response.data.devices || [],
    paperSizes: response.data.paperSizes || [],
  };
};

export const submitScan = async (request: ScanRequest): Promise<ScanResponse> => {
  const response = await scannerApi.post<ScanResponse>('/scan?_t=' + Date.now(), request);
  return response.data;
};

const getMimeTypeFromFilename = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    default: return 'application/octet-stream';
  }
};

export const downloadScanFile = async (
  filename: string,
  onProgress?: (event: { loaded: number; total?: number }) => void,
): Promise<Blob> => {
  const response = await scannerApi.get<Blob>(`/files/${filename}`, {
    responseType: 'blob',
    onDownloadProgress: (e) => onProgress?.({ loaded: e.loaded, total: e.total }),
  });
  return new Blob([response.data], { type: getMimeTypeFromFilename(filename) });
};

export default scannerApi;
