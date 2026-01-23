'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { clsx } from 'clsx';
import { useTranslations } from 'next-intl';
import axios from 'axios';
import { Loader2, Wand2 } from 'lucide-react';

export default function Lyrics() {
  const { lyrics, currentLyricIndex, updateLyricRomaji, requestSeek, isLyricLooping } = usePlayerStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const t = useTranslations('Lyrics');
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);

  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentLyricIndex]);

  const handleAutoRomaji = async () => {
    if (lyrics.length === 0 || isAutoGenerating) return;
    setIsAutoGenerating(true);

    // Heuristic detection: if translation exists, it might be Japanese or Chinese song.
    // If no explicit language, default to 'ja'. 
    // We can also try to guess from song title or artist, but let's default to 'ja' unless 'zh' is detected.
    // Actually, simple heuristic: check if text contains Kana.
    const isJapanese = (text: string) => /[\u3040-\u30ff]/.test(text);
    const lang = lyrics.some(l => isJapanese(l.text)) ? 'ja' : 'zh';

    try {
      // Process in chunks to avoid timeout or too large payload
      for (let i = 0; i < lyrics.length; i++) {
        if (lyrics[i].romaji) continue; // Skip if already has
        
        try {
           const res = await axios.post('/api/romaji', { text: lyrics[i].text, lang });
           if (res.data.result) {
             updateLyricRomaji(i, res.data.result);
           }
        } catch (e) {
           console.error("Failed to convert line", i, e);
        }
      }
    } finally {
      setIsAutoGenerating(false);
    }
  };

  if (lyrics.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground font-light">
        {t('no_lyrics')}
      </div>
    );
  }

  return (
    <div className="h-full relative mx-4 md:mr-4 md:ml-0 my-4 md:h-[calc(100vh-2rem)] rounded-3xl bg-card/50 backdrop-blur-2xl border border-border/50 shadow-xl overflow-hidden">
      <div className="absolute top-6 right-6 z-10">
        <button
          onClick={handleAutoRomaji}
          disabled={isAutoGenerating}
          className="bg-card/90 backdrop-blur-xl px-4 py-2 rounded-full shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 text-xs font-bold flex items-center gap-2 transition-all text-primary border border-border/20"
        >
          {isAutoGenerating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          {t('auto_romaji')}
        </button>
      </div>

      <div className="h-full overflow-y-auto p-8 pb-48 scrollbar-hide" ref={containerRef}>
        <div className="flex flex-col gap-12 items-center text-center max-w-3xl mx-auto">
          {lyrics.map((line, index) => {
            const isActive = index === currentLyricIndex;
            
            return (
              <div
                key={index}
                ref={isActive ? activeLineRef : null}
                className={clsx(
                  "transition-all duration-500 flex flex-col gap-3 cursor-pointer rounded-2xl p-6 w-full",
                  isActive 
                    ? "bg-card/80 scale-105 opacity-100 shadow-xl backdrop-blur-md border border-border/40 ring-1 ring-primary/20" 
                    : "opacity-40 hover:opacity-80 hover:bg-card/20 hover:scale-105"
                )}
                onClick={() => {
                  // Seek to this line
                  requestSeek(line.time);
                }}
              >
                {/* Romaji (Editable) */}
                <input
                  type="text"
                  value={line.romaji || ''}
                  placeholder="Romaji..."
                  onClick={(e) => e.stopPropagation()} // Prevent seek when editing
                  onChange={(e) => updateLyricRomaji(index, e.target.value)}
                  className={clsx(
                    "text-center bg-transparent border-none focus:ring-0 w-full font-medium tracking-wide outline-none transition-colors",
                    isActive ? "text-primary text-sm" : "text-muted-foreground text-xs"
                  )}
                />

                {/* Original Text */}
                <p className={clsx(
                  "font-bold tracking-tight transition-all",
                  isActive 
                    ? "text-3xl md:text-4xl bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent drop-shadow-sm" 
                    : "text-xl text-muted-foreground"
                )}>
                  {line.text}
                </p>
                
                {/* Translation */}
                {line.translation && (
                   <p className={clsx(
                     "font-medium mt-2",
                     isActive ? "text-lg text-primary/80" : "text-sm text-muted-foreground"
                   )}>
                     {line.translation}
                   </p>
                 )}
                
                {isActive && isLyricLooping && (
                   <div className="text-xs text-primary font-mono mt-2 bg-primary/10 px-2 py-1 rounded-full inline-block">
                      {t('loop_line')}
                   </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
