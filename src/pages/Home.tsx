import { Link } from 'react-router-dom';
import { useTranslation } from '@/lib/i18n';
import { Printer, ScanLine, BookOpen } from 'lucide-react';

export default function Home() {
  const { t } = useTranslation();

  return (
    <div className="relative max-w-6xl mx-auto p-4 sm:p-6 w-full flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-4rem)]">
      {/* Top right floating User Manual */}
      <div className="absolute top-6 right-6">
        <a 
          href="https://njupt-sast.feishu.cn/wiki/XE8GwfP50igFVqkhKjzc3EpGntf" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors bg-white/80 backdrop-blur rounded-full px-4 py-2 shadow-sm border border-gray-200"
        >
          <BookOpen className="w-4 h-4 mr-2" />
          {/* @ts-ignore */}
          {t('home.userManual') || "使用说明文档"}
        </a>
      </div>

      <div className="text-center mb-12 flex flex-col items-center">
        <div className="w-24 h-24 bg-white border border-gray-100 rounded-3xl flex items-center justify-center shadow-lg mb-8 group hover:shadow-xl transition-all duration-300 hover:scale-105">
          <img src="/logo.svg" alt="Logo" className="w-16 h-16 drop-shadow-sm filter" />
        </div>
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-4">{t('app.title') || "云打印与扫描系统"}</h1>
        {/* @ts-ignore */}
        <p className="text-lg text-gray-500 max-w-xl mx-auto">{t('home.subtitle') || "请选择您需要的服务，快速完成打印或扫描任务"}</p>
      </div>

      <div className="grid gap-8 sm:grid-cols-2 w-full max-w-4xl">
        <Link 
          to="/printers"
          className="group relative flex flex-col items-center justify-center p-12 bg-white rounded-3xl border-2 border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all duration-300 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative z-10 w-24 h-24 bg-blue-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-blue-600 transition-all duration-300">
            <Printer className="w-12 h-12 text-blue-600 group-hover:text-white transition-colors" />
          </div>
          {/* @ts-ignore */}
          <h2 className="relative z-10 text-2xl font-bold text-gray-900 mb-2">{t('home.printService') || "打印服务"}</h2>
          {/* @ts-ignore */}
          <p className="relative z-10 text-gray-500 text-center">{t('home.printServiceDesc') || "提交文件到云端，选择附近打印机即刻输出"}</p>
        </Link>

        <Link 
          to="/scanner"
          className="group relative flex flex-col items-center justify-center p-12 bg-white rounded-3xl border-2 border-gray-100 shadow-sm hover:shadow-xl hover:border-green-300 transition-all duration-300 overflow-hidden"
        >
          {/* Beta Badge */}
          <div className="absolute top-4 right-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-[11px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm z-20 animate-pulse">
            Beta
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-green-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative z-10 w-24 h-24 bg-green-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-green-600 transition-all duration-300">
            <ScanLine className="w-12 h-12 text-green-600 group-hover:text-white transition-colors" />
          </div>
          {/* @ts-ignore */}
          <h2 className="relative z-10 text-2xl font-bold text-gray-900 mb-2">{t('home.scanService') || "扫描服务"}</h2>
          {/* @ts-ignore */}
          <p className="relative z-10 text-gray-500 text-center">{t('home.scanServiceDesc') || "使用高拍仪或扫描仪，一键将纸质文档电子化"}</p>
        </Link>
      </div>
    </div>
  );
}
