import axios from 'axios';

// Create an API service module pointing to the proxied '/sane-api/api/v1' endpoint
const scannerApi = axios.create({
  baseURL: '/sane-api/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

scannerApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

scannerApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
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

export interface ScannerContext {
  devices: Scanner[];
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
  [key: string]: unknown;
}

/**
 * Retrieve available scanners and configuration.
 */
export const fetchContext = async (): Promise<Scanner[]> => {
  const response = await scannerApi.get<{devices: Scanner[]}>('/context');
  return response.data.devices || [];
};

/**
 * Send a ScanRequest and return a ScanResponse.
 */
export const submitScan = async (request: ScanRequest): Promise<ScanResponse> => {
  const response = await scannerApi.post<ScanResponse>('/scan', request);
  return response.data;
};

export default scannerApi;
