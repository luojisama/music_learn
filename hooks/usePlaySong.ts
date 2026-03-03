import { usePlayerStore, Song } from '@/store/usePlayerStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import { musicApi } from '@/lib/api';
import { parseLrc, parsePlainLyric, parseRomalrc } from '@/lib/lrcParser';

export function usePlaySong() {
  const { setSong, setLyrics, setLoadingLyrics } = usePlayerStore();
  const { addToHistory, getCorrection } = useLibraryStore();

  const playSong = async (song: Song) => {
    const songId = song.id;

    // 1. 设置基础信息并添加到历史记录
    // 移除 URL 以防止播放缓存的 30s 试听片段或过期链接
    const songWithoutUrl = { ...song, url: undefined };
    setSong(songWithoutUrl);
    addToHistory(songWithoutUrl);

    try {
      // 2. 获取歌曲 URL (尝试 Viki API -> VKeys -> Standard)
      let url = '';
      let finalSong = song;

      // 尝试 Viki API
      try {
        const vikiRes = await musicApi.getVikiSongUrl(songId);
        if (vikiRes.data && vikiRes.data.url) {
          url = vikiRes.data.url.replace(/^http:/, 'https:');
          console.log('Using Viki Audio API');
        }
      } catch (e) {
        console.warn('Viki API failed, trying VKeys:', e);
      }

      // 尝试 VKeys
      if (!url) {
        try {
          const vkeyRes = await musicApi.getVKeysSong(songId);
          if (vkeyRes.data.code === 200 && vkeyRes.data.data && vkeyRes.data.data.url) {
            const vData = vkeyRes.data.data;
            url = vData.url.replace(/^http:/, 'https:');
            const hqCover = vData.cover ? vData.cover.replace(/^http:/, 'https:') : song.picUrl;
            finalSong = { ...song, picUrl: hqCover || song.picUrl };
            console.log('Using VKeys HQ Audio');
          }
        } catch (e) {
          console.warn('VKeys API failed, falling back to standard:', e);
        }
      }

      // 尝试标准接口
      if (!url) {
        const urlRes = await musicApi.getSongUrl(songId);
        url = urlRes.data.data[0]?.url;
      }

      if (!url) {
        const currentId = usePlayerStore.getState().currentSong?.id;
        if (currentId === songId) {
          alert("Cannot play this song (No URL found)");
        }
        return;
      }

      // 检查歌曲是否中途切换
      const currentIdAfterUrl = usePlayerStore.getState().currentSong?.id;
      if (currentIdAfterUrl !== songId) return;

      // 更新带 URL 的歌曲信息
      setSong({ ...finalSong, url });

      // 3. 获取歌词
      const correction = getCorrection(songId);
      if (correction) {
        setLyrics(correction.lyrics);
      } else {
        setLoadingLyrics(true);
        try {
          await fetchAndSetLyrics(songId, finalSong.dt);
        } finally {
          setLoadingLyrics(false);
        }
      }
    } catch (error) {
      console.error('Play song failed', error);
      setLoadingLyrics(false);
    }
  };

  /**
   * 多源策略获取歌词：
   * 1. 优先用 lyric 接口（含 lrc + tlyric + romalrc）
   * 2. 若 lrc 解析结果为空，尝试 lyric_new（更新格式）
   * 3. 若仍为空且存在纯文本内容，降级为纯文本显示
   */
  const fetchAndSetLyrics = async (songId: number, durationMs = 0) => {
    const currentSong = () => usePlayerStore.getState().currentSong?.id;

    let lrc = '';
    let tlyric = '';
    let romalrc = '';

    // 尝试主要 lyric 接口
    try {
      const lrcRes = await musicApi.getLyric(songId);
      if (currentSong() !== songId) return;

      const data = lrcRes.data;
      lrc = data.lrc?.lyric || '';
      tlyric = data.tlyric?.lyric || '';
      romalrc = data.romalrc?.lyric || '';
    } catch (e) {
      console.warn('lyric API failed:', e);
    }

    let parsedLyrics = parseLrc(lrc, tlyric);

    // 若主接口解析结果为空，尝试 lyric_new
    if (parsedLyrics.length === 0) {
      console.log(`[Lyrics] lyric empty for ${songId}, trying lyric_new...`);
      try {
        const newRes = await musicApi.getLyricNew(songId);
        if (currentSong() !== songId) return;

        const newData = newRes.data;
        const newLrc = newData.lrc?.lyric || '';
        const newTlyric = newData.tlyric?.lyric || '';
        const newRomalrc = newData.romalrc?.lyric || '';

        parsedLyrics = parseLrc(newLrc, newTlyric);
        if (!romalrc && newRomalrc) romalrc = newRomalrc;

        console.log(`[Lyrics] lyric_new parsed ${parsedLyrics.length} lines`);
      } catch (e) {
        console.warn('lyric_new API failed:', e);
      }
    }

    // 若仍为空，且 lrc 是纯文本（含换行），降级显示
    if (parsedLyrics.length === 0 && lrc && lrc.trim()) {
      const plainText = lrc.replace(/\[\d{1,2}:\d{2}[.:]\d{2,3}\]/g, '').trim();
      if (plainText) {
        console.log(`[Lyrics] Falling back to plain text for ${songId}`);
        parsedLyrics = parsePlainLyric(plainText, durationMs / 1000);
      }
    }

    if (currentSong() !== songId) return;

    // 将网易云 romalrc 自动填充到对应歌词行的 romaji 字段
    if (romalrc && parsedLyrics.length > 0) {
      const romajiMap = parseRomalrc(romalrc);
      if (romajiMap.size > 0) {
        console.log(`[Lyrics] Applying romalrc (${romajiMap.size} entries) for ${songId}`);
        parsedLyrics = parsedLyrics.map(line => {
          const key = Math.round(line.time * 10);
          // 查找容忍范围内的罗马音
          for (let offset = 0; offset <= 2; offset++) {
            if (romajiMap.has(key + offset)) return { ...line, romaji: romajiMap.get(key + offset) };
            if (offset > 0 && romajiMap.has(key - offset)) return { ...line, romaji: romajiMap.get(key - offset) };
          }
          return line;
        });
      }
    }

    setLyrics(parsedLyrics);
  };

  return { playSong };
}
