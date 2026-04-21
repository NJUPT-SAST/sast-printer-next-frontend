import React, { createContext, useContext, useState, useEffect } from 'react';
import translationsData from './i18n.json';

type Locale = 'zh' | 'en';

export const translations = translationsData as Record<Locale, Record<string, string>>;

type LanguageContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: keyof typeof translations['zh'] | string, params?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextType>({
  locale: 'zh',
  setLocale: () => {},
  t: (key) => key,
});

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const savedLoc = localStorage.getItem('lang') as Locale;
    if (savedLoc && ['zh', 'en'].includes(savedLoc)) {
      return savedLoc;
    }
    return navigator.language.startsWith('zh') ? 'zh' : 'en';
  });

  useEffect(() => {
    document.documentElement.lang = locale;
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('lang', newLocale);
    document.documentElement.lang = newLocale; // Update html lang attribute
  };

  const t = (key: keyof typeof translations['zh'] | string, params?: Record<string, string | number>) => {
    let str = translations[locale][key] || translations['zh'][key] || key;
    if (params) {
      Object.keys(params).forEach(p => {
        str = str.replace(new RegExp(`{${p}}`, 'g'), String(params[p]));
      });
    }
    return str;
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => useContext(LanguageContext);
