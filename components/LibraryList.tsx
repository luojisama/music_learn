'use client';

import React from 'react';
import Image from 'next/image';
import { Play, Heart, Trash2 } from 'lucide-react';
import { usePlaySong } from '@/hooks/usePlaySong';
import { useLibraryStore } from '@/store/useLibraryStore';
import { Song } from '@/store/usePlayerStore';
import { clsx } from 'clsx';
import { useTranslations } from 'next-intl';

interface LibraryListProps {
  type: 'favorites' | 'history';
}

export default function LibraryList({ type }: LibraryListProps) {
  const { favorites, history, removeFromFavorites, addToFavorites, corrections } = useLibraryStore();
  const { playSong } = usePlaySong();
  const t = useTranslations('Library');
  const [sortByCorrection, setSortByCorrection] = React.useState(true);
  
  const isCorrected = (songId: number) => !!corrections[songId];

  const rawSongs = type === 'favorites' ? favorites : history;
  
  // Sort songs: corrected first if enabled
  const songs = [...rawSongs].sort((a, b) => {
    if (sortByCorrection) {
      if (isCorrected(a.id) && !isCorrected(b.id)) return -1;
      if (!isCorrected(a.id) && isCorrected(b.id)) return 1;
    }
    return 0;
  });
  const getCoverUrl = (song: Song) => {
    const rawUrl = song.al?.picUrl ?? song.album?.picUrl ?? song.picUrl;
    return rawUrl ? rawUrl.replace(/^http:\/\//, 'https://') : undefined;
  };
  type RawSong = Partial<Song> & { id: number; name: string; artists?: { id: number; name: string }[]; duration?: number };
  const normalizeSong = (song: RawSong): Song => {
    const album = song.al ?? (song.album ? { id: song.album.id ?? song.id, name: song.album.name ?? song.name, picUrl: song.album.picUrl } : undefined);
    const safeAlbum = album ?? (song.picUrl ? { id: song.id, name: song.name, picUrl: song.picUrl } : undefined);
    return {
      id: song.id,
      name: song.name,
      ar: song.ar ?? song.artists ?? [],
      al: safeAlbum,
      album: song.album ?? song.al,
      picUrl: song.picUrl ?? song.al?.picUrl ?? song.album?.picUrl,
      dt: song.dt ?? song.duration ?? 0,
      url: song.url
    };
  };

  const isFavorite = (id: number) => favorites.some(s => s.id === id);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {songs.length > 0 && (
        <div className="px-4 py-2 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
            {songs.length} 首歌曲
          </span>
          <button
            onClick={() => setSortByCorrection(!sortByCorrection)}
            className={clsx(
              "text-[10px] px-2 py-1 rounded-md transition-all border",
              sortByCorrection 
                ? "bg-primary/10 text-primary border-primary/20 font-bold" 
                : "bg-muted/50 text-muted-foreground border-transparent"
            )}
          >
            修正优先: {sortByCorrection ? '开启' : '关闭'}
          </button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
        {songs.length === 0 && (
        <div className="text-center text-muted-foreground text-sm mt-8">
          {type === 'favorites' ? t('empty_favorites') : t('empty_history')}
        </div>
      )}
      <div className="flex flex-col gap-1">
        {songs.map((song) => {
          const coverUrl = getCoverUrl(song);

          return (
            <div
              key={`${type}-${song.id}`}
              onClick={() => playSong(normalizeSong(song))}
              className="group flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
            >
              <div className="relative w-10 h-10 flex-shrink-0">
                 {coverUrl ? (
                    <Image
                      src={coverUrl}
                      alt={song.name}
                      width={40}
                      height={40}
                      className="w-full h-full object-cover rounded"
                      referrerPolicy="no-referrer"
                    />
                 ) : (
                    <div className="w-full h-full bg-muted/50 rounded flex items-center justify-center text-muted-foreground">?</div>
                 )}
                 <div className="absolute inset-0 bg-black/20 hidden group-hover:flex items-center justify-center rounded">
                   <Play size={16} className="text-white" fill="white" />
                 </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <div className="text-sm font-medium truncate group-hover:text-primary transition-colors text-foreground">{song.name}</div>
                  {isCorrected(song.id) && (
                    <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-md border border-primary/20 whitespace-nowrap">
                      已修正
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">{song.ar?.map(a => a.name).join(', ')}</div>
                {isCorrected(song.id) && corrections[song.id].lyrics?.[0] && (
                  <div className="text-[10px] text-primary/60 italic truncate mt-0.5">
                    修正预览: {corrections[song.id].lyrics.find(l => l.romaji)?.romaji || corrections[song.id].lyrics[0].romaji}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                {type === 'favorites' && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromFavorites(song.id);
                    }}
                    className="p-2 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                {type === 'history' && (
                   <button 
                   onClick={(e) => {
                     e.stopPropagation();
                     if (isFavorite(song.id)) removeFromFavorites(song.id);
                     else addToFavorites(normalizeSong(song));
                   }}
                   className={clsx(
                     "p-2 rounded-full hover:bg-muted transition-colors",
                     isFavorite(song.id) ? "text-red-500" : "text-muted-foreground opacity-0 group-hover:opacity-100"
                   )}
                 >
                   <Heart size={16} fill={isFavorite(song.id) ? "currentColor" : "none"} />
                 </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </div>
  );
}
