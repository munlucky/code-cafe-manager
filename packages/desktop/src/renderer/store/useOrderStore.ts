import { create } from 'zustand';
import type { Order, StageStatus, WorkflowLog } from '../types/models';

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

/**
 * Todo progress from Claude's TodoWrite tool
 */
export interface TodoProgress {
  orderId: string;
  timestamp: string;
  completed: number;
  inProgress: number;
  total: number;
  todos?: Array<{
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
    activeForm?: string;
  }>;
}

interface OrderState {
  // Core order data
  orders: Order[];

  // Session status per order (for running orders)
  sessionStatuses: Record<string, SessionStatus>;

  // Stage results per order
  stageResults: Record<string, Record<string, StageResult>>;

  // Todo progress per order (from Claude's TodoWrite)
  todoProgress: Record<string, TodoProgress>;

  // Actions - Core
  setOrders: (orders: Order[]) => void;
  addOrder: (order: Order) => void;
  updateOrder: (id: string, updates: Partial<Order>) => void;
  removeOrder: (id: string) => void;
  appendOrderLog: (orderId: string, log: WorkflowLog) => void;

  // Actions - Session Status
  updateSessionStatus: (orderId: string, status: Partial<SessionStatus>) => void;
  setAwaitingInput: (orderId: string, awaiting: boolean, prompt?: string) => void;
  clearSessionStatus: (orderId: string) => void;

  // Actions - Stage Results
  updateStageResult: (orderId: string, stageId: string, result: Partial<StageResult>) => void;
  appendStageOutput: (orderId: string, stageId: string, output: string) => void;
  clearStageResults: (orderId: string) => void;

  // Actions - Todo Progress
  updateTodoProgress: (progress: TodoProgress) => void;
  clearTodoProgress: (orderId: string) => void;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  sessionStatuses: {},
  stageResults: {},
  todoProgress: {},
  
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

  appendOrderLog: (orderId, log) =>
    set((state) => ({
      orders: state.orders.map((o) =>
        o.id === orderId
          ? { ...o, logs: [...(o.logs || []), log] }
          : o
      ),
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

  // Todo Progress actions
  updateTodoProgress: (progress) =>
    set((state) => ({
      todoProgress: {
        ...state.todoProgress,
        [progress.orderId]: progress,
      },
    })),

  clearTodoProgress: (orderId) =>
    set((state) => {
      const { [orderId]: _, ...rest } = state.todoProgress;
      return { todoProgress: rest };
    }),
}));
