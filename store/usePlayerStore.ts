import { create } from 'zustand';

export interface LyricLine {
  time: number;
  text: string;
  translation?: string;
  romaji?: string;
  furigana?: string; // HTML from kuroshiro furigana mode, e.g. <ruby>漢<rt>かん</rt></ruby>
}

export interface Song {
  id: number;
  name: string;
  ar: { id: number; name: string }[];
  al?: { id: number; name: string; picUrl?: string };
  album?: { id?: number; name?: string; picUrl?: string };
  picUrl?: string;
  dt: number; // duration
  url?: string;
}

interface PlayerState {
  isPlaying: boolean;
  currentSong: Song | null;
  playbackRate: number;
  loopMode: 'off' | 'single' | 'list'; // We might only support single for now based on request "Single sentence loop"
  volume: number;
  currentTime: number;
  duration: number;
  lyrics: LyricLine[];
  currentLyricIndex: number;
  isLyricLooping: boolean;
  
  // Actions
  setPlaying: (playing: boolean) => void;
  setSong: (song: Song) => void;
  setPlaybackRate: (rate: number) => void;
  setLoopMode: (mode: 'off' | 'single' | 'list') => void;
  setVolume: (volume: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setLyrics: (lyrics: LyricLine[]) => void;
  setCurrentLyricIndex: (index: number) => void;
  updateLyricRomaji: (index: number, romaji: string) => void;
  updateLyricFurigana: (index: number, furigana: string) => void;
  toggleLyricLoop: () => void;
  isLoadingLyrics: boolean;
  setLoadingLyrics: (loading: boolean) => void;
  // Seek Request
  seekTime: number | null;
  requestSeek: (time: number) => void;
  clearSeek: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  isPlaying: false,
  currentSong: null,
  playbackRate: 1.0,
  loopMode: 'off',
  volume: 1.0,
  currentTime: 0,
  duration: 0,
  lyrics: [],
  currentLyricIndex: -1,
  isLyricLooping: false,
  isLoadingLyrics: false,
  seekTime: null,

  setPlaying: (playing) => set({ isPlaying: playing }),
  setSong: (song) => set({ 
    currentSong: song, 
    isPlaying: true, 
    currentTime: 0, 
    isLyricLooping: false, 
    seekTime: 0,
    duration: song.dt ? song.dt / 1000 : 0 
  }),
  setPlaybackRate: (rate) => set({ playbackRate: rate }),
  setLoopMode: (mode) => set({ loopMode: mode }),
  setVolume: (volume) => set({ volume }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setLyrics: (lyrics) => set({ lyrics }),
  setCurrentLyricIndex: (index) => set({ currentLyricIndex: index }),
  updateLyricRomaji: (index, romaji) => set((state) => {
    const newLyrics = [...state.lyrics];
    if (newLyrics[index]) {
      newLyrics[index] = { ...newLyrics[index], romaji };
    }
    return { lyrics: newLyrics };
  }),
  updateLyricFurigana: (index, furigana) => set((state) => {
    const newLyrics = [...state.lyrics];
    if (newLyrics[index]) {
      newLyrics[index] = { ...newLyrics[index], furigana };
    }
    return { lyrics: newLyrics };
  }),
  toggleLyricLoop: () => set((state) => ({ isLyricLooping: !state.isLyricLooping })),
  setLoadingLyrics: (loading) => set({ isLoadingLyrics: loading }),
  requestSeek: (time) => set({ seekTime: time, currentTime: time }),
  clearSeek: () => set({ seekTime: null }),
}));
