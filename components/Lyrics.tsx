'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { clsx } from 'clsx';
import { useTranslations } from 'next-intl';
import axios from 'axios';
import { Loader2, Wand2, Save, Check, Sparkles, Music2, Bot, CheckCircle2, AlertCircle, CornerDownRight, Type } from 'lucide-react';
import { useLibraryStore } from '@/store/useLibraryStore';

export default function Lyrics() {
  const {
    lyrics,
    currentLyricIndex,
    updateLyricRomaji,
    updateLyricFurigana,
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
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewResults, setReviewResults] = useState<Record<number, { approved: boolean; suggestion?: string; comment?: string }>>({});
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [isAutoFurigana, setIsAutoFurigana] = useState(false);
  const [showFurigana, setShowFurigana] = useState(true);

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

  // 全部自动假名
  const handleAutoFurigana = async () => {
    if (lyrics.length === 0 || isAutoFurigana) return;
    if (detectLang(lyrics) !== 'ja') return; // 只对日语生效
    const currentSongId = usePlayerStore.getState().currentSong?.id;
    if (!currentSongId) return;

    setIsAutoFurigana(true);
    try {
      for (let i = 0; i < lyrics.length; i++) {
        if (usePlayerStore.getState().currentSong?.id !== currentSongId) break;
        const line = usePlayerStore.getState().lyrics[i];
        if (line.furigana || !line.text.trim()) continue;

        try {
          const res = await axios.post('/api/romaji', { text: line.text, lang: 'ja', furigana: true });
          if (res.data.result && usePlayerStore.getState().currentSong?.id === currentSongId) {
            updateLyricFurigana(i, res.data.result);
          }
        } catch (e) {
          console.error('Failed to generate furigana for line', i, e);
        }
      }
    } finally {
      setIsAutoFurigana(false);
    }
  };

  // AI 审核用户编辑的罗马音
  const handleAIReview = async () => {
    if (isReviewing || lyrics.length === 0) return;

    const lyricsWithRomaji = lyrics
      .map((line, index) => ({ index, text: line.text, romaji: line.romaji || '' }))
      .filter(item => item.romaji.trim() !== '');

    if (lyricsWithRomaji.length === 0) {
      setReviewError('没有可审核的罗马音，请先生成或填写注音');
      setTimeout(() => setReviewError(null), 4000);
      return;
    }

    setIsReviewing(true);
    setReviewResults({});
    setReviewError(null);

    try {
      const lang = detectLang(lyrics);
      const res = await axios.post('/api/ai-review', { items: lyricsWithRomaji, lang });

      if (res.data.error) {
        setReviewError(res.data.error + (res.data.details ? `：${res.data.details}` : ''));
        setTimeout(() => setReviewError(null), 8000);
        return;
      }

      const results: Record<number, { approved: boolean; suggestion?: string; comment?: string }> = {};
      for (const item of res.data.results || []) {
        results[item.index] = { approved: item.approved, suggestion: item.suggestion, comment: item.comment };
      }
      setReviewResults(results);
    } catch (e: unknown) {
      let msg = '未知错误';
      if (axios.isAxiosError(e)) {
        msg = e.response?.data?.details || e.response?.data?.error || e.message;
      } else if (e instanceof Error) {
        msg = e.message;
      }
      setReviewError(`审核失败: ${msg}`);
      setTimeout(() => setReviewError(null), 8000);
    } finally {
      setIsReviewing(false);
    }
  };

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
            onClick={handleAIReview}
            disabled={isReviewing}
            className="bg-card/90 backdrop-blur-xl px-4 py-2 rounded-full shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 text-xs font-bold flex items-center gap-2 transition-all text-violet-500 border border-border/20"
          >
            {isReviewing ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
            {isReviewing ? '审核中...' : 'AI 审核'}
          </button>
          <button
            onClick={handleAutoFurigana}
            disabled={isAutoFurigana}
            className="bg-card/90 backdrop-blur-xl px-4 py-2 rounded-full shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 text-xs font-bold flex items-center gap-2 transition-all text-sky-500 border border-border/20"
          >
            {isAutoFurigana ? <Loader2 size={14} className="animate-spin" /> : <Type size={14} />}
            {isAutoFurigana ? '生成中...' : '假名'}
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
        {/* 假名显示开关（有假名数据时出现）*/}
        {lyrics.some(l => l.furigana) && (
          <button
            onClick={() => setShowFurigana(v => !v)}
            className={clsx(
              'self-end flex items-center gap-1.5 text-[10px] px-3 py-1 rounded-full border transition-all',
              showFurigana
                ? 'bg-sky-500/15 text-sky-500 border-sky-500/30'
                : 'bg-card/60 text-muted-foreground/60 border-border/20'
            )}
          >
            <Type size={10} />
            <span>{showFurigana ? '假名已显示' : '假名已隐藏'}</span>
          </button>
        )}
        {Object.keys(reviewResults).length > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] px-3 py-1 rounded-full bg-card/80 border border-border/30 backdrop-blur-md">
            <CheckCircle2 size={10} className="text-green-500" />
            <span className="text-green-500 font-medium">
              {Object.values(reviewResults).filter(r => r.approved).length} 行正确
            </span>
            {Object.values(reviewResults).some(r => !r.approved) && (
              <>
                <span className="text-border/60 mx-0.5">·</span>
                <AlertCircle size={10} className="text-amber-500" />
                <span className="text-amber-500 font-medium">
                  {Object.values(reviewResults).filter(r => !r.approved).length} 处建议修改
                </span>
              </>
            )}
          </div>
        )}
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
        {reviewError && (
          <div className="bg-amber-500/10 text-amber-500 text-[10px] px-3 py-1.5 rounded-lg border border-amber-500/20 animate-in fade-in slide-in-from-top-2">
            {reviewError}
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
                    onUpdate={(newRomaji) => {
                      updateLyricRomaji(index, newRomaji);
                      // 编辑后清除该行的审核结果，需要重新审核
                      setReviewResults(prev => {
                        const next = { ...prev };
                        delete next[index];
                        return next;
                      });
                    }}
                  />
                  {/* 审核结果图标 */}
                  {reviewResults[index] !== undefined && (
                    <div className={clsx(
                      'flex-shrink-0 p-0.5 rounded-full',
                      reviewResults[index].approved ? 'text-green-500' : 'text-amber-500'
                    )}>
                      {reviewResults[index].approved
                        ? <CheckCircle2 size={13} />
                        : <AlertCircle size={13} />
                      }
                    </div>
                  )}
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

                {/* AI 审核建议 */}
                {reviewResults[index] && !reviewResults[index].approved && (
                  <div className="flex items-start justify-center gap-1.5 text-[11px] text-amber-500/90 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    <CornerDownRight size={11} className="flex-shrink-0 mt-0.5" />
                    <span className="font-medium">
                      {reviewResults[index].suggestion && <>建议：<span className="font-mono">{reviewResults[index].suggestion}</span></>}
                      {reviewResults[index].comment && <span className="text-muted-foreground/70 ml-1">（{reviewResults[index].comment}）</span>}
                    </span>
                    {reviewResults[index].suggestion && (
                      <button
                        className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-600 transition-colors font-medium"
                        onClick={(e) => {
                          e.stopPropagation();
                          const suggestion = reviewResults[index].suggestion!;
                          updateLyricRomaji(index, suggestion);
                          setReviewResults(prev => ({ ...prev, [index]: { approved: true } }));
                        }}
                      >
                        采用
                      </button>
                    )}
                  </div>
                )}

                {/* Main Text — with optional furigana */}
                <div className={clsx(
                  'text-xl md:text-2xl font-bold tracking-wide leading-loose',
                  isActive ? 'text-primary' : 'text-foreground/80'
                )}>
                  {showFurigana && line.furigana
                    ? <FuriganaText html={line.furigana} />
                    : line.text}
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

/**
 * Safely renders kuroshiro furigana HTML as React elements.
 * Handles both formats:
 *   <ruby>漢<rt>かん</rt></ruby>
 *   <ruby>漢<rp>(</rp><rt>かん</rt><rp>)</rp></ruby>
 */
function FuriganaText({ html }: { html: string }) {
  const parts: React.ReactNode[] = [];
  // Match optional <rp>...</rp> before/after <rt>
  const regex = /<ruby>([^<]*)(?:<rp>[^<]*<\/rp>)?<rt>([^<]*)<\/rt>(?:<rp>[^<]*<\/rp>)?<\/ruby>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(html)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{html.slice(lastIndex, match.index)}</span>);
    }
    parts.push(
      <ruby key={key++}>
        {match[1]}
        <rp>(</rp>
        <rt className="text-[0.5em] font-normal tracking-wide">{match[2]}</rt>
        <rp>)</rp>
      </ruby>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < html.length) {
    parts.push(<span key={key++}>{html.slice(lastIndex)}</span>);
  }

  return <>{parts}</>;
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
