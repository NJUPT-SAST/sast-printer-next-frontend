import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { useUi } from '@/components/ui-context';
import { apiErrMsg, parseGMTDate } from '@/lib/utils';
import { FileText, RefreshCw, AlertCircle, Loader2, PrinterIcon, X } from 'lucide-react';

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

interface JobsModalProps {
  onClose: () => void;
}

export default function JobsModal({ onClose }: JobsModalProps) {
  const { t, locale } = useTranslation();
  const { toast } = useUi();
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [now, setNow] = useState(Date.now());
  const [manualDuplexHook, setManualDuplexHook] = useState<{ url: string, expiresAt: string } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submittingDuplex, setSubmittingDuplex] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (manualDuplexHook?.expiresAt) {
      const updateTimer = () => {
        const remaining = Math.max(0, parseGMTDate(manualDuplexHook.expiresAt).getTime() - Date.now());
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
  }, [manualDuplexHook]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchJobs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      const response = await api.get('/jobs');
      const newData: PrintJob[] = response.data.jobs || [];
      newData.sort((a, b) => parseGMTDate(b.submitted_at).getTime() - parseGMTDate(a.submitted_at).getTime());
      setJobs(newData);
      setError(null);
    } catch (err: unknown) {
      setError(apiErrMsg(err, t('error.loadJobs')));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchJobs();
    const id = setInterval(() => fetchJobs(true), 8000);
    return () => clearInterval(id);
  }, [fetchJobs]);

  const handleContinueDuplex = async () => {
    if (!manualDuplexHook) return;
    setSubmittingDuplex(true);
    try {
      await api.post(manualDuplexHook.url);
      toast({ message: t('printer.success'), type: 'success' });
      setManualDuplexHook(null);
      fetchJobs(true);
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
      fetchJobs(true);
    }
  };

  const statusColors: Record<string, string> = {
    completed: 'bg-green-100 text-green-800',
    processing: 'bg-blue-100 text-blue-800',
    pending: 'bg-yellow-100 text-yellow-800',
    held: 'bg-yellow-100 text-yellow-800',
    pending_manual_continue: 'bg-purple-100 text-purple-800',
    stopped: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800',
    aborted: 'bg-gray-100 text-gray-800',
  };
  const getStatusBadge = (status: string) => {
    const color = statusColors[status] ?? 'bg-gray-100 text-gray-600';
    return <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${color}`}>{t(`status.${status}`)}</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl border border-gray-100 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Manual duplex dialog inside modal */}
        {manualDuplexHook && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 rounded-xl p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl border border-gray-100 flex flex-col items-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <PrinterIcon className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{t('printer.manualDuplexTitle')}</h3>
              <p className="text-gray-600 text-center mb-4">{t('printer.manualDuplexDesc')}</p>
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
                  className="flex-1 py-3 px-4 rounded-xl border border-gray-300 font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleContinueDuplex}
                  disabled={submittingDuplex}
                  className="flex-1 py-3 px-4 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {submittingDuplex ? <Loader2 className="w-5 h-5 animate-spin" /> : t('common.continue')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">{t('jobs.title')}</h2>
            <button
              onClick={() => { if (!refreshing) fetchJobs(); }}
              disabled={refreshing}
              className={`p-1.5 rounded-lg transition-colors ${refreshing ? 'text-gray-400 cursor-not-allowed' : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'}`}
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="bg-red-50 p-4 rounded-xl flex items-start space-x-3 text-red-700 border border-red-100 mb-4">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="font-medium text-sm">{error}</p>
            </div>
          )}

          {loading && jobs.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse bg-gray-100 rounded-xl h-20" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-14 h-14 mx-auto text-gray-300 mb-3" />
              <h3 className="text-base font-medium text-gray-900">{t('jobs.noJobs')}</h3>
              <p className="text-gray-500 mt-1 text-sm">{t('jobs.noJobsDesc')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => {
                const isActive = ['pending', 'held', 'processing', 'pending_manual_continue'].includes(job.status);
                const isPendingDuplex = job.status === 'pending_manual_continue';

                let jobTimeLeft = null;
                if (isPendingDuplex && job.hook_expires_at) {
                  jobTimeLeft = Math.max(0, parseGMTDate(job.hook_expires_at).getTime() - now);
                }

                return (
                  <div
                    key={job.id}
                    className={`bg-white p-4 rounded-xl border shadow-sm flex flex-col sm:flex-row sm:items-start justify-between gap-3 transition-all ${isPendingDuplex ? 'border-purple-200 ring-1 ring-purple-50' : 'border-gray-200 hover:border-gray-300 hover:shadow-md'}`}
                  >
                    <div className="flex items-start space-x-3 flex-1 min-w-0">
                      <div className={`p-2 rounded-xl flex-shrink-0 mt-0.5 ${isPendingDuplex ? 'bg-purple-50 text-purple-600' : isActive ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-500'}`}>
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate" title={job.file_name}>
                          {job.file_name}
                        </h3>
                        <div className="flex flex-wrap items-center text-xs text-gray-500 mt-1 gap-x-2 gap-y-0.5">
                          <span className="truncate max-w-[120px]">{job.printer_id}</span>
                          {job.submitted_at && (
                            <>
                              <span className="text-gray-300 hidden sm:inline">&bull;</span>
                              <span>{parseGMTDate(job.submitted_at).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
                                year: 'numeric', month: '2-digit', day: '2-digit',
                                hour: '2-digit', minute: '2-digit',
                                timeZone: 'Asia/Shanghai'
                              })}</span>
                            </>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center text-xs text-gray-500 mt-1 gap-x-2">
                          <span>{job.copies} {t('printer.copies')}</span>
                          <span className="text-gray-300">&bull;</span>
                          <span>{job.duplex ? t('printer.doubleSided') : t('printer.simplex')}</span>
                        </div>
                        {isPendingDuplex && jobTimeLeft !== null && (
                          <div className="mt-2 text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 inline-flex items-center rounded-md">
                            <span className="w-2 h-2 rounded-full bg-orange-500 mr-2 animate-pulse" />
                            {t('printer.timeLeft')} {Math.max(0, Math.floor(jobTimeLeft / 1000 / 60))}:{Math.max(0, Math.floor(jobTimeLeft / 1000 % 60)).toString().padStart(2, '0')}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 w-full sm:w-auto border-t sm:border-0 border-gray-50 pt-2 sm:pt-0">
                      {getStatusBadge(job.status)}
                      {isPendingDuplex && job.duplex_hook && job.hook_expires_at && (
                        <button
                          onClick={() => setManualDuplexHook({ url: job.duplex_hook!, expiresAt: job.hook_expires_at! })}
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
      </div>
    </div>
  );
}
