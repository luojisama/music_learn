'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Search as SearchIcon, Play, Heart, Loader2, Download, CheckCircle2 } from 'lucide-react';
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
  const [sortByCorrection, setSortByCorrection] = useState(true);
  
  const { setSong, setLyrics } = usePlayerStore();
  const { addToHistory, addToFavorites, favorites, removeFromFavorites, searchHistory, addToSearchHistory, clearSearchHistory, corrections, getCorrection } = useLibraryStore();
  const t = useTranslations('Search');

  const isCorrected = (songId: number) => !!corrections[songId];

  const getCoverUrl = (song: Song) => {
    const rawUrl = song.al?.picUrl ?? song.album?.picUrl ?? song.picUrl;
    return rawUrl ? rawUrl.replace(/^http:\/\//, 'https://') : undefined;
  };

  const normalizeCoverUrl = (url?: string) => (url ? url.replace(/^http:\/\//, 'https://') : undefined);

  type RawSong = Partial<Song> & { 
     id: number; 
     name: string; 
     ar?: { id: number; name: string }[]; 
     artists?: { id: number; name: string }[]; 
     duration?: number;
     pop?: number; // 增加热度字段
   };
  
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

  const handleSearch = async (e?: React.FormEvent, searchQuery?: string) => {
    if (e) e.preventDefault();
    const finalQuery = searchQuery || query;
    if (!finalQuery.trim()) return;

    if (!searchQuery) {
      addToSearchHistory(finalQuery);
    }
    
    setLoading(true);
    setResults([]);
    setPlaylists([]);

    try {
      const type = searchType === 'song' ? 1 : 1000;
      let res = await musicApi.search(finalQuery, type);
      
      let songs = res.data.result?.songs || res.data.songs || [];
      
      // 如果搜索结果较少且是歌曲搜索，尝试去掉括号内容进行二次搜索
      if (searchType === 'song' && songs.length < 5 && finalQuery.includes('(')) {
        const fuzzyQuery = finalQuery.replace(/\(.*\)/g, '').trim();
        if (fuzzyQuery && fuzzyQuery !== finalQuery) {
          const res2 = await musicApi.search(fuzzyQuery, type);
          const songs2 = res2.data.result?.songs || res2.data.songs || [];
          // 合并结果并去重
          const existingIds = new Set(songs.map((s: any) => s.id));
          songs = [...songs, ...songs2.filter((s: any) => !existingIds.has(s.id))];
        }
      }

      if (searchType === 'song') {
        if (songs && songs.length > 0) {
            const rawSongs = songs as RawSong[];
            let normalizedResults = rawSongs.map(normalizeSong);
            
            // 结果排序逻辑：优先按热度排序，并对官方版本和非官方版本进行权重微调
            normalizedResults = (songs as RawSong[]).map(s => ({
              ...normalizeSong(s),
              pop: s.pop || 0
            })).sort((a, b) => {
              const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '').replace(/[（(]/g, '(').replace(/[）)]/g, ')');
              const aName = normalize(a.name);
              const bName = normalize(b.name);
              const k = normalize(finalQuery);
              
              const aAr = a.ar?.map(ar => ar.name.toLowerCase()).join(',') || '';
              const bAr = b.ar?.map(ar => ar.name.toLowerCase()).join(',') || '';
              
              // 计算权重得分 (Score)
              let aScore = (a as any).pop || 0;
              let bScore = (b as any).pop || 0;

              // 1. 官方歌手加分 (MyGO!!!!!, CRYCHIC 等)
              const isOfficialAr = (s: string) => s.includes('mygo') || s.includes('crychic') || s.includes('ave mujica');
              if (isOfficialAr(aAr)) aScore += 50;
              if (isOfficialAr(bAr)) bScore += 50;

              // 2. 惩罚干扰项 (翻唱、AI、钢琴等) - 除非搜索词明确包含这些
              const isFanMade = (name: string) => {
                const n = name.toLowerCase();
                const fanKeywords = ['cover', '翻唱', '中文版', 'ai', '改编', 'remix', '钢琴', 'piano', 'ver.）', 'ver.)中文'];
                return fanKeywords.some(kw => n.includes(kw) && !k.includes(kw));
              };
              if (isFanMade(a.name)) aScore -= 80;
              if (isFanMade(b.name)) bScore -= 80;

              // 3. 伴奏惩罚
              if (aName.includes('instrumental') || aName.includes('伴奏')) aScore -= 100;
              if (bName.includes('instrumental') || bName.includes('伴奏')) bScore -= 100;

              // 4. 完全匹配微加分 (不再作为决定性因素)
          if (aName === k) aScore += 20;
          if (bName === k) bScore += 20;

          // 5. 人工修正权重极大加分 (优先显示)
          if (sortByCorrection) {
            if (isCorrected(a.id)) aScore += 1000;
            if (isCorrected(b.id)) bScore += 1000;
          }

          return bScore - aScore; // 分数高的排前面
        });

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
    const songId = song.id;
    const normalizedSong = normalizeSong(song);

    // Optimistic UI - Start by setting the basic info and show loading/playing state
    setSong(normalizedSong); 
    addToHistory(normalizedSong);

    try {
      // 1. Get Song URL (Try Viki API -> VKeys -> Standard)
      let url = '';
      let finalSong = normalizedSong;

      // Try Viki API first (as requested)
      try {
        const vikiRes = await musicApi.getVikiSongUrl(songId);
        // Viki API directly returns the URL if successful or an error object
        if (vikiRes.data && vikiRes.data.url) {
          url = vikiRes.data.url.replace(/^http:/, 'https:');
          console.log('Using Viki Audio API');
        }
      } catch (e) {
        console.warn('Viki API failed, trying VKeys:', e);
      }

      if (!url) {
        try {
          const vkeyRes = await musicApi.getVKeysSong(songId);
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
      }

      if (!url) {
        const urlRes = await musicApi.getSongUrl(songId);
        url = urlRes.data.data[0]?.url;
      }
      
      if (!url) {
        // Double check if the user hasn't switched to another song during the async calls
        const currentId = usePlayerStore.getState().currentSong?.id;
        if (currentId === songId) {
          alert("Cannot play this song (No URL found)");
        }
        return;
      }

      // Check if this song is still the one supposed to be playing
      const currentIdAfterUrl = usePlayerStore.getState().currentSong?.id;
      if (currentIdAfterUrl !== songId) {
        console.log('Song switched during URL fetch, ignoring results for', songId);
        return;
      }

      // Update song with URL
      setSong({ ...finalSong, url });

      // 2. Get Lyrics
      // Check for local correction first
      const correction = getCorrection(songId);
      if (correction) {
        setLyrics(correction.lyrics);
        console.log('Using manually corrected lyrics for', songId);
      } else {
        const lrcRes = await musicApi.getLyric(songId);
        
        // Final check before setting lyrics
        const currentIdAfterLrc = usePlayerStore.getState().currentSong?.id;
        if (currentIdAfterLrc !== songId) {
          console.log('Song switched during Lyric fetch, ignoring results for', songId);
          return;
        }

        const lrc = lrcRes.data.lrc?.lyric || '';
        const tlyric = lrcRes.data.tlyric?.lyric || '';
        const parsedLyrics = parseLrc(lrc, tlyric);
        setLyrics(parsedLyrics);
      }
    } catch (error) {
      console.error('Play song failed', error);
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

  const handleTypeSwitch = (type: 'song' | 'playlist') => {
    setSearchType(type);
    if (query.trim()) {
      // Use a small timeout to ensure state has updated or pass the type directly
      // Since handleSearch uses the searchType state, we might need to pass it or use a separate function
      // For simplicity, let's just trigger it; handleSearch will use the latest searchType if we're careful
      setTimeout(() => handleSearch(), 0);
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="p-4 space-y-3">
        {searchType === 'song' ? (
          <form onSubmit={(e) => handleSearch(e)} className="relative group">
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
            <form onSubmit={(e) => handleSearch(e)} className="relative group">
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
            onClick={() => handleTypeSwitch('song')}
            className={clsx(
              "flex-1 py-1.5 text-xs font-medium rounded-lg transition-all",
              searchType === 'song' ? "bg-white dark:bg-zinc-800 shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            歌曲
          </button>
          <button
            onClick={() => handleTypeSwitch('playlist')}
            className={clsx(
              "flex-1 py-1.5 text-xs font-medium rounded-lg transition-all",
              searchType === 'playlist' ? "bg-white dark:bg-zinc-800 shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            歌单
          </button>
        </div>

        {searchType === 'song' && results.length > 0 && (
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
              {results.length} 首歌曲
            </span>
            <button
              onClick={() => {
                setSortByCorrection(!sortByCorrection);
                // Trigger re-sort of existing results
                const sorted = [...results].sort((a, b) => {
                  // Re-calculate scores or just a simple correction-based sort
                  if (!sortByCorrection) {
                    if (isCorrected(a.id) && !isCorrected(b.id)) return -1;
                    if (!isCorrected(a.id) && isCorrected(b.id)) return 1;
                    return 0;
                  } else {
                    // When turning OFF correction sort, we'd ideally want to revert to original order
                    // but since we don't store it, we'll just leave it or use a simpler criteria
                    return 0; 
                  }
                });
                if (!sortByCorrection) {
                  setResults(sorted);
                } else {
                  // If turning off, maybe re-trigger search or just leave it
                  handleSearch();
                }
              }}
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
                    handleSearch(undefined, h);
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
                      <div className="flex items-center gap-1.5">
                        <div className="text-sm font-medium truncate group-hover:text-primary transition-colors">{song.name}</div>
                        {isCorrected(song.id) && (
                          <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-md border border-primary/20 whitespace-nowrap">
                            已修正
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {song.ar.map(a => a.name).join(', ')}
                      </div>
                      {isCorrected(song.id) && corrections[song.id].lyrics?.[0] && (
                        <div className="text-[10px] text-primary/60 italic truncate mt-0.5">
                          修正预览: {corrections[song.id].lyrics.find(l => l.romaji)?.romaji || corrections[song.id].lyrics[0].romaji}
                        </div>
                      )}
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
