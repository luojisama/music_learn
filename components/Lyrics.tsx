'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { clsx } from 'clsx';
import { useTranslations } from 'next-intl';
import axios from 'axios';
import { Loader2, Wand2, Save, Check, Sparkles, Music2 } from 'lucide-react';
import { useLibraryStore } from '@/store/useLibraryStore';

export default function Lyrics() {
  const {
    lyrics,
    currentLyricIndex,
    updateLyricRomaji,
    requestSeek,
    isLyricLooping,
    currentSong,
    isLoadingLyrics,
  } = usePlayerStore();
  const { saveCorrection, corrections } = useLibraryStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const t = useTranslations('Lyrics');
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [generatingLine, setGeneratingLine] = useState<number | null>(null);

  const isCorrected = currentSong ? !!corrections[currentSong.id] : false;

  const handleSaveCorrection = async () => {
    if (currentSong && lyrics.length > 0) {
      setIsSaving(true);
      setSaveError(null);

      const result = await saveCorrection(currentSong.id, lyrics);

      setIsSaving(false);
      if (result.synced) {
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
      } else {
        const errorMsg = result.details ? `${result.error}: ${result.details}` : (result.error || '同步失败');
        setSaveError(`已保存到本地，但同步失败: ${errorMsg}`);
        setTimeout(() => setSaveError(null), 8000);
      }
    }
  };

  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentLyricIndex]);

  const detectLang = useCallback((lines: typeof lyrics) => {
    const isJapanese = (text: string) => /[\u3040-\u30ff]/.test(text);
    return lines.some(l => isJapanese(l.text)) ? 'ja' : 'zh';
  }, []);

  // 全部自动注音
  const handleAutoRomaji = async () => {
    if (lyrics.length === 0 || isAutoGenerating) return;
    const currentSongId = usePlayerStore.getState().currentSong?.id;
    if (!currentSongId) return;

    setIsAutoGenerating(true);
    const lang = detectLang(lyrics);

    try {
      for (let i = 0; i < lyrics.length; i++) {
        if (usePlayerStore.getState().currentSong?.id !== currentSongId) break;
        if (lyrics[i].romaji) continue;

        try {
          const res = await axios.post('/api/romaji', { text: lyrics[i].text, lang });
          if (res.data.result && usePlayerStore.getState().currentSong?.id === currentSongId) {
            updateLyricRomaji(i, res.data.result);
          }
        } catch (e) {
          console.error('Failed to convert line', i, e);
        }
      }
    } finally {
      setIsAutoGenerating(false);
    }
  };

  // 单行注音生成
  const handleSingleRomaji = async (index: number) => {
    if (generatingLine !== null) return;
    const currentSongId = usePlayerStore.getState().currentSong?.id;
    if (!currentSongId) return;

    setGeneratingLine(index);
    const lang = detectLang(lyrics);
    try {
      const res = await axios.post('/api/romaji', { text: lyrics[index].text, lang });
      if (res.data.result && usePlayerStore.getState().currentSong?.id === currentSongId) {
        updateLyricRomaji(index, res.data.result);
      }
    } catch (e) {
      console.error('Single romaji failed:', e);
    } finally {
      setGeneratingLine(null);
    }
  };

  // 歌词加载中
  if (isLoadingLyrics) {
    return (
      <div className="h-full mx-4 md:mr-4 md:ml-0 my-4 md:h-[calc(100vh-2rem)] rounded-3xl bg-card/50 backdrop-blur-2xl border border-border/50 shadow-xl overflow-hidden">
        <div className="h-full overflow-y-auto p-8 pb-48">
          <div className="flex flex-col gap-12 items-center max-w-3xl mx-auto">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex flex-col gap-3 items-center w-full animate-pulse">
                <div className="h-3 bg-muted/60 rounded-full w-1/3" />
                <div className="h-6 bg-muted/80 rounded-full w-2/3" />
                <div className="h-4 bg-muted/40 rounded-full w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 无歌词
  if (lyrics.length === 0) {
    return (
      <div className="h-full mx-4 md:mr-4 md:ml-0 my-4 md:h-[calc(100vh-2rem)] rounded-3xl bg-card/50 backdrop-blur-2xl border border-border/50 shadow-xl overflow-hidden flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground px-6 text-center">
          <Music2 size={40} className="opacity-30" />
          {currentSong ? (
            <>
              <p className="font-medium text-sm">{t('no_lyrics')}</p>
              <p className="text-xs opacity-60">《{currentSong.name}》 暂无歌词数据</p>
              <a
                href={`https://music.163.com/song?id=${currentSong.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary/70 hover:text-primary underline underline-offset-2 transition-colors"
              >
                在网易云音乐查看 →
              </a>
            </>
          ) : (
            <p className="font-light text-sm">{t('no_lyrics')}</p>
          )}
        </div>
      </div>
    );
  }

  // 检查是否有来自网易云的 romalrc（即已有 romaji 但非手动编辑）
  const hasNeteaseRomaji = lyrics.some(l => l.romaji);

  return (
    <div className="h-full relative mx-4 md:mr-4 md:ml-0 my-4 md:h-[calc(100vh-2rem)] rounded-3xl bg-card/50 backdrop-blur-2xl border border-border/50 shadow-xl overflow-hidden">
      <div className="absolute top-6 right-6 z-10 flex flex-col items-end gap-2">
        <div className="flex gap-2">
          <button
            onClick={handleSaveCorrection}
            disabled={isSaving}
            className={clsx(
              'backdrop-blur-xl px-4 py-2 rounded-full shadow-lg hover:shadow-xl hover:scale-105 text-xs font-bold flex items-center gap-2 transition-all border',
              isSaved || isCorrected
                ? 'bg-green-500/20 text-green-500 border-green-500/30'
                : 'bg-primary/90 text-primary-foreground border-primary/20',
              isSaving && 'opacity-70 cursor-wait'
            )}
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : isSaved ? <Check size={14} /> : <Save size={14} />}
            {isSaving ? '正在同步...' : isSaved ? '已保存' : isCorrected ? '已修正' : '保存修正'}
          </button>
          <button
            onClick={handleAutoRomaji}
            disabled={isAutoGenerating}
            className="bg-card/90 backdrop-blur-xl px-4 py-2 rounded-full shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 text-xs font-bold flex items-center gap-2 transition-all text-primary border border-border/20"
          >
            {isAutoGenerating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
            {t('auto_romaji')}
          </button>
        </div>
        {hasNeteaseRomaji && !isCorrected && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 px-2">
            <Sparkles size={10} />
            <span>含网易云注音</span>
          </div>
        )}
        {saveError && (
          <div className="bg-red-500/10 text-red-500 text-[10px] px-3 py-1.5 rounded-lg border border-red-500/20 animate-in fade-in slide-in-from-top-2">
            错误: {saveError}
          </div>
        )}
      </div>

      <div className="h-full overflow-y-auto p-8 pb-48 scrollbar-hide" ref={containerRef}>
        <div className="flex flex-col gap-12 items-center text-center max-w-3xl mx-auto">
          {lyrics.map((line, index) => {
            const isActive = index === currentLyricIndex;
            const isGeneratingThis = generatingLine === index;

            return (
              <div
                key={index}
                ref={isActive ? activeLineRef : null}
                className={clsx(
                  'transition-all duration-500 flex flex-col gap-3 cursor-pointer rounded-2xl p-6 w-full group relative',
                  isActive
                    ? 'bg-card/80 scale-105 opacity-100 shadow-xl backdrop-blur-md border border-border/40 ring-1 ring-primary/20'
                    : 'opacity-40 hover:opacity-80 hover:bg-card/20 hover:scale-105'
                )}
                onClick={() => {
                  requestSeek(line.time);
                }}
              >
                {/* Romaji */}
                <div className="min-h-[1.5rem] flex justify-center items-center gap-2">
                  <RomajiText
                    text={line.romaji}
                    isActive={isActive}
                    onUpdate={(newRomaji) => updateLyricRomaji(index, newRomaji)}
                  />
                  {/* 单行注音按钮：仅在活跃行或 hover 时显示，且该行没有 romaji */}
                  {!line.romaji && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSingleRomaji(index); }}
                      disabled={generatingLine !== null}
                      className={clsx(
                        'flex-shrink-0 p-1 rounded-full text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-all',
                        'opacity-0 group-hover:opacity-100',
                        isActive && 'opacity-60',
                        isGeneratingThis && 'opacity-100'
                      )}
                      title="生成此行注音"
                    >
                      {isGeneratingThis
                        ? <Loader2 size={12} className="animate-spin" />
                        : <Wand2 size={12} />
                      }
                    </button>
                  )}
                </div>

                {/* Main Text */}
                <div className={clsx(
                  'text-xl md:text-2xl font-bold tracking-wide',
                  isActive ? 'text-primary' : 'text-foreground/80'
                )}>
                  {line.text}
                </div>

                {/* Translation */}
                {line.translation && (
                  <div className={clsx(
                    'text-sm md:text-base font-medium opacity-60',
                    isActive ? 'text-primary/80' : 'text-foreground/60'
                  )}>
                    {line.translation}
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

function RomajiText({ text, isActive, onUpdate }: { text?: string; isActive: boolean; onUpdate: (val: string) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(text || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(text || '');
  }, [text]);

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        autoFocus
        className="bg-muted/50 border-b border-primary text-center text-sm w-full outline-none py-1 rounded-t-md"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          setIsEditing(false);
          onUpdate(value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            setIsEditing(false);
            onUpdate(value);
          }
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <div
      className={clsx(
        'text-xs md:text-sm font-medium tracking-wider cursor-text hover:text-primary transition-colors',
        isActive ? 'text-primary/70' : 'text-foreground/40'
      )}
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
    >
      {text || (isActive ? '点击添加罗马音...' : '')}
    </div>
  );
}
