import { useEffect, useState, useRef, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { useUi } from '@/components/ui-context';
import { ChevronLeft, PrinterIcon, UploadCloud, FileText, Loader2, RefreshCw, Download, ClipboardList } from 'lucide-react';
import { Link } from 'react-router-dom';
import PrinterList from '@/components/PrinterList';
import { DocumentPreview, renderPdfToImages } from '@/components/DocumentPreview';
import JobsModal from '@/components/JobsModal';
import ImageFileList from '@/components/ImageFileList';
import { apiErrMsg, parseGMTDate, downloadFile, imagesToPdf, createNupPdf } from '@/lib/utils';
import { MAX_IMAGES } from '@/lib/constants';

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
  const [pageDimensions, setPageDimensions] = useState<{ pageWidth: number; pageHeight: number }[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewPageCount, setPreviewPageCount] = useState<number | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [copies, setCopies] = useState(1);
  const [duplex, setDuplex] = useState('');
  const [collate, setCollate] = useState('true');
  const [pageSet, setPageSet] = useState('all');
  const [pages, setPages] = useState('');
  const [pagesError, setPagesError] = useState('');
  const [nup, setNup] = useState<1 | 2 | 4 | 6>(1);
  const [nupDirection, setNupDirection] = useState<'horizontal' | 'vertical'>('horizontal');

  const [sourceTab, setSourceTab] = useState<'file' | 'feishu'>('file');
  const [feishuUrl, setFeishuUrl] = useState('');
  const [feishuUrlError, setFeishuUrlError] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [merging, setMerging] = useState(false);
  const [isJobsModalOpen, setIsJobsModalOpen] = useState(false);
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

  const FEISHU_URL_RE = /^https:\/\/[^/]+\.feishu\.cn\/(docx|doc|sheets|bitable|mindnotes|wiki)\/[A-Za-z0-9_-]{27}([?#].*)?$/;
  const isValidFeishuUrl = (url: string) => FEISHU_URL_RE.test(url.trim());

  const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']);
  const isImageFile = (f: File) => IMAGE_EXTS.has(getFileExtension(f.name));

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

  const getSelectedPages = (): number[] | null => {
    if (!pages.trim() && pageSet === 'all') return null;

    let pageList: number[];
    if (!pages.trim() && previewPageCount) {
      pageList = Array.from({ length: previewPageCount }, (_, i) => i + 1);
    } else {
      const selected = new Set<number>();
      const parts = pages.trim().split(',').map((p) => p.trim());
      for (const part of parts) {
        if (part.includes('-')) {
          const [start, end] = part.split('-').map(Number);
          for (let i = start; i <= end; i++) selected.add(i);
        } else if (part) {
          selected.add(Number(part));
        }
      }
      pageList = Array.from(selected).sort((a, b) => a - b);
    }

    if (pageSet !== 'all') {
      pageList = pageList.filter((p) => (pageSet === 'odd' ? p % 2 !== 0 : p % 2 === 0));
    }

    return pageList.length > 0 ? pageList : null;
  };

  const selectedPageCount = getSelectedPageCount(pages, previewPageCount);
  const isDuplexDisabled = (previewPageCount !== null && previewPageCount <= 1) || (selectedPageCount === 1);
  const isNupDisabled = (previewPageCount !== null && previewPageCount <= 1) || (selectedPageCount !== null && selectedPageCount <= 1);

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

  useEffect(() => {
    setIsJobsModalOpen(false);
  }, [id]);

  useEffect(() => {
    if (manualDuplexHook?.expiresAt) {
      const updateTimer = () => {
        const remaining = Math.max(0, parseGMTDate(manualDuplexHook.expiresAt).getTime() - Date.now());
        setTimeLeft(remaining);
        if (remaining === 0) {
          setManualDuplexHook(null);
          setIsJobsModalOpen(true);
        }
      };
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    } else {
      setTimeLeft(null);
    }
  }, [manualDuplexHook]);

  const hasDocument = sourceTab === 'file' ? !!file : isValidFeishuUrl(feishuUrl);

  useEffect(() => {
    if (!hasDocument) {
      setPreviewLoading(false);
      setPreviewError(null);
      setPreviewPageCount(null);
      setPreviewPdfUrl((oldUrl) => {
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        return null;
      });
      setPreviewImages([]);
      setPageDimensions([]);
      return;
    }

    const controller = new AbortController();

    const fetchPreview = async () => {
      setPreviewLoading(true);
      setPreviewError(null);

      try {
        let response;

        if (sourceTab === 'file' && file) {
          const formData = new FormData();
          formData.append('file', file);
          if (id) {
            formData.append('printer_id', id);
          }

          response = await api.post('/jobs/preview', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
            responseType: 'blob',
            signal: controller.signal,
          });
        } else {
          response = await api.post('/jobs/preview/feishu', { url: feishuUrl.trim() }, {
            responseType: 'blob',
            signal: controller.signal,
          });
        }

        const blob = response.data as Blob;
        const objectUrl = URL.createObjectURL(blob);
        setPreviewPdfUrl((oldUrl) => {
          if (oldUrl) URL.revokeObjectURL(oldUrl);
          return objectUrl;
        });
        const { totalPages, images, pageDimensions: dims } = await renderPdfToImages(blob);
        setPreviewPageCount(totalPages);
        setPreviewImages(images);
        setPageDimensions(dims);
      } catch (err: unknown) {
        // Ignore cancellation errors from rapid file changes.
        if (typeof err === 'object' && err !== null && 'name' in err && err.name === 'CanceledError') {
          return;
        }

        setPreviewImages([]);
        setPageDimensions([]);
        setPreviewPageCount(null);
        setPreviewPdfUrl((oldUrl) => {
          if (oldUrl) URL.revokeObjectURL(oldUrl);
          return null;
        });

        let msg = t('printer.previewLoadFailed');
        if (err instanceof Error) msg = err.message;
        const anyErr = err as { response?: { status?: number; data?: { error?: string } } };
        if (anyErr.response?.status === 403) {
          msg = t('printer.feishuForbidden');
        } else if (anyErr.response?.data?.error) {
          msg = anyErr.response.data.error;
        }
        setPreviewError(msg);
      } finally {
        setPreviewLoading(false);
      }
    };

    fetchPreview();

    return () => {
      controller.abort();
    };
  }, [hasDocument, sourceTab, file, feishuUrl, id, previewVersion, t]);

  useEffect(() => {
    return () => {
      if (previewPdfUrl) {
        URL.revokeObjectURL(previewPdfUrl);
      }
    };
  }, [previewPdfUrl]);

  useEffect(() => {
    if (imageFiles.length === 0) return;
    let cancelled = false;
    const merge = async () => {
      setMerging(true);
      try {
        const blob = await imagesToPdf(imageFiles);
        if (!cancelled) {
          setFile(new File([blob], 'images.pdf', { type: 'application/pdf' }));
        }
      } catch (err: unknown) {
        if (!cancelled) {
          toast({ message: apiErrMsg(err, t('error.submit')), type: 'error' });
        }
      } finally {
        if (!cancelled) setMerging(false);
      }
    };
    merge();
    return () => { cancelled = true; };
  }, [imageFiles, toast, t]);

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
    if (duplex !== '' && !isDuplexDisabled) {
      localStorage.setItem('duplex_preference', duplex);
    }
  }, [duplex, isDuplexDisabled]);

  useEffect(() => {
    if (isNupDisabled && nup !== 1) {
      setNup(1);
    }
  }, [isNupDisabled, nup]);

  useEffect(() => {
    const fetchSupportedFileTypes = async () => {
      try {
        const response = await api.get<SupportedFileTypesResponse>('/jobs/supported-file-types');
        const types = (response.data.supported_file_types || [])
          .map((item) => String(item || '').trim().toLowerCase())
          .filter(Boolean);

        const uniqueTypes = Array.from(new Set(types));
        setSupportedFileTypes(uniqueTypes.length > 0 ? uniqueTypes : ['pdf']);
      } catch {
        setSupportedFileTypes(['pdf']);
      }
    };

    const fetchPrinter = async () => {
      try {
        const response = await api.get(`/printers/${id}`);
        setPrinter(response.data);
        const saved = localStorage.getItem('duplex_preference');
        setDuplex(saved ?? '');
      } catch (err: unknown) {
        setError(apiErrMsg(err, t('error.fetchPrinters')));
      } finally {
        setLoading(false);
      }
    };

    const init = async () => {
      setLoading(true);
      setPrinter(null);
      setError(null);
      if (id) {
        await fetchPrinter();
      } else {
        setLoading(false);
      }
      await fetchSupportedFileTypes();
    };

    init();
  }, [id, t]);

  const handleAddImages = (incoming: File[]) => {
    setImageFiles((prev) => {
      const available = MAX_IMAGES - prev.length;
      if (available <= 0) {
        toast({ message: t('printer.imageLimitReached'), type: 'error' });
        return prev;
      }
      const toAdd = incoming.slice(0, available);
      if (incoming.length > available) {
        toast({ message: t('printer.imageLimitReached'), type: 'error' });
      }
      return [...prev, ...toAdd];
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (isImageFile(files[0])) {
      const valid = files.filter(isImageFile);
      handleAddImages(valid);
    } else {
      if (!isSupportedFile(files[0])) { rejectUnsupportedFile(); return; }
      setImageFiles([]);
      setFile(files[0]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReplaceImage = (index: number, newFile: File) => {
    if (!isImageFile(newFile)) {
      if (imageFiles.length === 1 && isSupportedFile(newFile)) {
        setImageFiles([]);
        setFile(newFile);
        return;
      }
      toast({ message: t('printer.imageOnly'), type: 'error' });
      return;
    }
    setImageFiles((prev) => prev.map((f, i) => (i === index ? newFile : f)));
  };

  const handleDeleteImage = (index: number) => {
    setImageFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) setFile(null);
      return next;
    });
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

  const handleFeishuUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFeishuUrl(value);
    if (value.trim() && !isValidFeishuUrl(value)) {
      setFeishuUrlError(t('printer.feishuUrlInvalid'));
    } else {
      setFeishuUrlError('');
    }
  };

  const handleTabSwitch = (tab: 'file' | 'feishu') => {
    setSourceTab(tab);
    if (tab === 'feishu') {
      setFile(null);
      setImageFiles([]);
    } else {
      setFeishuUrl('');
      setFeishuUrlError('');
    }
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
    if (!e.dataTransfer.files?.length) return;
    const first = e.dataTransfer.files[0];
    if (isImageFile(first)) {
      const images = Array.from(e.dataTransfer.files).filter(isImageFile);
      handleAddImages(images);
    } else {
      if (isSupportedFile(first)) {
        setImageFiles([]);
        setFile(first);
      } else {
        rejectUnsupportedFile();
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasDocument) {
      toast({ message: t('printer.tapToSelect'), type: 'error' });
      return;
    }

    if (sourceTab === 'feishu' && !feishuUrl.trim()) {
      toast({ message: t('printer.feishuUrlInvalid'), type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const { valid, error: validationError } = validatePageRange(pages, previewPageCount, true);
      if (!valid) {
        setPagesError(validationError);
        toast({ message: validationError || t('printer.pageRangeInvalid'), type: 'error' });
        setSubmitting(false);
        return;
      }

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

      if (sourceTab === 'file' && file) {
        let fileToSubmit = file;
        const selectedForNup = nup > 1 ? getSelectedPages() : null;
        if (nup > 1) {
          try {
            fileToSubmit = new File(
              [await createNupPdf(file, nup, nupDirection, selectedForNup ?? undefined, pageDimensions[0])],
              file.name.replace(/\.[^.]+$/, '') + '_nup.pdf',
              { type: 'application/pdf' },
            );
          } catch {
            toast({ message: t('printer.nupTransforming') + ' ' + t('error.submit'), type: 'error' });
            setSubmitting(false);
            return;
          }
        }

        const formData = new FormData();
        formData.append('printer_id', id || '');
        formData.append('file', fileToSubmit);

        const queryParams = new URLSearchParams();
        queryParams.append('copies', copies.toString());
        if (duplex !== 'off') {
          queryParams.append('duplex', duplex);
        }
        queryParams.append('collate', collate);
        if (finalPages && nup === 1) {
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
          setIsJobsModalOpen(true);
        }
      } else {
        const body: Record<string, unknown> = {
          url: feishuUrl.trim(),
          printer_id: id || '',
          copies,
          collate: collate === 'true',
        };
        if (duplex !== 'off') {
          body.duplex = duplex === 'true';
        }
        if (finalPages) {
          body.pages = finalPages;
        }

        const response = await api.post('/jobs/feishu', body);

        if (response.data.hook_url) {
          setManualDuplexHook({
            url: response.data.hook_url,
            expiresAt: response.data.hook_expires_at,
          });
          toast({ message: t('printer.manualDuplexWait'), type: 'success' });
        } else {
          toast({ message: t('printer.success'), type: 'success' });
          setIsJobsModalOpen(true);
        }
      }

    } catch (err: unknown) {
      const errStatus = (err as { response?: { status?: number } }).response?.status;
      const fallback = errStatus === 403 ? t('printer.feishuForbidden') : t('error.submit');
      toast({ message: `${t('error.submit')}: ${apiErrMsg(err, fallback)}`, type: 'error' });
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
      setIsJobsModalOpen(true);
    } catch (err: unknown) {
      toast({ message: `${t('error.submit')}: ${apiErrMsg(err, t('error.submit'))}`, type: 'error' });
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
    } catch {
      // Ignored
    } finally {
      setManualDuplexHook(null);
      setSubmittingDuplex(false);
      setIsJobsModalOpen(true);
    }
  };

  const handleDownloadPreview = () => {
    if (!previewPdfUrl) return;
    const filename = file
      ? `${file.name.replace(/\.[^.]+$/, '')}.pdf`
      : 'feishu-document.pdf';
    downloadFile(previewPdfUrl, filename);
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
    return (
      <>
        {isJobsModalOpen && <JobsModal onClose={() => setIsJobsModalOpen(false)} />}
        <PrinterList onJobsClick={() => setIsJobsModalOpen(true)} />
      </>
    );
  }

  const submitBtnDisabled = !hasDocument || submitting || duplex === '' || merging;

  const submitBtnClass = `w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-base font-medium text-white transition-all ${submitBtnDisabled
      ? 'bg-blue-300 cursor-not-allowed'
      : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 hover:shadow'
    }`;

  const submitBtnContent = submitting ? (
    <><Loader2 className="w-5 h-5 mr-2 animate-spin" />{t('printer.submitting')}</>
  ) : (
    <><PrinterIcon className="w-5 h-5 mr-2" />{t('printer.submit')}</>
  );

  return (
    <div className="min-h-[calc(100vh-5rem)] flex flex-col">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 w-full pt-4 sm:pt-6 pb-24 lg:pb-4 flex flex-col">
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
        {isJobsModalOpen && <JobsModal onClose={() => setIsJobsModalOpen(false)} />}
        <div className="flex justify-between items-center mb-4 shrink-0">
          <Link to="/printers" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
            <ChevronLeft className="w-4 h-4 mr-1" />
            {t('printer.back')}
          </Link>
          <button
            onClick={() => setIsJobsModalOpen(true)}
            className="inline-flex items-center text-sm font-medium text-gray-700 bg-white border border-gray-200 shadow-sm hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 px-4 py-2 rounded-lg transition-all"
          >
            <ClipboardList className="w-4 h-4 mr-2" />
            {t('nav.history')}
          </button>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm mb-4 shrink-0">
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

        <form id="print-form" onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-6 items-start">
          <div className="w-full lg:w-1/2 flex flex-col">
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 shrink-0">{t('printer.document')}</h2>

              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex border-b border-gray-200 mb-4 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleTabSwitch('file')}
                    className={`flex-1 py-2.5 text-sm font-medium text-center border-b-2 transition-colors ${sourceTab === 'file'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                  >
                    {t('printer.tabUploadFile')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabSwitch('feishu')}
                    className={`flex-1 py-2.5 text-sm font-medium text-center border-b-2 transition-colors ${sourceTab === 'feishu'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                  >
                    {t('printer.tabFeishu')}
                  </button>
                </div>

                {sourceTab === 'file' ? (
                  <>
                    <label className="block text-sm font-medium text-gray-700 mb-2 shrink-0">
                      {t('printer.selectFile')} <span className="text-red-500">*</span>
                    </label>

                    {imageFiles.length > 0 ? (
                      <ImageFileList
                        files={imageFiles}
                        onReorder={setImageFiles}
                        onReplace={handleReplaceImage}
                        onDelete={handleDeleteImage}
                        onAdd={handleAddImages}
                        limitReached={imageFiles.length >= MAX_IMAGES}
                        allowDocReplace={imageFiles.length === 1}
                      />
                    ) : (
                      <div
                        className={`group border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
                        ${isDragging ? 'border-blue-500 bg-blue-50' : file ? 'border-green-300 bg-green-50 hover:border-blue-400 hover:bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50 bg-gray-50'}`}
                        onClick={() => fileInputRef.current?.click()}
                        onDragEnter={handleDragEnter}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                      >
                        <input
                          type="file"
                          accept={acceptValue}
                          multiple
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
                    )}
                  </>
                ) : (
                  <>
                    <label className="block text-sm font-medium text-gray-700 mb-2 shrink-0">
                      {t('printer.feishuUrlLabel')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="url"
                      value={feishuUrl}
                      onChange={handleFeishuUrlChange}
                      placeholder={t('printer.feishuUrlPlaceholder')}
                      className={`w-full px-4 py-2 border rounded-xl focus:ring-2 focus:outline-none transition-shadow ${feishuUrlError
                          ? 'border-red-300 focus:ring-red-500 focus:border-red-500 bg-red-50'
                          : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                        }`}
                    />
                    {feishuUrlError && (
                      <p className="mt-1 text-xs text-red-600">{feishuUrlError}</p>
                    )}
                    {previewLoading && sourceTab === 'feishu' && (
                      <p className="mt-2 text-xs text-gray-500 flex items-center">
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        {t('printer.feishuPreviewLoading')}
                      </p>
                    )}
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mt-6 shrink-0">
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
              </div>

              <div className="mt-6">
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

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('printer.nup')}</label>
                <div className="flex gap-3">
                  {([1, 2, 4, 6] as const).map((val) => {
                    const cols = val === 6 ? 3 : val === 1 ? 1 : 2;
                    const rows = val === 2 ? 1 : 2;
                    const selected = nup === val;
                    return (
                      <label
                        key={val}
                        className={`flex-1 flex flex-col items-center py-3 px-2 border rounded-xl cursor-pointer transition-all ${isNupDisabled ? 'opacity-50 cursor-not-allowed' : ''
                          } ${selected ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'}`}
                      >
                        <input
                          type="radio"
                          name="nup"
                          value={val}
                          checked={selected}
                          onChange={() => !isNupDisabled && setNup(val)}
                          disabled={isNupDisabled}
                          className="sr-only"
                        />
                        <svg width="40" height="52" viewBox="0 0 40 52" className="mb-1.5">
                          <rect x="1" y="1" width="38" height="50" rx="2.5" fill="white" stroke={selected ? '#3b82f6' : '#d1d5db'} strokeWidth="1.2" />
                          {val === 1 ? (
                            <rect x="4" y="4" width="32" height="44" rx="1" fill={selected ? '#dbeafe' : '#f3f4f6'} />
                          ) : (
                            <>
                              {cols > 1 && Array.from({ length: cols - 1 }).map((_, i) => (
                                <line key={`v-${i}`} x1={1 + (i + 1) * 38 / cols} y1="1" x2={1 + (i + 1) * 38 / cols} y2="51" stroke={selected ? '#93c5fd' : '#e5e7eb'} strokeWidth="0.6" />
                              ))}
                              {rows > 1 && Array.from({ length: rows - 1 }).map((_, i) => (
                                <line key={`h-${i}`} x1="1" y1={1 + (i + 1) * 50 / rows} x2="39" y2={1 + (i + 1) * 50 / rows} stroke={selected ? '#93c5fd' : '#e5e7eb'} strokeWidth="0.6" />
                              ))}
                              <rect x="1.5" y="1.5" width={38 / cols - 2} height={50 / rows - 2} rx="1" fill={selected ? '#dbeafe' : '#f3f4f6'} />
                            </>
                          )}
                        </svg>
                        <span className={`text-xs font-medium ${selected ? 'text-blue-700' : 'text-gray-500'}`}>
                          {val === 1 ? t('printer.nupOff') : t('printer.nupValue', { n: val })}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {nup > 1 && (
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('printer.nupDirection')}</label>
                  <div className="flex gap-4">
                    <label className={`flex-1 flex items-center py-2 px-3 border rounded-xl cursor-pointer transition-colors ${nupDirection === 'horizontal' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input
                        type="radio"
                        name="nupDirection"
                        value="horizontal"
                        checked={nupDirection === 'horizontal'}
                        onChange={() => setNupDirection('horizontal')}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="ml-3 text-sm font-medium text-gray-900">{t('printer.nupHorizontal')}</span>
                    </label>
                    <label className={`flex-1 flex items-center py-2 px-3 border rounded-xl cursor-pointer transition-colors ${nupDirection === 'vertical' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input
                        type="radio"
                        name="nupDirection"
                        value="vertical"
                        checked={nupDirection === 'vertical'}
                        onChange={() => setNupDirection('vertical')}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span className="ml-3 text-sm font-medium text-gray-900">{t('printer.nupVertical')}</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="mt-6">
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

          {/* Right Column */}
          <div className="w-full lg:w-1/2 flex flex-col gap-6">
            {hasDocument && (
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col" style={{ height: 'calc(100vh - 29rem)' }}>
                <div className="flex items-center justify-between mb-4 shrink-0">
                  <h2 className="text-lg font-semibold text-gray-900">{merging ? t('printer.merging') : t('printer.preview')}</h2>
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

                <DocumentPreview
                  images={(() => {
                    const sel = getSelectedPages();
                    if (!sel) return previewImages;
                    return sel.map((p) => previewImages[p - 1]).filter(Boolean);
                  })()}
                  loading={previewLoading || merging}
                  error={previewError}
                  nup={nup === 1 ? undefined : nup}
                  nupDirection={nupDirection}
                  pageDimensions={pageDimensions}
                />
              </div>
            )}

            <div className="hidden lg:block bg-white p-6 rounded-2xl border border-gray-200 shadow-sm shrink-0">
              <button
                type="submit"
                disabled={submitBtnDisabled}
                className={submitBtnClass}
              >
                {submitBtnContent}
              </button>
            </div>
          </div>
        </form>

        {/* Mobile floating submit button */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 p-4 bg-white border-t border-gray-200 shadow-lg">
          <button
            form="print-form"
            type="submit"
            disabled={submitBtnDisabled}
            className={submitBtnClass}
          >
            {submitBtnContent}
          </button>
        </div>
      </div>
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
