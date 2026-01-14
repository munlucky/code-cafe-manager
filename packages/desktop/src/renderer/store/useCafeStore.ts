/**
 * Cafe Store (Zustand)
 * Manages Cafe (Repository) state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Cafe } from '@codecafe/core';

interface CafeStoreState {
  // State
  cafes: Cafe[];
  currentCafeId: string | null;
  loading: boolean;
  error: string | null;

  // Actions
  loadCafes: () => Promise<void>;
  createCafe: (path: string) => Promise<void>;
  updateCafe: (id: string, updates: Partial<Cafe>) => void;
  deleteCafe: (id: string) => Promise<void>;
  selectCafe: (id: string | null) => Promise<void>;
  setCurrentCafe: (id: string | null) => void; // Legacy/Simple setter if needed, or alias to selectCafe without async

  clearError: () => void;

  // Computed
  getCurrentCafe: () => Cafe | null;
}

export const useCafeStore = create<CafeStoreState>()(
  persist(
    (set, get) => ({
      // Initial State
      cafes: [],
      currentCafeId: null,
      loading: false,
      error: null,

      // Actions
      loadCafes: async () => {
        set({ loading: true, error: null });
        try {
          const cafes = await window.codecafe.cafe.list();
          set({ cafes });
        } catch (err: any) {
          set({ error: err.message || 'Failed to load cafes' });
        } finally {
          set({ loading: false });
        }
      },

      createCafe: async (path: string) => {
        set({ loading: true, error: null });
        try {
          const newCafe = await window.codecafe.cafe.create({ path });
          set((state) => ({
            cafes: [...state.cafes, newCafe]
          }));
        } catch (err: any) {
          const message = err.message || 'Failed to create cafe';
          set({ error: message });
          throw new Error(message);
        } finally {
          set({ loading: false });
        }
      },

      updateCafe: (id, updates) =>
        set((state) => ({
          cafes: state.cafes.map((cafe) =>
            cafe.id === id ? { ...cafe, ...updates } : cafe
          ),
        })),

      deleteCafe: async (id: string) => {
        set({ loading: true, error: null });
        try {
          await window.codecafe.cafe.delete(id);
          set((state) => ({
            cafes: state.cafes.filter((cafe) => cafe.id !== id),
            currentCafeId: state.currentCafeId === id ? null : state.currentCafeId,
          }));
        } catch (err: any) {
          set({ error: err.message || 'Failed to delete cafe' });
        } finally {
          set({ loading: false });
        }
      },

      selectCafe: async (id: string | null) => {
        set({ currentCafeId: id });
        if (id) {
          try {
            await window.codecafe.cafe.setLastAccessed(id);
          } catch (error) {
            console.error('Failed to set last accessed cafe:', error);
          }
        }
      },

      // Kept for backward compatibility or simple switching without side effects
      setCurrentCafe: (id) => set({ currentCafeId: id }),

      clearError: () => set({ error: null }),

      // Computed
      getCurrentCafe: () => {
        const state = get();
        if (!state.currentCafeId) return null;
        return state.cafes.find((cafe) => cafe.id === state.currentCafeId) || null;
      },
    }),
    {
      name: 'cafe-store',
      // Only persist currentCafeId (cafes are loaded from backend)
      partialize: (state) => ({
        currentCafeId: state.currentCafeId,
      }),
    }
  )
);
