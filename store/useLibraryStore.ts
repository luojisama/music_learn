import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Song } from './usePlayerStore';

interface LibraryState {
  favorites: Song[];
  history: Song[];
  addToFavorites: (song: Song) => void;
  removeFromFavorites: (id: number) => void;
  addToHistory: (song: Song) => void;
  clearHistory: () => void;
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set) => ({
      favorites: [],
      history: [],
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
      clearHistory: () => set({ history: [] }),
    }),
    {
      name: 'music-library-storage',
    }
  )
);
