import { usePlayerStore, Song } from '@/store/usePlayerStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import { musicApi } from '@/lib/api';
import { parseLrc } from '@/lib/lrcParser';

export function usePlaySong() {
  const { setSong, setLyrics } = usePlayerStore();
  const { addToHistory, getCorrection } = useLibraryStore();

  const playSong = async (song: Song) => {
    const songId = song.id;
    
    // 1. 设置基础信息并添加到历史记录
    // 移除 URL 以防止播放缓存的 30s 试听片段或过期链接
    // 这样播放器会显示歌曲信息但等待新 URL 加载
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
        const lrcRes = await musicApi.getLyric(songId);
        const currentIdAfterLrc = usePlayerStore.getState().currentSong?.id;
        if (currentIdAfterLrc !== songId) return;

        const lrc = lrcRes.data.lrc?.lyric || '';
        const tlyric = lrcRes.data.tlyric?.lyric || '';
        const parsedLyrics = parseLrc(lrc, tlyric);
        setLyrics(parsedLyrics);
      }
    } catch (error) {
      console.error('Play song failed', error);
    }
  };

  return { playSong };
}
