import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Song } from './usePlayerStore';

interface LibraryState {
  favorites: Song[];
  history: Song[];
  searchHistory: string[];
  addToFavorites: (song: Song) => void;
  removeFromFavorites: (id: number) => void;
  addToHistory: (song: Song) => void;
  addToSearchHistory: (query: string) => void;
  clearHistory: () => void;
  clearSearchHistory: () => void;
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set) => ({
      favorites: [],
      history: [],
      searchHistory: [],
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
    }),
    {
      name: 'music-library-storage',
    }
  )
);
