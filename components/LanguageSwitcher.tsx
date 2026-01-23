"use client"

import * as React from "react"
import { Globe } from "lucide-react"
import { useLocale } from "next-intl"
import { setUserLocale } from '@/lib/locale';

export function LanguageSwitcher() {
  const locale = useLocale();

  const toggleLocale = () => {
    const nextLocale = locale === 'en' ? 'zh' : locale === 'zh' ? 'ja' : 'en';
    setUserLocale(nextLocale);
  };

  const getLabel = (l: string) => {
    switch(l) {
      case 'en': return 'EN';
      case 'zh': return '中';
      case 'ja': return '日';
      default: return l;
    }
  }

  return (
    <button
      onClick={toggleLocale}
      className="p-2 rounded-full hover:bg-muted transition-colors flex items-center gap-1 text-sm font-medium text-foreground"
      aria-label="Switch language"
    >
      <Globe className="h-4 w-4" />
      <span>{getLabel(locale)}</span>
    </button>
  )
}
