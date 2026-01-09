import { create } from 'zustand';

export type ViewName =
  | 'dashboard'
  | 'new-order'
  | 'orders'
  | 'worktrees'
  | 'recipes';

interface ViewState {
  currentView: ViewName;
  setView: (view: ViewName) => void;
}

export const useViewStore = create<ViewState>((set) => ({
  currentView: 'dashboard',
  setView: (view) => set({ currentView: view }),
}));
