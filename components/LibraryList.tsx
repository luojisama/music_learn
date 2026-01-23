'use client';

import React from 'react';
import Image from 'next/image';
import { Play, Heart, Trash2 } from 'lucide-react';
import { usePlayerStore, Song } from '@/store/usePlayerStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import { musicApi } from '@/lib/api';
import { parseLrc } from '@/lib/lrcParser';
import { clsx } from 'clsx';
import { useTranslations } from 'next-intl';

interface LibraryListProps {
  type: 'favorites' | 'history';
}

export default function LibraryList({ type }: LibraryListProps) {
  const { favorites, history, removeFromFavorites, addToFavorites, addToHistory } = useLibraryStore();
  const { setSong, setLyrics } = usePlayerStore();
  const t = useTranslations('Library');
  
  const songs = type === 'favorites' ? favorites : history;
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

  const playSong = async (song: Song) => {
    const normalizedSong = normalizeSong(song);

    setSong(normalizedSong);
    addToHistory(normalizedSong);

    try {
      const urlRes = await musicApi.getSongUrl(song.id);
      const url = urlRes.data.data[0]?.url;
      if (!url) {
        alert("Cannot play this song");
        return;
      }
      setSong({ ...normalizedSong, url });

      const lrcRes = await musicApi.getLyric(song.id);
      const parsedLyrics = parseLrc(lrcRes.data.lrc?.lyric || '', lrcRes.data.tlyric?.lyric || '');
      setLyrics(parsedLyrics);
    } catch (error) {
      console.error("Error playing song", error);
    }
  };

  const isFavorite = (id: number) => favorites.some(s => s.id === id);

  return (
    <div className="flex-1 overflow-y-auto p-2">
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
              onClick={() => playSong(song)}
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
                <div className="font-medium text-sm truncate text-foreground">{song.name}</div>
                <div className="text-xs text-muted-foreground truncate">{song.ar?.map(a => a.name).join(', ')}</div>
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
  );
}
