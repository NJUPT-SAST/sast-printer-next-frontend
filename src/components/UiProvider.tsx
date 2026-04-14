import { useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, X, Loader2 } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { UiContext } from './ui-context';
import type { ToastType, ToastOptions, ConfirmOptions } from './ui-context';

export function UiProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [toastData, setToastData] = useState<{ message: string; type: ToastType; id: number } | null>(null);
  const [confirmData, setConfirmData] = useState<ConfirmOptions | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const toast = useCallback((options: ToastOptions | string) => {
    const opts = typeof options === 'string' ? { message: options } : options;
    const id = Date.now();
    setToastData({
      message: opts.message,
      type: opts.type || 'info',
      id,
    });
    setTimeout(() => {
      setToastData((current) => (current?.id === id ? null : current));
    }, opts.duration || 3000);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    setConfirmData(options);
  }, []);

  const closeConfirm = () => {
    if (isConfirming) return;
    if (confirmData?.onCancel) confirmData.onCancel();
    setConfirmData(null);
  };

  const executeConfirm = async () => {
    if (confirmData && !isConfirming) {
      setIsConfirming(true);
      try {
        await confirmData.onConfirm();
      } finally {
        setIsConfirming(false);
        setConfirmData(null);
      }
    }
  };

  return (
    <UiContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toast Notification */}
      {toastData && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`px-4 py-3 rounded-xl shadow-lg flex items-center space-x-3 
            ${toastData.type === 'error' ? 'bg-red-600 text-white' : 
              toastData.type === 'success' ? 'bg-green-600 text-white' : 
              'bg-gray-800 text-white'}`}
          >
            {toastData.type === 'error' && <AlertCircle className="w-5 h-5 flex-shrink-0" />}
            {toastData.type === 'success' && <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
            {toastData.type === 'info' && <Info className="w-5 h-5 flex-shrink-0" />}
            <span className="text-sm font-medium">{toastData.message}</span>
            <button 
              onClick={() => setToastData(null)}
              className="ml-4 text-white/80 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {confirmData.title || t('common.confirmTitle')}
              </h3>
              <p className="text-gray-600 text-sm">
                {confirmData.message}
              </p>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 sm:gap-3">
              <button
                onClick={closeConfirm}
                disabled={isConfirming}
                className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {confirmData.cancelText || t('common.cancel')}
              </button>
              <button
                onClick={executeConfirm}
                disabled={isConfirming}
                className={`w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-white rounded-xl shadow-sm transition-colors flex items-center justify-center
                  ${confirmData.danger 
                    ? 'bg-red-600 hover:bg-red-700 active:bg-red-800 focus:ring-red-500' 
                    : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 focus:ring-blue-500'}
                  disabled:opacity-70 disabled:cursor-not-allowed`}
              >
                {isConfirming && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {confirmData.confirmText || t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </UiContext.Provider>
  );
}