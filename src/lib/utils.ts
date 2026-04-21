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

const normalizeImageToJpeg = (file: File): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(objectUrl);
        if (!blob) { reject(new Error('canvas.toBlob failed')); return; }
        blob.arrayBuffer().then(resolve).catch(reject);
      }, 'image/jpeg', 0.92);
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')); };
    img.src = objectUrl;
  });

export const imagesToPdf = async (files: File[]): Promise<Blob> => {
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  for (const file of files) {
    let image;
    if (file.type === 'image/png') {
      const buf = await file.arrayBuffer();
      image = await pdf.embedPng(buf);
    } else if (file.type === 'image/jpeg') {
      const buf = await file.arrayBuffer();
      image = await pdf.embedJpg(buf);
    } else {
      const buf = await normalizeImageToJpeg(file);
      image = await pdf.embedJpg(buf);
    }
    const page = pdf.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  const bytes = await pdf.save();
  return new Blob([bytes as unknown as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
};
