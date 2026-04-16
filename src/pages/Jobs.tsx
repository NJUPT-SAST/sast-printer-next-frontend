import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { useUi } from '@/components/ui-context';
import { ChevronLeft, FileText, RefreshCw, AlertCircle, Loader2, PrinterIcon } from 'lucide-react';

interface PrintJob {
  id: string;
  printer_id: string;
  file_name: string;
  status: 'pending' | 'held' | 'processing' | 'stopped' | 'completed' | 'cancelled' | 'aborted' | 'pending_manual_continue';
  copies: number;
  duplex: boolean;
  submitted_at: string;
  duplex_hook?: string;
  hook_expires_at?: string;
}

export default function JobsPage() {
  const { t, locale } = useTranslation();
  const { toast } = useUi();
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [now, setNow] = useState(Date.now());
  const [manualDuplexHook, setManualDuplexHook] = useState<{ url: string, expiresAt: string } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submittingDuplex, setSubmittingDuplex] = useState(false);

  const jobsRef = useRef<PrintJob[]>([]);
  useEffect(() => { jobsRef.current = jobs; }, [jobs]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (manualDuplexHook?.expiresAt) {
      const updateTimer = () => {
        const remaining = Math.max(0, new Date(manualDuplexHook.expiresAt.replace(/-/g, '/') + ' GMT').getTime() - Date.now());
        setTimeLeft(remaining);
        if (remaining === 0) {
          setManualDuplexHook(null);
          fetchJobs(true);
        }
      };
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    } else {
      setTimeLeft(null);
    }
  }, [manualDuplexHook]);

  const handleContinueDuplex = async () => {
    if (!manualDuplexHook) return;
    setSubmittingDuplex(true);
    try {
      await api.post(manualDuplexHook.url);
      toast({ message: t('printer.success'), type: 'success' });
      setManualDuplexHook(null);
      fetchJobs(true);
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
      fetchJobs(true);
    }
  };

  const fetchJobs = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await api.get('/jobs');
      const newData = response.data.jobs || [];
      newData.sort((a: PrintJob, b: PrintJob) => {
        return String(a.id).localeCompare(String(b.id));
      });
      setJobs(newData);
    } catch (err: unknown) {
      let msg = t('error.loadJobs');
      if (err instanceof Error) msg = err.message;
      const anyErr = err as { response?: { data?: { error?: string } } };
      if (anyErr.response?.data?.error) msg = anyErr.response.data.error;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let requestCount = 0;
    // Auto refresh every 5 seconds
    const interval = setInterval(() => {
      requestCount++;
      const hasActive = jobsRef.current.some((j: { status: string; }) => ['pending', 'held', 'processing', 'pending_manual_continue'].includes(j.status));
      if (requestCount <= 2 || hasActive) {
        fetchJobs(true);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // const handleCancelJob = (id: string) => {
  //   confirm({
  //     title: t('jobs.cancelConfirmTitle'),
  //     message: t('jobs.cancelConfirmMsg'),
  //     danger: true,
  //     onConfirm: async () => {
  //       setCancellingId(id);
  //       try {
  //         await api.delete(`/jobs/${id}`);
  //         toast({ message: t('jobs.cancelSuccess'), type: 'success' });
  //         fetchJobs(true); // Refresh silently
  //       } catch (err: unknown) {
  //         let msg = t('error.cancel');
  //         if (err instanceof Error) msg = err.message;
  //         const anyErr = err as { response?: { data?: { error?: string } } };
  //         if (anyErr.response?.data?.error) msg = anyErr.response.data.error;
  //         toast({ message: `${t('error.cancel')}: ${msg}`, type: 'error' });
  //       } finally {
  //         setCancellingId(null);
  //       }
  //     }
  //   });
  // };

  const getStatusBadge = (status: string) => {
    let display = t(`status.${status}` as keyof typeof import('@/lib/i18n').translations['zh']);
    
    switch (status) {
      case 'completed':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">{display}</span>;
      case 'processing':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">{display}</span>;
      case 'pending':
      case 'held':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">{display}</span>;
      case 'pending_manual_continue':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">{display}</span>;
      case 'cancelled':
      case 'aborted':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">{display}</span>;
      case 'stopped':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">{display}</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">{display}</span>;
    }
  };

  if (loading && jobs.length === 0) {
    return (
      <div className="p-4 space-y-4 max-w-4xl mx-auto w-full">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-6 animate-pulse"></div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-white p-5 rounded-xl border border-gray-100 mb-4 h-24"></div>
        ))}
      </div>
    );
  }

  return (
    <>
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
                className="flex-1 py-3 px-4 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-50 transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {submittingDuplex ? <Loader2 className="w-5 h-5 animate-spin" /> : t('common.continue')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto p-4 sm:p-6 w-full">
        <Link to="/" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 mb-6 transition-colors">
          <ChevronLeft className="w-4 h-4 mr-1" />
          {t('nav.home')}
        </Link>

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{t('jobs.title')}</h1>
          <button 
            onClick={() => { if (!loading) fetchJobs() }} 
            disabled={loading}
            className={`flex items-center text-sm transition-colors p-2 rounded-lg 
              ${loading ? 'text-gray-400 cursor-not-allowed' : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'}`}
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 p-4 rounded-xl flex items-start space-x-3 text-red-700 border border-red-100 mb-6 shadow-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="font-medium text-sm">{error}</p>
          </div>
        )}

        {jobs.length === 0 && (!loading || jobs.length === 0) ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 shadow-sm mt-4">
            <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">{t('jobs.noJobs')}</h3>
            <p className="text-gray-500 mt-2 text-sm">{t('jobs.noJobsDesc')}</p>
            <Link to="/" className="mt-6 inline-flex items-center text-blue-600 hover:text-blue-800 font-medium text-sm">
              {t('nav.home')}
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => {
              const isActive = ['pending', 'held', 'processing', 'pending_manual_continue'].includes(job.status);
              const isPendingDuplex = job.status === 'pending_manual_continue';
              
              let jobTimeLeft = null;
              if (isPendingDuplex && job.hook_expires_at) {
                jobTimeLeft = Math.max(0, new Date(job.hook_expires_at.replace(/-/g, '/') + ' GMT').getTime() - now);
              }
              
              return (
                <div 
                  key={job.id} 
                  className={`bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-all ${isPendingDuplex ? 'border-purple-200 shadow-md ring-1 ring-purple-50' : 'hover:border-gray-300 hover:shadow-md'}`}>
                  <div className="flex items-start space-x-4 flex-1 min-w-0 pr-4">
                    <div className={`p-2.5 rounded-xl flex-shrink-0 mt-0.5 ${isPendingDuplex ? 'bg-purple-50 text-purple-600' : isActive ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-500'}`}>
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-gray-900 truncate" title={job.file_name}>
                        {job.file_name}
                      </h3>
                      <div className="flex flex-wrap items-center text-sm text-gray-500 mt-1 gap-x-2 gap-y-1">
                        <span className="truncate max-w-[120px] sm:max-w-none">{job.printer_id}</span>
                        {job.submitted_at && (
                          <>
                            <span className="text-gray-300 hidden sm:inline">&bull;</span>
                            <span className="truncate">{new Date(job.submitted_at.replace(/-/g, '/') + ' GMT').toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
                              year: 'numeric', month: '2-digit', day: '2-digit',
                              hour: '2-digit', minute: '2-digit',
                              timeZone: 'Asia/Shanghai'
                            })}</span>
                          </>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center text-xs text-gray-500 mt-2 gap-x-2 gap-y-1">
                        <span>{job.copies} {t('printer.copies')}</span>
                        <span className="text-gray-300">&bull;</span>
                        <span>{job.duplex ? t('printer.doubleSided') : t('printer.simplex')}</span>
                      </div>
                      {isPendingDuplex && jobTimeLeft !== null && (
                         <div className="mt-3 text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 inline-flex items-center rounded-md">
                           <span className="w-2 h-2 rounded-full bg-orange-500 mr-2 animate-pulse"></span>
                           {t('printer.timeLeft')} {Math.max(0, Math.floor(jobTimeLeft / 1000 / 60))}:{Math.max(0, Math.floor(jobTimeLeft / 1000 % 60)).toString().padStart(2, '0')}
                         </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 w-full sm:w-auto mt-2 sm:mt-0 border-t sm:border-0 border-gray-50 pt-3 sm:pt-0">
                    <div className="flex items-center">
                      {getStatusBadge(job.status)}
                    </div>
                    {isPendingDuplex && job.duplex_hook && job.hook_expires_at && (
                      <button
                        onClick={() => {
                          setManualDuplexHook({ url: job.duplex_hook!, expiresAt: job.hook_expires_at! });
                        }}
                        className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm active:scale-95"
                      >
                        {t('printer.continueOperation')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
