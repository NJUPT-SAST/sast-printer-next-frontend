import { useTranslation } from '@/lib/i18n';
import { Globe } from 'lucide-react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';

export default function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const [isSmall, setIsSmall] = useState(() => window.innerWidth < 1024);

  useEffect(() => {
    const handler = () => setIsSmall(window.innerWidth < 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const shifted = isSmall && (
    (pathname.startsWith('/printers') && searchParams.has('id')) ||
    pathname.startsWith('/scanner')
  );

  return (
    <button
      onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
      className={`fixed right-6 bg-white/90 backdrop-blur-sm border border-gray-200 shadow-lg text-gray-700 hover:text-blue-600 rounded-full p-3 transition-all duration-200 z-50 flex items-center justify-center hover:scale-105 ${shifted ? 'bottom-[94px]' : 'bottom-6'}`}
      title={locale === 'zh' ? 'Switch to English' : '切换到中文'}
    >
      <Globe className="w-5 h-5" />
      <span className="ml-2 text-sm font-medium">{locale === 'zh' ? 'EN' : '中'}</span>
    </button>
  );
}

