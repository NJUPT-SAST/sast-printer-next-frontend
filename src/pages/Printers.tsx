import { useEffect, useState, useRef, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { useUi } from '@/components/ui-context';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf';
import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { ChevronLeft, PrinterIcon, UploadCloud, FileText, Loader2, RefreshCw, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import PrinterList from '@/components/PrinterList';

GlobalWorkerOptions.workerSrc = pdfWorker;

interface PrinterInfo {
  id: string;
  name: string;
  description: string;
  status: string;
  model: string;
  location: string;
  duplex_mode: string;
  note?: string;
}

interface SupportedFileTypesResponse {
  supported_file_types: string[];
  count: number;
  office_conversion_enabled: boolean;
}

function PrinterContent() {
  const { t } = useTranslation();
  const { toast } = useUi();
  const router = useNavigate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');

  const [printer, setPrinter] = useState<PrinterInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [supportedFileTypes, setSupportedFileTypes] = useState<string[]>(['pdf']);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewPageCount, setPreviewPageCount] = useState<number | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [copies, setCopies] = useState(1);
  const [duplex, setDuplex] = useState('off');
  const [collate, setCollate] = useState('true');
  const [pageSet, setPageSet] = useState('all');
  const [pages, setPages] = useState('');
  const [pagesError, setPagesError] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [manualDuplexHook, setManualDuplexHook] = useState<{ url: string, expiresAt: string } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submittingDuplex, setSubmittingDuplex] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const acceptValue = supportedFileTypes.map((ext) => `.${ext}`).join(',');
  const supportedTypesText = supportedFileTypes.map((ext) => `.${ext}`).join(', ');

  const getFileExtension = (fileName: string) => {
    const parts = fileName.split('.');
    if (parts.length <= 1) return '';
    return parts[parts.length - 1].toLowerCase();
  };

  const isSupportedFile = (targetFile: File) => {
    const ext = getFileExtension(targetFile.name);
    return supportedFileTypes.includes(ext);
  };

  const rejectUnsupportedFile = () => {
    toast({
      message: t('printer.unsupportedFileType', { types: supportedTypesText }),
      type: 'error',
    });
  };

  const validatePageRange = (input: string, maxPage?: number | null, strictBounds = false) => {
    if (!input.trim()) {
      return { valid: true, error: '' };
    }

    if (strictBounds && !maxPage) {
      return { valid: false, error: t('printer.pageCountUnavailable') };
    }

    const trimmed = input.trim();
    const parts = trimmed.split(',').map((p) => p.trim());

    for (const part of parts) {
      if (!part) {
        return { valid: false, error: t('printer.pageRangeEmpty') };
      }

      if (part.includes('-')) {
        const rangeParts = part.split('-').map((s) => s.trim());
        if (rangeParts.length !== 2) {
          return { valid: false, error: t('printer.pageRangeInvalid') };
        }

        const [startStr, endStr] = rangeParts;

        if (!startStr || !endStr) {
          return { valid: false, error: t('printer.pageRangeInvalid') };
        }

        if (!/^\d+$/.test(startStr) || !/^\d+$/.test(endStr)) {
          return { valid: false, error: t('printer.pageRangeInvalid') };
        }

        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);

        if (isNaN(start) || isNaN(end) || start <= 0 || end <= 0) {
          return { valid: false, error: t('printer.pageRangeInvalid') };
        }

        if (start > end) {
          return { valid: false, error: t('printer.pageRangeInvalid') };
        }

        if (maxPage && (start > maxPage || end > maxPage)) {
          return { valid: false, error: t('printer.pageRangeOutOfBounds', { max: maxPage }) };
        }
      } else {
        if (!/^\d+$/.test(part)) {
          return { valid: false, error: t('printer.pageRangeInvalid') };
        }

        const page = parseInt(part, 10);

        if (isNaN(page) || page <= 0) {
          return { valid: false, error: t('printer.pageRangeInvalid') };
        }

        if (maxPage && page > maxPage) {
          return { valid: false, error: t('printer.pageRangeOutOfBounds', { max: maxPage }) };
        }
      }
    }

    return { valid: true, error: '' };
  };

  const getSelectedPageCount = (input: string, maxPage?: number | null) => {
    const { valid } = validatePageRange(input, maxPage);
    if (!valid || !input.trim()) {
      return null;
    }

    const selectedPages = new Set<number>();
    const parts = input.trim().split(',').map((part) => part.trim());

    for (const part of parts) {
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-').map((segment) => segment.trim());
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);

        for (let page = start; page <= end; page += 1) {
          selectedPages.add(page);
        }
      } else {
        selectedPages.add(parseInt(part, 10));
      }
    }

    return selectedPages.size;
  };

  const selectedPageCount = getSelectedPageCount(pages, previewPageCount);
  const isDuplexDisabled = (previewPageCount !== null && previewPageCount <= 1) || (selectedPageCount === 1);

  const handlePagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPages(value);

    const { error } = validatePageRange(value, previewPageCount);
    setPagesError(error);

    if (value.trim() === '') {
      return;
    }

    if ((previewPageCount !== null && previewPageCount <= 1) || getSelectedPageCount(value, previewPageCount) === 1) {
      setDuplex('off');
    }
  };

  const renderPdfToImages = async (blob: Blob) => {
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

  useEffect(() => {
    if (manualDuplexHook?.expiresAt) {
      const updateTimer = () => {
        const remaining = Math.max(0, new Date(manualDuplexHook.expiresAt.replace(/-/g, '/') + ' GMT').getTime() - Date.now());
        setTimeLeft(remaining);
        if (remaining === 0) {
          setManualDuplexHook(null);
          router('/jobs');
        }
      };
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    } else {
      setTimeLeft(null);
    }
  }, [manualDuplexHook]);

  useEffect(() => {
    const fetchSupportedFileTypes = async () => {
      try {
        const response = await api.get<SupportedFileTypesResponse>('/jobs/supported-file-types');
        const types = (response.data.supported_file_types || [])
          .map((item) => String(item || '').trim().toLowerCase())
          .filter(Boolean);

        const uniqueTypes = Array.from(new Set(types));
        setSupportedFileTypes(uniqueTypes.length > 0 ? uniqueTypes : ['pdf']);
      } catch (err: unknown) {
        setSupportedFileTypes(['pdf']);
      }
    };

    fetchSupportedFileTypes();
  }, []);

  useEffect(() => {
    if (!file) {
      setPreviewLoading(false);
      setPreviewError(null);
      setPreviewPageCount(null);
      setPreviewPdfUrl((oldUrl) => {
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        return null;
      });
      setPreviewImages([]);
      return;
    }

    const controller = new AbortController();

    const fetchPreview = async () => {
      setPreviewLoading(true);
      setPreviewError(null);

      try {
        const formData = new FormData();
        formData.append('file', file);
        if (id) {
          formData.append('printer_id', id);
        }

        const response = await api.post('/jobs/preview', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          responseType: 'blob',
          signal: controller.signal,
        });

        const blob = response.data as Blob;
        const objectUrl = URL.createObjectURL(blob);
        setPreviewPdfUrl((oldUrl) => {
          if (oldUrl) URL.revokeObjectURL(oldUrl);
          return objectUrl;
        });
        const { totalPages, images } = await renderPdfToImages(blob);
        setPreviewPageCount(totalPages);
        setPreviewImages(images);
      } catch (err: unknown) {
        // Ignore cancellation errors from rapid file changes.
        if (typeof err === 'object' && err !== null && 'name' in err && err.name === 'CanceledError') {
          return;
        }

        setPreviewImages([]);
        setPreviewPageCount(null);
        setPreviewPdfUrl((oldUrl) => {
          if (oldUrl) URL.revokeObjectURL(oldUrl);
          return null;
        });

        let msg = t('printer.previewLoadFailed');
        if (err instanceof Error) msg = err.message;
        const anyErr = err as { response?: { data?: { error?: string } } };
        if (anyErr.response?.data?.error) msg = anyErr.response.data.error;
        setPreviewError(msg);
      } finally {
        setPreviewLoading(false);
      }
    };

    fetchPreview();

    return () => {
      controller.abort();
    };
  }, [file, id, previewVersion, t]);

  useEffect(() => {
    return () => {
      if (previewPdfUrl) {
        URL.revokeObjectURL(previewPdfUrl);
      }
    };
  }, [previewPdfUrl]);

  useEffect(() => {
    const { error: rangeError } = validatePageRange(pages, previewPageCount);
    setPagesError(rangeError);
  }, [pages, previewPageCount]);

  useEffect(() => {
    if (isDuplexDisabled && duplex === 'true') {
      setDuplex('off');
    }
  }, [duplex, isDuplexDisabled]);

  useEffect(() => {
    const fetchPrinter = async () => {
      try {
        const response = await api.get(`/printers/${id}`);
        setPrinter(response.data);
        if (response.data.duplex_mode !== 'off') {
          setDuplex(response.data.duplex_mode === 'auto' ? 'true' : 'manual');
        }
      } catch (err: unknown) {
        let msg = t('error.fetchPrinters');
        if (err instanceof Error) msg = err.message;
        const anyErr = err as { response?: { data?: { error?: string } } };
        if (anyErr.response?.data?.error) msg = anyErr.response.data.error;
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchPrinter();
    } else {
      setLoading(false);
    }
  }, [id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (!isSupportedFile(selectedFile)) {
        rejectUnsupportedFile();
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (dragCounter.current === 1) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (isSupportedFile(droppedFile)) {
        setFile(droppedFile);
      } else {
        rejectUnsupportedFile();
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast({ message: t('printer.tapToSelect'), type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('printer_id', id || '');
      formData.append('file', file);

      const { valid, error: validationError } = validatePageRange(pages, previewPageCount, true);
      if (!valid) {
        setPagesError(validationError);
        toast({ message: validationError || t('printer.pageRangeInvalid'), type: 'error' });
        return;
      }

      const queryParams = new URLSearchParams();
      queryParams.append('copies', copies.toString());
      if (duplex !== 'off') {
        queryParams.append('duplex', duplex);
      }
      queryParams.append('collate', collate);

      let finalPages = pages.trim();
      if (pageSet !== 'all') {
        const maxPage = previewPageCount;
        if (!maxPage && !finalPages) {
          toast({ message: t('printer.pageCountUnavailable') || 'Page count unavailable', type: 'error' });
          setSubmitting(false);
          return;
        }

        let pagesList: number[] = [];
        if (!finalPages && maxPage) {
          pagesList = Array.from({ length: maxPage }, (_, i) => i + 1);
        } else {
          const selectedPages = new Set<number>();
          const parts = finalPages.split(',').map((p) => p.trim());
          for (const part of parts) {
            if (part.includes('-')) {
              const [start, end] = part.split('-').map(Number);
              for (let i = start; i <= end; i++) selectedPages.add(i);
            } else if (part) {
              selectedPages.add(Number(part));
            }
          }
          pagesList = Array.from(selectedPages).sort((a, b) => a - b);
        }

        pagesList = pagesList.filter((p) => pageSet === 'odd' ? p % 2 !== 0 : p % 2 === 0);
        finalPages = pagesList.join(',');

        if (!finalPages) {
          toast({ message: t('printer.pageRangeInvalid'), type: 'error' });
          setSubmitting(false);
          return;
        }
      }

      if (finalPages) {
        queryParams.append('pages', finalPages);
      }

      const response = await api.post(`/jobs?${queryParams.toString()}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.hook_url) {
        setManualDuplexHook({
          url: response.data.hook_url,
          expiresAt: response.data.hook_expires_at,
        });
        toast({ message: t('printer.manualDuplexWait'), type: 'success' });
      } else {
        toast({ message: t('printer.success'), type: 'success' });
        router('/jobs');
      }

    } catch (err: unknown) {
      let msg = t('error.submit');
      if (err instanceof Error) msg = err.message;
      const anyErr = err as { response?: { data?: { error?: string } } };
      if (anyErr.response?.data?.error) msg = anyErr.response.data.error;
      toast({ message: `${t('error.submit')}: ${msg}`, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleContinueDuplex = async () => {
    if (!manualDuplexHook) return;
    setSubmittingDuplex(true);
    try {
      await api.post(manualDuplexHook.url);
      toast({ message: t('printer.success'), type: 'success' });
      setManualDuplexHook(null);
      router('/jobs');
    } catch (err: unknown) {
      let msg = t('error.submit');
      if (err instanceof Error) msg = err.message;
      const anyErr = err as { response?: { data?: { error?: string } } };
      if (anyErr.response?.data?.error) msg = anyErr.response.data.error;
      toast({ message: `${t('error.submit')}: ${msg}`, type: 'error' });
    } finally {
      setSubmittingDuplex(false);
    }
  };

  const handleCancelDuplex = async () => {
    if (!manualDuplexHook) return;
    setSubmittingDuplex(true);
    try {
      await api.post(manualDuplexHook.url.replace('/continue', '/cancel'));
      toast({ message: t('printer.duplexCancelled'), type: 'success' });
    } catch (err: unknown) {
      // Ignored
    } finally {
      setManualDuplexHook(null);
      setSubmittingDuplex(false);
      router('/jobs');
    }
  };

  const handleDownloadPreview = () => {
    if (!previewPdfUrl) return;

    const anchor = document.createElement('a');
    anchor.href = previewPdfUrl;
    anchor.download = file ? `${file.name.replace(/\.[^.]+$/, '')}.pdf` : 'preview.pdf';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (id && (error || !printer)) {
    return (
      <div className="p-4 max-w-2xl mx-auto mt-8">
        <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100">
          <p className="font-medium">{error || t('home.noPrinters')}</p>
          <button
            onClick={() => router('/')}
            className="mt-3 text-sm underline hover:text-red-800"
          >
            ← {t('printer.back')}
          </button>
        </div>
      </div>
    );
  }

  if (!id) {
    return <PrinterList />;
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 w-full pb-20">
      {manualDuplexHook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl border border-gray-100 flex flex-col items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <PrinterIcon className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">{t('printer.manualDuplexTitle')}</h3>
            <p className="text-gray-600 text-center mb-4">
              {t('printer.manualDuplexDesc')}
            </p>
            {timeLeft !== null && (
              <div className="text-sm font-medium text-orange-600 mb-6 bg-orange-50 px-3 py-1 rounded-full text-center flex items-center justify-center space-x-2">
                <span>{t('printer.timeLeft')}</span>
                <span>{Math.max(0, Math.floor(timeLeft / 1000 / 60))}:{Math.max(0, Math.floor(timeLeft / 1000 % 60)).toString().padStart(2, '0')}</span>
              </div>
            )}
            <div className="flex w-full space-x-3">
              <button
                onClick={handleCancelDuplex}
                disabled={submittingDuplex}
                className="flex-1 py-3 px-4 rounded-xl border border-gray-300 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-colors disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleContinueDuplex}
                disabled={submittingDuplex}
                className="flex-1 py-3 px-4 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {submittingDuplex ? <Loader2 className="w-5 h-5 animate-spin" /> : t('common.continue')}
              </button>
            </div>
          </div>
        </div>
      )}
      <Link to="/" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4 mr-1" />
        {t('printer.back')}
      </Link>

      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm mb-6">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-blue-50 rounded-xl">
            <PrinterIcon className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{printer?.name}</h1>
            <p className="text-gray-500 mt-1">{printer?.location} &bull; {printer?.model}</p>
            {printer?.description && <p className="text-sm text-gray-400 mt-2">{printer.description}</p>}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('printer.document')}</h2>

            <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('printer.selectFile')} <span className="text-red-500">*</span></label>
            <div
              className={`group border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
                ${isDragging ? 'border-blue-500 bg-blue-50' : file ? 'border-green-300 bg-green-50 hover:border-blue-400 hover:bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50 bg-gray-50'}`}
              onClick={() => fileInputRef.current?.click()} onDragEnter={handleDragEnter} onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept={acceptValue}
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              {file ? (
                <div className="flex flex-col items-center pointer-events-none">
                  <FileText className={`w-10 h-10 mb-3 transition-colors ${isDragging ? 'text-blue-500' : 'text-green-600 group-hover:text-blue-500'}`} />
                  <span className={`font-medium transition-colors ${isDragging ? 'text-blue-700' : 'text-green-800 group-hover:text-blue-700'}`}>{file.name}</span>
                  <span className={`text-xs mt-1 transition-colors ${isDragging ? 'text-blue-600' : 'text-green-600 group-hover:text-blue-600'}`}>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  <button type="button" className={`mt-3 text-xs underline pointer-events-auto transition-colors ${isDragging ? 'text-blue-600' : 'text-green-600 group-hover:text-blue-600'}`} onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setPreviewVersion(0);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}>{t('printer.changeFile')}</button>
                </div>
              ) : (
                <div className="flex flex-col items-center pointer-events-none">
                  <UploadCloud className={`w-10 h-10 mb-3 transition-colors ${isDragging ? 'text-blue-500' : 'text-gray-400 group-hover:text-blue-500'}`} />
                  <span className={`font-medium transition-colors ${isDragging ? 'text-blue-600' : 'text-gray-600 group-hover:text-blue-600'}`}>{t('printer.tapToSelectWithTypes')}</span>
                  <span className="text-xs text-gray-400 mt-1">{supportedTypesText}</span>
                </div>
              )}
            </div>
          </div>



          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('printer.copies')}</label>
              <input
                type="number"
                min="1"
                max="100"
                value={copies}
                onChange={(e) => setCopies(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('printer.collate')}</label>
              <select
                value={collate}
                onChange={(e) => setCollate(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white transition-shadow appearance-none"
              >
                <option value="true">{t('printer.yes')} (1,2,3...1,2,3)</option>
                <option value="false">{t('printer.no')} (1,1...2,2...)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('printer.pageSet') || 'Page Set'}</label>
              <select
                value={pageSet}
                onChange={(e) => setPageSet(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white transition-shadow appearance-none"
              >
                <option value="all">{t('printer.pageSetAll') || 'All Pages'}</option>
                <option value="odd">{t('printer.pageSetOdd') || 'Odd Pages'}</option>
                <option value="even">{t('printer.pageSetEven') || 'Even Pages'}</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('printer.pageRange')}</label>
              <input
                type="text"
                value={pages}
                onChange={handlePagesChange}
                placeholder={t('printer.pageRangePlaceholder')}
                className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:outline-none transition-shadow ${pagesError
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500 bg-red-50'
                  : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                  }`}
              />
              {pagesError && (
                <p className="mt-1 text-xs text-red-600">{pagesError}</p>
              )}
              {previewPageCount && (
                <p className="mt-1 text-xs text-gray-500">{t('printer.totalPages', { count: previewPageCount })}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">{t('printer.pageRangeHelp')}</p>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.duplex')}</label>
              <div className="flex gap-4">
                <label className="flex-1 w-full flex items-center p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="duplex"
                    value="off"
                    checked={duplex === 'off'}
                    onChange={() => setDuplex('off')}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="ml-3 block text-sm font-medium text-gray-900">{t('printer.simplex')}</span>
                </label>

                  <label className={`flex-1 w-full flex items-center p-3 border border-gray-200 rounded-xl cursor-pointer transition-colors ${printer?.duplex_mode === 'off' || isDuplexDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}>
                  <input
                    type="radio"
                    name="duplex"
                    value="true"
                    checked={duplex === 'true'}
                    onChange={() => setDuplex('true')}
                    disabled={printer?.duplex_mode === 'off' || isDuplexDisabled}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <div className="ml-3">
                    <span className="block text-sm font-medium text-gray-900">{t('printer.doubleSided')}</span>
                    <span className="block text-xs text-gray-500">{t(printer?.duplex_mode === 'auto' ? 'printer.auto' : 'printer.manual')}</span>
                  </div>
                </label>
              </div>
              {isDuplexDisabled && (
                <p className="mt-2 text-xs text-gray-500">
                  {t('printer.duplexDisabledForSinglePage')}
                </p>
              )}
            </div>
          </div>
        </div>
        </div>

        {/* Right Column */}
        <div className="w-full lg:w-[400px] xl:w-[500px] flex flex-col space-y-6">
          {file && (
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex-1">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">{t('printer.preview')}</label>
                {previewError && (
                  <button
                    type="button"
                    onClick={() => setPreviewVersion((v) => v + 1)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                    aria-label={t('printer.retryPreview')}
                    title={t('printer.retryPreview')}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                )}
                {!previewError && previewPdfUrl && !previewLoading && (
                  <button
                    type="button"
                    onClick={handleDownloadPreview}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                    aria-label={t('printer.downloadFile')}
                    title={t('printer.downloadFile')}
                  >
                    <Download className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="h-[480px] rounded-xl border border-gray-200 bg-gray-50 overflow-hidden flex flex-col">
                {previewLoading && (
                  <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {t('printer.previewGenerating')}
                  </div>
                )}

                {!previewLoading && previewError && (
                  <div className="w-full h-full flex items-center justify-center px-6 text-center text-red-600 text-sm">
                    {previewError}
                  </div>
                )}

                {!previewLoading && !previewError && previewImages.length > 0 && (
                  <div className="h-full overflow-y-auto p-4 space-y-4 bg-gray-100 flex-1">
                    {previewImages.map((image, index) => (
                      <div key={`preview-page-${index + 1}`} className="bg-white rounded-lg border border-gray-200 shadow-sm p-2">
                        <p className="text-xs text-gray-500 mb-2">{t('printer.previewPage', { page: index + 1 })}</p>
                        <img src={image} alt={t('printer.previewPage', { page: index + 1 })} className="w-full h-auto rounded" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <button
              type="submit"
              disabled={!file || submitting}
              className={`w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-base font-medium text-white transition-all
                ${!file || submitting
                  ? 'bg-blue-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 hover:shadow'}`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {t('printer.submitting')}
                </>
              ) : (
                <>
                  <PrinterIcon className="w-5 h-5 mr-2" />
                  {t('printer.submit')}
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function PrinterPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>}>
      <PrinterContent />
    </Suspense>
  );
}
