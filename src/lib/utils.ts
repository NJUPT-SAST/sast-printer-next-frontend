import axios, { type AxiosInstance } from 'axios';

export const apiErrMsg = (err: unknown, fallback: string): string => {
  const e = err as { response?: { data?: { error?: string } }; message?: string };
  return e?.response?.data?.error ?? e?.message ?? fallback;
};

export const parseGMTDate = (dateStr: string): Date =>
  new Date(dateStr.replace(/-/g, '/') + ' GMT');

export const downloadFile = (url: string, filename: string): void => {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
};

export const createApiClient = (baseURL: string): AxiosInstance => {
  const client = axios.create({ baseURL });

  client.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status === 401) {
        if (!error.config._retry) {
          error.config._retry = true;
          await new Promise((resolve) => setTimeout(resolve, 500));
          return client(error.config);
        }
        localStorage.removeItem('token');
        window.location.href = '/';
      }
      return Promise.reject(error);
    },
  );

  return client;
};
