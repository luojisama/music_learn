import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Song, LyricLine } from './usePlayerStore';
import axios from 'axios';

export interface SongCorrection {
  songId: number;
  lyrics: LyricLine[];
  updatedAt: number;
  isCorrected: boolean;
}

interface LibraryState {
  favorites: Song[];
  history: Song[];
  searchHistory: string[];
  corrections: Record<number, SongCorrection>; // Keyed by songId
  addToFavorites: (song: Song) => void;
  removeFromFavorites: (id: number) => void;
  addToHistory: (song: Song) => void;
  addToSearchHistory: (query: string) => void;
  clearHistory: () => void;
  clearSearchHistory: () => void;
  saveCorrection: (songId: number, lyrics: LyricLine[]) => Promise<{ success: boolean; error?: string }>;
  getCorrection: (songId: number) => SongCorrection | null;
  syncCorrections: () => Promise<void>;
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      favorites: [],
      history: [],
      searchHistory: [],
      corrections: {},
      addToFavorites: (song) => set((state) => {
        if (state.favorites.some(s => s.id === song.id)) return state;
        return { favorites: [...state.favorites, song] };
      }),
      removeFromFavorites: (id) => set((state) => ({
        favorites: state.favorites.filter(s => s.id !== id)
      })),
      addToHistory: (song) => set((state) => {
        // Remove if exists to push to top
        const filtered = state.history.filter(s => s.id !== song.id);
        return { history: [song, ...filtered].slice(0, 50) }; // Limit to 50
      }),
      addToSearchHistory: (query) => set((state) => {
        if (!query.trim()) return state;
        const filtered = state.searchHistory.filter(q => q !== query);
        return { searchHistory: [query, ...filtered].slice(0, 10) };
      }),
      clearHistory: () => set({ history: [] }),
      clearSearchHistory: () => set({ searchHistory: [] }),
      saveCorrection: async (songId, lyrics) => {
        const correction: SongCorrection = {
          songId,
          lyrics,
          updatedAt: Date.now(),
          isCorrected: true
        };

        // Sync to backend
        try {
          const res = await axios.post('/api/corrections', correction);
          
          // Only update local state if sync was successful or if not in production
          // Actually, we want optimistic update but let's at least know if it failed
          set((state) => ({
            corrections: {
              ...state.corrections,
              [songId]: correction
            }
          }));
          return { success: true };
        } catch (e: any) {
          console.error('Failed to sync correction to backend', e);
          return { 
            success: false, 
            error: e.response?.data?.error || e.message || 'Unknown error' 
          };
        }
      },
      getCorrection: (songId) => {
        const state = get();
        return state.corrections[songId] || null;
      },
      syncCorrections: async () => {
        try {
          const res = await axios.get('/api/corrections');
          if (res.data) {
            set({ corrections: res.data });
          }
        } catch (e) {
          console.error('Failed to sync corrections from backend', e);
        }
      },
    }),
    {
      name: 'music-library-storage',
    }
  )
);
