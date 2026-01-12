/**
 * Cafe Store (Zustand)
 * Manages Cafe (Repository) state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Cafe } from '@codecafe/core';

interface CafeStore {
  // State
  cafes: Cafe[];
  currentCafeId: string | null;
  isLoading: boolean;

  // Actions
  setCafes: (cafes: Cafe[]) => void;
  addCafe: (cafe: Cafe) => void;
  updateCafe: (id: string, updates: Partial<Cafe>) => void;
  removeCafe: (id: string) => void;
  setCurrentCafe: (id: string | null) => void;
  setLoading: (isLoading: boolean) => void;

  // Computed
  getCurrentCafe: () => Cafe | null;
}

export const useCafeStore = create<CafeStore>()(
  persist(
    (set, get) => ({
      // Initial State
      cafes: [],
      currentCafeId: null,
      isLoading: false,

      // Actions
      setCafes: (cafes) => set({ cafes }),

      addCafe: (cafe) =>
        set((state) => ({
          cafes: [...state.cafes, cafe],
        })),

      updateCafe: (id, updates) =>
        set((state) => ({
          cafes: state.cafes.map((cafe) =>
            cafe.id === id ? { ...cafe, ...updates } : cafe
          ),
        })),

      removeCafe: (id) =>
        set((state) => ({
          cafes: state.cafes.filter((cafe) => cafe.id !== id),
          // Clear current cafe if it was deleted
          currentCafeId: state.currentCafeId === id ? null : state.currentCafeId,
        })),

      setCurrentCafe: (id) => set({ currentCafeId: id }),

      setLoading: (isLoading) => set({ isLoading }),

      // Computed
      getCurrentCafe: () => {
        const state = get();
        if (!state.currentCafeId) return null;
        return state.cafes.find((cafe) => cafe.id === state.currentCafeId) || null;
      },
    }),
    {
      name: 'cafe-store',
      // Only persist cafes and currentCafeId
      partialize: (state) => ({
        currentCafeId: state.currentCafeId,
      }),
    }
  )
);
