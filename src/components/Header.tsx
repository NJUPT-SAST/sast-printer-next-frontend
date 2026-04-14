import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from '@/lib/i18n';

import { ListTodo } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Header() {
  const { t } = useTranslation();
  const pathname = useLocation().pathname;
  const [isLoggedIn, setIsLoggedIn] = useState(false);

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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 w-full h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-2.5 group">
          <div className="w-9 h-9 bg-white border border-gray-100 rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-transform duration-200 group-hover:scale-105">
            <img src="/logo.svg" alt="Logo" className="w-7 h-7 drop-shadow-sm filter" />
          </div>
          <span className="font-extrabold text-xl text-gray-900 tracking-tight">{t('app.title')}</span>
        </Link>
        <nav className="flex space-x-1">
          {isLoggedIn && pathname !== '/jobs' && (
            <Link 
              to="/jobs" 
              className="flex items-center text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors"
            >
              <ListTodo className="w-4 h-4 mr-1.5" />
              {t('nav.history')}
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}