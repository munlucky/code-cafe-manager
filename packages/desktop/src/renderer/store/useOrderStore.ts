import { create } from 'zustand';
import type { Order, StageStatus } from '../types/models';

/**
 * Session status for a running order
 */
export interface SessionStatus {
  orderId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  awaitingInput: boolean;
  awaitingPrompt?: string;
}

/**
 * Result of a single stage execution
 */
export interface StageResult {
  stageId: string;
  status: StageStatus;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  output: string[];
  error?: string;
}

interface OrderState {
  // Core order data
  orders: Order[];
  
  // Session status per order (for running orders)
  sessionStatuses: Record<string, SessionStatus>;
  
  // Stage results per order
  stageResults: Record<string, Record<string, StageResult>>;
  
  // Actions - Core
  setOrders: (orders: Order[]) => void;
  addOrder: (order: Order) => void;
  updateOrder: (id: string, updates: Partial<Order>) => void;
  removeOrder: (id: string) => void;
  
  // Actions - Session Status
  updateSessionStatus: (orderId: string, status: Partial<SessionStatus>) => void;
  setAwaitingInput: (orderId: string, awaiting: boolean, prompt?: string) => void;
  clearSessionStatus: (orderId: string) => void;
  
  // Actions - Stage Results
  updateStageResult: (orderId: string, stageId: string, result: Partial<StageResult>) => void;
  appendStageOutput: (orderId: string, stageId: string, output: string) => void;
  clearStageResults: (orderId: string) => void;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  sessionStatuses: {},
  stageResults: {},
  
  // Core actions
  setOrders: (orders) => set({ orders }),
  
  addOrder: (order) => set((state) => ({ 
    orders: [...state.orders, order] 
  })),
  
  updateOrder: (id, updates) =>
    set((state) => ({
      orders: state.orders.map((o) => (o.id === id ? { ...o, ...updates } : o)),
    })),
    
  removeOrder: (id) => 
    set((state) => ({
      orders: state.orders.filter((o) => o.id !== id),
    })),

  // Session Status actions
  updateSessionStatus: (orderId, status) =>
    set((state) => ({
      sessionStatuses: {
        ...state.sessionStatuses,
        [orderId]: {
          ...state.sessionStatuses[orderId],
          orderId,
          ...status,
        } as SessionStatus,
      },
    })),
    
  setAwaitingInput: (orderId, awaiting, prompt) =>
    set((state) => ({
      sessionStatuses: {
        ...state.sessionStatuses,
        [orderId]: {
          ...state.sessionStatuses[orderId],
          orderId,
          awaitingInput: awaiting,
          awaitingPrompt: prompt,
        } as SessionStatus,
      },
    })),
    
  clearSessionStatus: (orderId) =>
    set((state) => {
      const { [orderId]: _, ...rest } = state.sessionStatuses;
      return { sessionStatuses: rest };
    }),

  // Stage Results actions
  updateStageResult: (orderId, stageId, result) =>
    set((state) => {
      const orderStages = state.stageResults[orderId] || {};
      const existingStage = orderStages[stageId] || { 
        stageId, 
        status: 'pending' as StageStatus, 
        output: [] 
      };
      
      return {
        stageResults: {
          ...state.stageResults,
          [orderId]: {
            ...orderStages,
            [stageId]: { ...existingStage, ...result },
          },
        },
      };
    }),
    
  appendStageOutput: (orderId, stageId, output) =>
    set((state) => {
      const orderStages = state.stageResults[orderId] || {};
      const existingStage = orderStages[stageId] || { 
        stageId, 
        status: 'running' as StageStatus, 
        output: [] 
      };
      
      return {
        stageResults: {
          ...state.stageResults,
          [orderId]: {
            ...orderStages,
            [stageId]: { 
              ...existingStage, 
              output: [...existingStage.output, output] 
            },
          },
        },
      };
    }),
    
  clearStageResults: (orderId) =>
    set((state) => {
      const { [orderId]: _, ...rest } = state.stageResults;
      return { stageResults: rest };
    }),
}));
