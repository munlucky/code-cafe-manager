import { create } from 'zustand';
import type { Barista } from '../types/models';

interface BaristaState {
  baristas: Barista[];
  setBaristas: (baristas: Barista[]) => void;
  addBarista: (barista: Barista) => void;
  updateBarista: (id: string, updates: Partial<Barista>) => void;
}

export const useBaristaStore = create<BaristaState>((set) => ({
  baristas: [],
  setBaristas: (baristas) => set({ baristas }),
  addBarista: (barista) =>
    set((state) => ({ baristas: [...state.baristas, barista] })),
  updateBarista: (id, updates) =>
    set((state) => ({
      baristas: state.baristas.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    })),
}));
