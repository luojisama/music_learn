import axios from 'axios';

const API_BASE = '/api/music';

export const musicApi = {
  search: async (keywords: string, type = 1) => {
    return axios.get(`${API_BASE}/search`, { params: { keywords, type } });
  },
  getSongUrl: async (id: number | string) => {
    return axios.get(`${API_BASE}/song_url/v1`, { params: { id, level: 'standard' } });
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
