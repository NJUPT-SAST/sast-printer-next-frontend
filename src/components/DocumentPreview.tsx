import React from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf';
import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { Loader2 } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { getOptimalLayout } from '@/lib/utils';

GlobalWorkerOptions.workerSrc = pdfWorker;

/* eslint-disable react-refresh/only-export-components */
export interface PageDimensions {
  pageWidth: number;
  pageHeight: number;
}

export const renderPdfToImages = async (blob: Blob) => {
  const data = await blob.arrayBuffer();
  const task = getDocument({ data });
  const doc = await task.promise;
  const totalPages = doc.numPages;
  const images: string[] = [];
  const pageDimensions: PageDimensions[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.2 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      continue;
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvas, canvasContext: context, viewport }).promise;
    images.push(canvas.toDataURL('image/png'));
    pageDimensions.push({
      pageWidth: viewport.width / viewport.scale,
      pageHeight: viewport.height / viewport.scale,
    });
  }

  await doc.destroy();
  return { totalPages, images, pageDimensions };
};

export interface DocumentPreviewProps {
  images: string[];
  loading?: boolean;
  error?: string | null;
  loadingText?: string;
  fallbackNode?: React.ReactNode;
  nup?: 2 | 4 | 6;
  nupDirection?: 'horizontal' | 'vertical';
  pageDimensions?: PageDimensions[];
}

export function DocumentPreview({
  images,
  loading,
  error,
  loadingText,
  fallbackNode,
  nup,
  nupDirection = 'horizontal',
  pageDimensions,
}: DocumentPreviewProps) {
  const { t } = useTranslation();

  const renderNupGrid = () => {
    if (!nup || nup <= 1) return null;
    const layout = pageDimensions?.[0]
      ? getOptimalLayout(pageDimensions[0].pageWidth, pageDimensions[0].pageHeight, nup)
      : null;
    const cols = layout?.cols ?? (nup === 6 ? 3 : 2);
    const rows = layout?.rows ?? (nup === 2 ? 1 : 2);
    const perSheet = nup;
    const sheetCount = Math.ceil(images.length / perSheet);
    const sheets: JSX.Element[] = [];

    for (let s = 0; s < sheetCount; s++) {
      const startPage = s * perSheet + 1;
      const endPage = Math.min((s + 1) * perSheet, images.length);
      const sheetImages: string[] = [];
      for (let slot = 0; slot < perSheet; slot++) {
        const srcIdx = s * perSheet + slot;
        if (srcIdx >= images.length) break;
        sheetImages.push(images[srcIdx]);
      }

      sheets.push(
        <div key={`sheet-${s}`} className="bg-white rounded-lg border border-gray-200 shadow-sm p-2">
          <p className="text-xs text-gray-500 mb-2">
            {t('printer.nupSheet', { sheet: s + 1, start: startPage, end: endPage })}
          </p>
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gridTemplateRows: `repeat(${rows}, 1fr)`,
              gridAutoFlow: nupDirection === 'vertical' ? 'column' : 'row',
            }}
          >
            {sheetImages.map((src, i) => (
              <img
                key={`page-${s * perSheet + i}`}
                src={src}
                alt={t('printer.previewPage', { page: s * perSheet + i + 1 })}
                className="w-full h-auto rounded border border-gray-100"
              />
            ))}
          </div>
        </div>,
      );
    }
    return sheets;
  };

  const isNup = nup && nup > 1 && images.length > 0;

  return (
    <div className="w-full rounded-b-xl border-t border-gray-200 bg-gray-50 overflow-hidden flex flex-col flex-1 min-h-0">
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          {loadingText || t('printer.previewGenerating')}
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center px-6 text-center text-red-600 text-sm">
          {error}
        </div>
      ) : isNup ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-gray-100">
          {renderNupGrid()}
        </div>
      ) : images.length > 0 ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-gray-100">
          {images.map((image, index) => (
            <div
              key={`preview-page-${index + 1}`}
              className="bg-white rounded-lg border border-gray-200 shadow-sm p-2"
            >
              <p className="text-xs text-gray-500 mb-2">
                {t('printer.previewPage', { page: index + 1 })}
              </p>
              <img
                src={image}
                alt={t('printer.previewPage', { page: index + 1 })}
                className="w-full h-auto rounded"
              />
            </div>
          ))}
        </div>
      ) : fallbackNode ?? null}
    </div>
  );
}
