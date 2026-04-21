import React from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf';
import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { Loader2 } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

GlobalWorkerOptions.workerSrc = pdfWorker;

/* eslint-disable react-refresh/only-export-components */
export const renderPdfToImages = async (blob: Blob) => {
  const data = await blob.arrayBuffer();
  const task = getDocument({ data });
  const doc = await task.promise;
  const totalPages = doc.numPages;
  const images: string[] = [];

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
  }

  await doc.destroy();
  return { totalPages, images };
};

export interface DocumentPreviewProps {
  images: string[];
  loading?: boolean;
  error?: string | null;
  loadingText?: string;
  fallbackNode?: React.ReactNode;
}

export function DocumentPreview({
  images,
  loading,
  error,
  loadingText,
  fallbackNode,
}: DocumentPreviewProps) {
  const { t } = useTranslation();

  return (
    <div className="w-full rounded-xl border border-gray-200 bg-gray-50 overflow-hidden flex flex-col flex-1 min-h-0">
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          {loadingText || t('printer.previewGenerating')}
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center px-6 text-center text-red-600 text-sm">
          {error}
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
