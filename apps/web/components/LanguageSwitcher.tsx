"use client"

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '../i18n/routing';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const toggleLanguage = () => {
    const nextLocale = locale === 'vi' ? 'en' : 'vi';
    router.replace(pathname, {locale: nextLocale});
  };

  return (
    <button
      onClick={toggleLanguage}
      className="inline-flex items-center justify-center gap-1.5 rounded-md p-2 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-ring font-bold text-sm text-slate-700 dark:text-slate-300"
      aria-label="Toggle language"
    >
      <Globe className="h-5 w-5" />
      <span>{locale === 'vi' ? 'VI' : 'EN'}</span>
    </button>
  )
}
