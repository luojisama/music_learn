'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Search as SearchIcon, Play, Heart, Loader2 } from 'lucide-react';
import { musicApi } from '@/lib/api';
import { usePlayerStore, Song } from '@/store/usePlayerStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import { parseLrc } from '@/lib/lrcParser';
import { clsx } from 'clsx';
import { useTranslations } from 'next-intl';

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  
  const { setSong, setLyrics } = usePlayerStore();
  const { addToHistory, addToFavorites, favorites, removeFromFavorites } = useLibraryStore();
  const t = useTranslations('Search');
  const getCoverUrl = (song: Song) => {
    const rawUrl = song.al?.picUrl ?? song.album?.picUrl ?? song.picUrl;
    return rawUrl ? rawUrl.replace(/^http:\/\//, 'https://') : undefined;
  };
  const normalizeCoverUrl = (url?: string) => (url ? url.replace(/^http:\/\//, 'https://') : undefined);
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const res = await musicApi.search(query);
      if (res.data.result && res.data.result.songs) {
        const rawSongs = res.data.result.songs as RawSong[];
        const normalizedResults = rawSongs.map(normalizeSong);
        const missingCoverIds = normalizedResults
          .filter((song) => !getCoverUrl(song) && song.id)
          .map((song) => song.id);

        if (missingCoverIds.length > 0) {
          try {
            const detailsRes = await musicApi.getSongDetails(missingCoverIds);
            const songsWithDetails = (detailsRes.data?.songs || []) as Array<{ id: number; al?: { picUrl?: string } }>;
            const coverMap = new Map(songsWithDetails.map((s) => [s.id, s.al?.picUrl]));

            setResults(
              normalizedResults.map((song) => {
                const newCover = coverMap.get(song.id);
                const cover = normalizeCoverUrl(newCover);
                if (!cover) return song;
                return {
                  ...song,
                  al: song.al ? { ...song.al, picUrl: cover } : { id: song.id, name: song.name, picUrl: cover },
                  picUrl: cover,
                };
              })
            );
          } catch (err) {
            console.error('Failed to fetch song details for covers', err);
            setResults(normalizedResults);
          }
        } else {
          setResults(normalizedResults);
        }
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  type TenapiSongInfo = {
    code: number;
    data?: { id: number; cover?: string; url?: string; songs?: string; sings?: string; album?: string };
  };

  const playSong = async (song: Song) => {
    const normalizedSong = normalizeSong(song);

    // Optimistic UI
    setSong(normalizedSong); 
    addToHistory(normalizedSong);

    try {
      // 1. Get Song URL (Try VKeys for HQ first, then fallback to Standard)
      let url = '';
      let finalSong = normalizedSong;

      try {
        const vkeyRes = await musicApi.getVKeysSong(song.id);
        if (vkeyRes.data.code === 200 && vkeyRes.data.data && vkeyRes.data.data.url) {
          const vData = vkeyRes.data.data;
          url = vData.url.replace(/^http:/, 'https:');
          const hqCover = vData.cover ? vData.cover.replace(/^http:/, 'https:') : normalizedSong.picUrl;
          finalSong = { ...normalizedSong, picUrl: hqCover || normalizedSong.picUrl };
          console.log('Using VKeys HQ Audio:', vData.quality);
        }
      } catch (e) {
        console.warn('VKeys API failed, falling back to standard:', e);
      }

      if (!url) {
        const urlRes = await musicApi.getSongUrl(song.id);
        url = urlRes.data.data[0]?.url;
      }
      
      if (!url) {
        alert("Cannot play this song (No URL found)");
        return;
      }

      // Update song with URL
      setSong({ ...finalSong, url });

      // 2. Get Lyrics
      const lrcRes = await musicApi.getLyric(song.id);
      const lrc = lrcRes.data.lrc?.lyric || '';
      const tlyric = lrcRes.data.tlyric?.lyric || '';
      
      const parsedLyrics = parseLrc(lrc, tlyric);
      setLyrics(parsedLyrics);

    } catch (error) {
      console.error("Failed to load song data", error);
      alert("Error loading song");
    }
  };

  const isFavorite = (id: number) => favorites.some(s => s.id === id);

  const toggleFavorite = (e: React.MouseEvent, song: Song) => {
    e.stopPropagation();
    const normalizedSong = normalizeSong(song);

    if (isFavorite(song.id)) {
      removeFromFavorites(song.id);
    } else {
      addToFavorites(normalizedSong);
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="p-4">
        <form onSubmit={handleSearch} className="relative group">
          <SearchIcon className="absolute left-4 top-3 text-muted-foreground group-focus-within:text-primary transition-colors" size={18} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('placeholder')}
            className="w-full pl-12 pr-4 py-2.5 bg-muted/50 backdrop-blur-sm border-2 border-transparent focus:border-primary/50 rounded-2xl focus:outline-none focus:ring-0 text-sm transition-all"
          />
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {results.map((song) => {
              const coverUrl = getCoverUrl(song);

              return (
                <div
                key={song.id}
                onClick={() => playSong(song)}
                className="group flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <div className="relative w-12 h-12 flex-shrink-0">
                   {coverUrl ? (
                      <Image
                        src={coverUrl}
                        alt={song.name}
                        width={48}
                        height={48}
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

                  <button 
                    onClick={(e) => toggleFavorite(e, song)}
                    className={clsx(
                      "p-2 rounded-full hover:bg-muted transition-colors",
                      isFavorite(song.id) ? "text-red-500" : "text-muted-foreground opacity-0 group-hover:opacity-100"
                    )}
                  >
                    <Heart size={16} fill={isFavorite(song.id) ? "currentColor" : "none"} />
                  </button>
                </div>
              );
            })}
            {results.length === 0 && !loading && (
              <div className="text-center text-muted-foreground text-sm mt-8">
                {t('empty')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
