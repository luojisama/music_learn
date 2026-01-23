import axios from 'axios';

const API_BASE = '/api/music';

export const musicApi = {
  search: async (keywords: string, type = 1) => {
    // 歌曲搜索使用 cloudsearch (更智能，结果更全)，歌单搜索使用 search
    const endpoint = type === 1 ? 'cloudsearch' : 'search';
    return axios.get(`${API_BASE}/${endpoint}`, { 
      params: { 
        keywords, 
        type,
        limit: 30, // 增加返回数量，确保包含更多候选歌曲
        offset: 0
      } 
    });
  },
  getSongUrl: async (id: number | string) => {
    return axios.get(`${API_BASE}/song_url/v1`, { params: { id, level: 'standard' } });
  },
  getVikiSongUrl: async (id: number | string, br?: number) => {
    const params: any = {};
    if (br) params.br = br;
    return axios.get(`https://api.viki.moe/ncm/song/${id}/url`, { params });
  },
  getLyric: async (id: number | string) => {
    return axios.get(`${API_BASE}/lyric`, { params: { id } });
  },
  getSongDetail: async (id: number | string) => {
    return axios.get(`${API_BASE}/song/detail`, { params: { id, ids: id } });
  },
  getSongDetails: async (ids: (number | string)[]) => {
    return axios.get(`${API_BASE}/song/detail`, { params: { ids: ids.join(',') } });
  },
  getVKeysSong: async (id: number | string, quality = 9) => {
    return axios.get('https://api.vkeys.cn/v2/music/netease', { params: { id, quality } });
  },
  getPlaylistDetail: async (id: number | string) => {
    return axios.get(`${API_BASE}/playlist/detail`, { params: { id } });
  },
  getTenapiSongInfo: async (id: number | string) => {
    const data = new URLSearchParams({ id: String(id) });
    return axios.post('https://tenapi.cn/v2/songinfo', data, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
  },
  checkSong: async (id: number | string) => {
    return axios.get(`${API_BASE}/check/music`, { params: { id } });
  }
};
