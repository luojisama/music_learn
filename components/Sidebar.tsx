'use client';

import React, { useState } from 'react';
import Search from './Search';
import LibraryList from './LibraryList';
import { Search as SearchIcon, Heart, Clock, Menu } from 'lucide-react';
import { clsx } from 'clsx';
import { ThemeToggle } from './ThemeToggle';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useTranslations } from 'next-intl';

export default function Sidebar() {
  const [activeTab, setActiveTab] = useState<'search' | 'favorites' | 'history'>('search');
  const [isOpen, setIsOpen] = useState(false); // Mobile drawer state
  const t = useTranslations();

  const tabs = [
    { id: 'search', icon: SearchIcon, label: t('Search.placeholder').replace('...', '') }, // Fallback label
    { id: 'favorites', icon: Heart, label: t('Library.favorites') },
    { id: 'history', icon: Clock, label: t('Library.history') },
  ] as const;

  return (
    <>
      {/* Mobile Toggle */}
      <button 
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-card/80 backdrop-blur-md rounded-xl shadow-sm border border-border/50"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Menu size={20} className="text-foreground" />
      </button>

      {/* Sidebar Container - Fuwari Style: Floating Card */}
      <div className={clsx(
        "fixed inset-y-4 left-4 w-80 bg-card/90 backdrop-blur-2xl rounded-3xl shadow-lg border border-border/50 transform transition-transform duration-300 z-40 flex flex-col pt-16 md:pt-0",
        isOpen ? "translate-x-0" : "-translate-x-[120%] md:translate-x-0",
        "md:relative md:w-96 md:inset-auto md:h-[calc(100vh-2rem)] md:my-4 md:ml-4"
      )}>
        {/* Header with Tools */}
        <div className="flex items-center justify-between p-6 pb-4">
           <h1 className="font-bold text-2xl tracking-tight text-foreground">
             shiroの唱歌学日语
           </h1>
           <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-full">
             <LanguageSwitcher />
             <ThemeToggle />
           </div>
        </div>

        {/* Tabs - Pill Style */}
        <div className="px-4 pb-4">
          <div className="flex bg-muted/80 p-1 rounded-2xl">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  "flex-1 py-2 flex items-center justify-center gap-2 text-sm font-medium transition-all rounded-xl",
                  activeTab === tab.id 
                    ? "bg-card text-primary shadow-sm" 
                    : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                )}
              >
                <tab.icon size={16} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative mx-2 mb-2 rounded-2xl bg-muted/30">
          {activeTab === 'search' && <Search />}
          {activeTab === 'favorites' && <LibraryList type="favorites" />}
          {activeTab === 'history' && <LibraryList type="history" />}
        </div>
      </div>
      
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
