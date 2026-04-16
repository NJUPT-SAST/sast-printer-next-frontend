import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { Printer as PrinterIcon, AlertCircle, BookOpen } from 'lucide-react';

interface Printer {
  id: string;
  name: string;
  description: string;
  status: 'idle' | 'processing' | 'stopped';
  model: string;
  location: string;
  duplex_mode: 'auto' | 'manual' | 'off';
  note?: string;
}

export default function Home() {
  const { t } = useTranslation();
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrinters = async () => {
      try {
        const response = await api.get('/printers');
        setPrinters(response.data.printers || []);
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

    fetchPrinters();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'idle':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'stopped':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4 max-w-4xl mx-auto w-full">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-6 animate-pulse"></div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex space-x-3 mb-4">
                <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                <div className="flex-1">
                  <div className="h-5 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                </div>
              </div>
              <div className="space-y-2 mt-4">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 max-w-4xl mx-auto mt-4 w-full">
        <div className="bg-red-50 p-4 rounded-xl flex items-start space-x-3 text-red-700 border border-red-100 shadow-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-lg">{t('error.loadPrinters')}</h3>
            <p className="mt-1 text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 w-full">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">{t('home.title')}</h1>
        <a 
          href="https://njupt-sast.feishu.cn/wiki/XE8GwfP50igFVqkhKjzc3EpGntf" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
        >
          <BookOpen className="w-4 h-4 mr-1.5" />
          {/* @ts-ignore - Ignore missing key until types are updated */}
          {t('home.userManual')}
        </a>
      </div>

      {printers.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 shadow-sm mt-8">
          <PrinterIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">{t('home.noPrinters')}</h3>
          <p className="text-gray-500 mt-2">{t('home.noPrintersDesc')}</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {printers.map((printer) => (
            <Link 
              key={printer.id} 
              to={`/printers?id=${printer.id}`}
              className="block group"
            >
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-200 relative overflow-hidden h-full">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
                      <PrinterIcon className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 leading-tight">{printer.name}</h2>
                      <p className="text-sm text-gray-500">{printer.model}</p>
                    </div>
                  </div>
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide whitespace-nowrap ${getStatusColor(printer.status)}`}>
                    {t(`status.${printer.status}` as keyof typeof import('@/lib/i18n').translations['zh'])}
                  </span>
                </div>
                
                <div className="mt-5 space-y-2.5 text-sm text-gray-600 px-1 border-t border-gray-50 pt-4">
                  <div className="flex items-center">
                    <span className="w-20 text-gray-400 font-medium">{t('common.location')}</span>
                    <span className="flex-1 truncate text-gray-800" title={printer.location}>{printer.location}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-20 text-gray-400 font-medium">{t('common.duplex')}</span>
                    <span className="flex-1 capitalize text-gray-800">
                      {printer.duplex_mode === 'auto' ? t('printer.auto') : printer.duplex_mode === 'manual' ? t('printer.manual') : t('printer.simplex')}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
