import { useTranslation } from '@/lib/i18n';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();

  return (
    <button
      onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
      className="fixed bottom-6 right-6 bg-white/90 backdrop-blur-sm border border-gray-200 shadow-lg text-gray-700 hover:text-blue-600 rounded-full p-3 transition-all duration-200 z-50 flex items-center justify-center hover:scale-105"
      title={locale === 'zh' ? 'Switch to English' : '切换到中文'}
    >
      <Globe className="w-5 h-5" />
      <span className="ml-2 text-sm font-medium">{locale === 'zh' ? 'EN' : '中'}</span>
    </button>
  );
}