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

type NupValue = 2 | 4 | 6;

const NUP_GRIDS: Record<NupValue, { cols: number; rows: number }> = {
  2: { cols: 2, rows: 1 },
  4: { cols: 2, rows: 2 },
  6: { cols: 3, rows: 2 },
};

const A4 = { width: 595, height: 842 };

export interface LayoutResult {
  cols: number;
  rows: number;
  rotate: boolean;
}

export const getOptimalLayout = (
  pageWidth: number,
  pageHeight: number,
  nup: NupValue,
): LayoutResult => {
  if (!pageWidth || !pageHeight) return { ...NUP_GRIDS[nup], rotate: false };

  let best: LayoutResult & { coverage: number; _aspectMatch: number } = {
    ...NUP_GRIDS[nup], rotate: false, coverage: 0, _aspectMatch: 0,
  };
  const srcAspect = pageWidth / pageHeight;
  const sheets = [{ w: A4.width, h: A4.height }, { w: A4.height, h: A4.width }];

  for (const sheet of sheets) {
    for (let cols = nup; cols >= 1; cols--) {
      if (nup % cols !== 0) continue;
      const rows = nup / cols;
      const cellW = sheet.w / cols;
      const cellH = sheet.h / rows;
      const cellAspect = cellW / cellH;

      const scale = Math.min(cellW / pageWidth, cellH / pageHeight);
      const coverage = (pageWidth * scale * pageHeight * scale * nup) / (sheet.w * sheet.h);

      const aspectMatch = -Math.abs(cellAspect - srcAspect);

      if (coverage > best.coverage + 1e-6 || (Math.abs(coverage - best.coverage) < 1e-6 && aspectMatch > best._aspectMatch)) {
        best = { cols, rows, rotate: sheet.w === A4.height, coverage, _aspectMatch: aspectMatch };
      }
    }
  }

  return { cols: best.cols, rows: best.rows, rotate: best.rotate };
};

export const createNupPdf = async (
  file: File,
  nup: NupValue | 1,
  direction: 'horizontal' | 'vertical',
  selectedPages?: number[],
  pageDims?: { pageWidth: number; pageHeight: number },
): Promise<Blob> => {
  if (nup === 1) return new Blob([await file.arrayBuffer()], { type: 'application/pdf' });

  const { PDFDocument } = await import('pdf-lib');
  const srcBytes = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(srcBytes);
  const srcTotalPages = srcDoc.getPageCount();

  const outDoc = await PDFDocument.create();
  const indices = selectedPages
    ? selectedPages.filter((p) => p >= 1 && p <= srcTotalPages).map((p) => p - 1)
    : [...Array(srcTotalPages).keys()];
  const embeddedPages = await outDoc.embedPdf(srcDoc, indices);
  const totalPages = indices.length;

  const { cols, rows, rotate } = getOptimalLayout(
    pageDims?.pageWidth ?? embeddedPages[0].width,
    pageDims?.pageHeight ?? embeddedPages[0].height,
    nup,
  );
  const sheetW = rotate ? A4.height : A4.width;
  const sheetH = rotate ? A4.width : A4.height;
  const cellW = sheetW / cols;
  const cellH = sheetH / rows;

  const sheetCount = Math.ceil(totalPages / nup);

  for (let sheet = 0; sheet < sheetCount; sheet++) {
    const outPage = outDoc.addPage([sheetW, sheetH]);

    for (let slot = 0; slot < nup; slot++) {
      const srcIdx = sheet * nup + slot;
      if (srcIdx >= totalPages) break;

      let col: number;
      let row: number;
      if (direction === 'vertical') {
        col = Math.floor(slot / rows);
        row = slot % rows;
      } else {
        col = slot % cols;
        row = Math.floor(slot / cols);
      }

      const ep = embeddedPages[srcIdx];
      const scale = Math.min(cellW / ep.width, cellH / ep.height);
      const drawW = ep.width * scale;
      const drawH = ep.height * scale;
      const x = col * cellW + (cellW - drawW) / 2;
      const y = sheetH - (row + 1) * cellH + (cellH - drawH) / 2;
      outPage.drawPage(ep, { x, y, width: drawW, height: drawH });
    }
  }

  const bytes = await outDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
};
