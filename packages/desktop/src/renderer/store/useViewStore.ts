import { create } from 'zustand';

export type ViewParams = {
  cafes: { cafeId?: string } | void;
  dashboard: { cafeId: string };
  'new-order': { cafeId: string };
  orders: { cafeId: string; orderId?: string } | void;
  terminals: void;
  workflows: { cafeId: string };
  'workflow-detail': { cafeId: string; workflowId: string };
  skills: { cafeId: string };
};

export type ViewName = keyof ViewParams;

interface ViewState {
  currentView: ViewName;
  viewParams?: ViewParams[ViewName];
  setView: <T extends ViewName>(view: T, params?: ViewParams[T]) => void;
}

export const useViewStore = create<ViewState>((set) => ({
  currentView: 'cafes',
  viewParams: undefined,
  setView: (view, params) => set({ currentView: view, viewParams: params }),
}));
