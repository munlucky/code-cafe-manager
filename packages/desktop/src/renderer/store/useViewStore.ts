import { create } from 'zustand';

export type ViewParams = {
  cafes: void;
  dashboard: void;
  'new-order': void;
  orders: { orderId?: string };
  terminals: void;
  worktrees: void;
  roles: { roleId?: string; mode?: 'list' | 'detail' | 'create' | 'edit' };
};

export type ViewName = keyof ViewParams;

interface ViewState {
  currentView: ViewName;
  viewParams?: ViewParams[ViewName];
  setView: <T extends ViewName>(view: T, params?: ViewParams[T]) => void;
}

export const useViewStore = create<ViewState>((set) => ({
  currentView: 'dashboard',
  viewParams: undefined,
  setView: (view, params) => set({ currentView: view, viewParams: params }),
}));
