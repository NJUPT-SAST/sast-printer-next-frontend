import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from '@/lib/i18n';

import { useEffect, useState } from 'react';

export default function Header() {
  const { t } = useTranslation();
  const pathname = useLocation().pathname;
  if (pathname === '/') return null;
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasClickedScanner, setHasClickedScanner] = useState(() => {
    return localStorage.getItem('has_clicked_scanner') === 'true';
  });

  const handleScannerClick = () => {
    if (!hasClickedScanner) {
      setHasClickedScanner(true);
      localStorage.setItem('has_clicked_scanner', 'true');
    }
  };

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      setIsLoggedIn(!!token);
    };
    
    checkAuth();
    
    // 监听 storage 改变以便登出/跨标签页同步
    window.addEventListener('storage', checkAuth);
    
    // 创建一个自定义事件，供 AuthGuard 登录完成后触发（在同页面的 localStorage.setItem 不会触发 'storage' event）
    window.addEventListener('auth-changed', checkAuth);

    return () => {
      window.removeEventListener('storage', checkAuth);
      window.removeEventListener('auth-changed', checkAuth);
    };
  }, []);

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-40 shadow-sm relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 w-full h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-2.5 group">
          <div className="w-9 h-9 bg-white border border-gray-100 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-transform duration-200 group-hover:scale-105">
            <img src="/logo.svg" alt="Logo" className="w-7 h-7 drop-shadow-sm filter" />
          </div>
          <span className="font-extrabold text-xl text-gray-900 tracking-tight">{t('app.title')}</span>
        </Link>
        <nav className="flex space-x-1">
          <a
            href="https://njupt-sast.feishu.cn/wiki/XE8GwfP50igFVqkhKjzc3EpGntf"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round" className="mr-1.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            {/* @ts-ignore */}
            {t('home.userManual') || "使用说明文档"}
          </a>
        </nav>
      </div>
    </header>
  );
}