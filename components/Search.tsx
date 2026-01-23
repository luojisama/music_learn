'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Search as SearchIcon, Play, Heart, Loader2, Download } from 'lucide-react';
import { musicApi } from '@/lib/api';
import { usePlayerStore, Song } from '@/store/usePlayerStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import { parseLrc } from '@/lib/lrcParser';
import { clsx } from 'clsx';
import { useTranslations } from 'next-intl';

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [searchType, setSearchType] = useState<'song' | 'playlist'>('song');
  const [loading, setLoading] = useState(false);
  
  const { setSong, setLyrics } = usePlayerStore();
  const { addToHistory, addToFavorites, favorites, removeFromFavorites, searchHistory, addToSearchHistory, clearSearchHistory } = useLibraryStore();
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

  const [importId, setImportId] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const handleImportPlaylist = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!importId.trim()) return;

    setIsImporting(true);
    try {
      // 支持输入完整的 URL 或 纯 ID
      const idMatch = importId.match(/id=(\d+)/);
      const playlistId = idMatch ? idMatch[1] : importId.trim();

      const res = await musicApi.getPlaylistDetail(playlistId);
      if (res.data.playlist && res.data.playlist.tracks) {
        const tracks = res.data.playlist.tracks as RawSong[];
        const normalizedTracks = tracks.map(normalizeSong);
        setResults(normalizedTracks);
        setSearchType('song');
        setImportId(''); // 清空输入
      } else {
        alert("未能获取到歌单信息，请检查 ID 是否正确。");
      }
    } catch (error) {
      console.error("Failed to import playlist", error);
      alert("导入失败，请稍后重试。");
    } finally {
      setIsImporting(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    addToSearchHistory(query);
    setLoading(true);
    setResults([]);
    setPlaylists([]);

    try {
      const type = searchType === 'song' ? 1 : 1000;
      const res = await musicApi.search(query, type);
      
      if (searchType === 'song') {
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
        }
      } else {
        if (res.data.result && res.data.result.playlists) {
          setPlaylists(res.data.result.playlists);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaylistClick = async (playlist: any) => {
    setLoading(true);
    try {
      const res = await musicApi.getPlaylistDetail(playlist.id);
      if (res.data.playlist && res.data.playlist.tracks) {
        const tracks = res.data.playlist.tracks as RawSong[];
        setResults(tracks.map(normalizeSong));
        setSearchType('song');
      }
    } catch (error) {
      console.error("Failed to load playlist tracks", error);
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
      <div className="p-4 space-y-3">
        {searchType === 'song' ? (
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
        ) : (
          <div className="space-y-3">
            <form onSubmit={handleSearch} className="relative group">
              <SearchIcon className="absolute left-4 top-3 text-muted-foreground group-focus-within:text-primary transition-colors" size={18} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索歌单..."
                className="w-full pl-12 pr-4 py-2.5 bg-muted/50 backdrop-blur-sm border-2 border-transparent focus:border-primary/50 rounded-2xl focus:outline-none focus:ring-0 text-sm transition-all"
              />
            </form>
            
            <div className="relative group">
              <form onSubmit={handleImportPlaylist} className="flex gap-2">
                <div className="relative flex-1">
                  <Download className="absolute left-4 top-3 text-muted-foreground group-focus-within:text-primary transition-colors" size={18} />
                  <input
                    type="text"
                    value={importId}
                    onChange={(e) => setImportId(e.target.value)}
                    placeholder="输入歌单 ID 或链接导入"
                    className="w-full pl-12 pr-4 py-2.5 bg-muted/50 backdrop-blur-sm border-2 border-transparent focus:border-primary/50 rounded-2xl focus:outline-none focus:ring-0 text-sm transition-all"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={isImporting || !importId.trim()}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-2xl text-xs font-medium hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {isImporting ? <Loader2 className="animate-spin" size={16} /> : "导入"}
                </button>
              </form>
            </div>
          </div>
        )}

        <div className="flex gap-2 p-1 bg-muted/30 rounded-xl">
          <button
            onClick={() => setSearchType('song')}
            className={clsx(
              "flex-1 py-1.5 text-xs font-medium rounded-lg transition-all",
              searchType === 'song' ? "bg-white dark:bg-zinc-800 shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            歌曲
          </button>
          <button
            onClick={() => setSearchType('playlist')}
            className={clsx(
              "flex-1 py-1.5 text-xs font-medium rounded-lg transition-all",
              searchType === 'playlist' ? "bg-white dark:bg-zinc-800 shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            歌单
          </button>
        </div>

        {searchHistory.length > 0 && !loading && results.length === 0 && playlists.length === 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">最近搜索</span>
              <button 
                onClick={clearSearchHistory}
                className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
              >
                清空
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {searchHistory.map((h, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setQuery(h);
                    // Trigger search manually since we can't easily trigger form submit
                    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
                    handleSearch(fakeEvent);
                  }}
                  className="px-3 py-1 bg-muted/40 hover:bg-muted/60 text-xs rounded-full transition-all"
                >
                  {h}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {searchType === 'song' ? (
              results.map((song) => {
                const coverUrl = getCoverUrl(song);

                return (
                  <div
                    key={song.id}
                    onClick={() => playSong(song)}
                    className="group flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 cursor-pointer transition-all"
                  >
                    <div className="relative w-10 h-10 flex-shrink-0">
                      {coverUrl ? (
                        <Image
                          src={coverUrl}
                          alt={song.name}
                          width={40}
                          height={40}
                          className="w-full h-full object-cover rounded-lg shadow-sm"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted/50 rounded-lg flex items-center justify-center text-muted-foreground text-xs">?</div>
                      )}
                      <div className="absolute inset-0 bg-black/20 hidden group-hover:flex items-center justify-center rounded-lg">
                        <Play size={16} className="text-white" fill="white" />
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate group-hover:text-primary transition-colors">{song.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {song.ar.map(a => a.name).join(', ')}
                      </div>
                    </div>

                    <button
                      onClick={(e) => toggleFavorite(e, song)}
                      className={clsx(
                        "p-2 rounded-full hover:bg-primary/10 transition-colors opacity-0 group-hover:opacity-100",
                        isFavorite(song.id) ? "text-red-500 opacity-100" : "text-muted-foreground"
                      )}
                    >
                      <Heart size={16} fill={isFavorite(song.id) ? "currentColor" : "none"} />
                    </button>
                  </div>
                );
              })
            ) : (
              playlists.map((playlist) => {
                const coverUrl = normalizeCoverUrl(playlist.coverImgUrl);

                return (
                  <div
                    key={playlist.id}
                    onClick={() => handlePlaylistClick(playlist)}
                    className="group flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 cursor-pointer transition-all"
                  >
                    <div className="relative w-12 h-12 flex-shrink-0">
                      {coverUrl ? (
                        <Image
                          src={coverUrl}
                          alt={playlist.name}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover rounded-lg shadow-sm"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted/50 rounded-lg flex items-center justify-center text-muted-foreground text-xs">?</div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate group-hover:text-primary transition-colors">{playlist.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {playlist.trackCount} 首歌曲 · by {playlist.creator?.nickname}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            {!loading && results.length === 0 && playlists.length === 0 && query && (
              <div className="text-center text-muted-foreground text-xs py-8">
                未找到结果
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
