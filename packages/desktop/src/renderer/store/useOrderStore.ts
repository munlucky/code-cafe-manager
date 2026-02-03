import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
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

export const useOrderStore = create<OrderState>()(
  immer((set) => ({
    orders: [],
    sessionStatuses: {},
    stageResults: {},
    todoProgress: {},

    // Core actions
    setOrders: (orders) => set({ orders }),

    addOrder: (order) =>
      set((state) => {
        state.orders.push(order);
      }),

    updateOrder: (id, updates) =>
      set((state) => {
        const index = state.orders.findIndex((o) => o.id === id);
        if (index !== -1) {
          Object.assign(state.orders[index], updates);
        }
      }),

    removeOrder: (id) =>
      set((state) => {
        state.orders = state.orders.filter((o) => o.id !== id);
      }),

    appendOrderLog: (orderId, log) =>
      set((state) => {
        const order = state.orders.find((o) => o.id === orderId);
        if (order) {
          if (!order.logs) order.logs = [];
          order.logs.push(log);
        }
      }),

    // Session Status actions
    updateSessionStatus: (orderId, status) =>
      set((state) => {
        if (!state.sessionStatuses[orderId]) {
          state.sessionStatuses[orderId] = {
            orderId,
            status: 'pending',
            awaitingInput: false,
          };
        }
        Object.assign(state.sessionStatuses[orderId], status);
      }),

    setAwaitingInput: (orderId, awaiting, prompt) =>
      set((state) => {
        if (!state.sessionStatuses[orderId]) {
          state.sessionStatuses[orderId] = {
            orderId,
            status: 'pending',
            awaitingInput: false,
          };
        }
        state.sessionStatuses[orderId].awaitingInput = awaiting;
        if (prompt !== undefined) {
          state.sessionStatuses[orderId].awaitingPrompt = prompt;
        }
      }),

    clearSessionStatus: (orderId) =>
      set((state) => {
        delete state.sessionStatuses[orderId];
      }),

    // Stage Results actions
    updateStageResult: (orderId, stageId, result) =>
      set((state) => {
        if (!state.stageResults[orderId]) {
          state.stageResults[orderId] = {};
        }
        if (!state.stageResults[orderId][stageId]) {
          state.stageResults[orderId][stageId] = {
            stageId,
            status: 'pending',
            output: [],
          };
        }
        Object.assign(state.stageResults[orderId][stageId], result);
      }),

    appendStageOutput: (orderId, stageId, output) =>
      set((state) => {
        if (!state.stageResults[orderId]) {
          state.stageResults[orderId] = {};
        }
        if (!state.stageResults[orderId][stageId]) {
          state.stageResults[orderId][stageId] = {
            stageId,
            status: 'running',
            output: [],
          };
        }
        state.stageResults[orderId][stageId].output.push(output);
      }),

    clearStageResults: (orderId) =>
      set((state) => {
        delete state.stageResults[orderId];
      }),

    // Todo Progress actions
    updateTodoProgress: (progress) =>
      set((state) => {
        state.todoProgress[progress.orderId] = progress;
      }),

    clearTodoProgress: (orderId) =>
      set((state) => {
        delete state.todoProgress[orderId];
      }),
  }))
);
