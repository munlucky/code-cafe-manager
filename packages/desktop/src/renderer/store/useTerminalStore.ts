/**
 * Terminal Store (Zustand)
 * Manages Terminal Pool state for UI
 */

import { create } from 'zustand';
import type { PoolStatus, PoolMetrics } from '@codecafe/core';

/**
 * 출력 메트릭 (Order별)
 */
interface OrderOutputMetrics {
  orderId: string;
  totalChunks: number;
  lastReceivedAt: Date | null;
  status: 'idle' | 'running' | 'completed' | 'failed';
}

interface TerminalStoreState {
  // State
  status: PoolStatus | null;
  metrics: PoolMetrics | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;

  // 실시간 출력 메트릭 (C2-3)
  outputMetrics: Map<string, OrderOutputMetrics>;

  // Actions
  load: () => Promise<void>;
  initPool: (config: any) => Promise<void>;
  shutdown: () => Promise<void>;
  clearError: () => void;

  // 메트릭 관련 액션
  updateOutputMetrics: (orderId: string, chunks: number, status?: OrderOutputMetrics['status']) => void;
  getOrderMetrics: (orderId: string) => OrderOutputMetrics | undefined;
  clearOrderMetrics: (orderId: string) => void;
}

export const useTerminalStore = create<TerminalStoreState>((set, get) => ({
  // Initial State
  status: null,
  metrics: null,
  loading: false,
  error: null,
  initialized: false,
  outputMetrics: new Map(),

  // Actions
  load: async () => {
    set({ loading: true, error: null });
    try {
      const [statusRes, metricsRes] = await Promise.all([
        window.api.terminal.getStatus(),
        window.api.terminal.getMetrics(),
      ]);

      const errors: string[] = [];
      const updates: Partial<TerminalStoreState> = {};

      if (statusRes.success && statusRes.data) {
        updates.status = statusRes.data;
      } else {
        errors.push(statusRes.error?.message || 'Failed to load terminal status');
      }

      if (metricsRes.success && metricsRes.data) {
        updates.metrics = metricsRes.data;
      } else {
        errors.push(metricsRes.error?.message || 'Failed to load terminal metrics');
      }

      if (errors.length > 0) {
        updates.error = errors.join(', ');
      }

      set(updates);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      set({ loading: false });
    }
  },

  initPool: async (config: any) => {
    set({ loading: true, error: null });
    try {
      const response = await window.api.terminal.init(config);

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to initialize terminal pool');
      }

      set({ initialized: true });
      // Load initial status
      await get().load();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      set({ loading: false });
    }
  },

  shutdown: async () => {
    set({ loading: true, error: null });
    try {
      const response = await window.api.terminal.shutdown();

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to shutdown terminal pool');
      }

      set({
        initialized: false,
        status: null,
        metrics: null,
        outputMetrics: new Map(),
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      set({ loading: false });
    }
  },

  clearError: () => {
    set({ error: null });
  },

  // 메트릭 관련 액션
  updateOutputMetrics: (orderId: string, chunks: number, status?: OrderOutputMetrics['status']) => {
    set((state) => {
      const newMetrics = new Map(state.outputMetrics);
      const existing = newMetrics.get(orderId);

      newMetrics.set(orderId, {
        orderId,
        totalChunks: chunks,
        lastReceivedAt: new Date(),
        status: status || existing?.status || 'running',
      });

      return { outputMetrics: newMetrics };
    });
  },

  getOrderMetrics: (orderId: string) => {
    return get().outputMetrics.get(orderId);
  },

  clearOrderMetrics: (orderId: string) => {
    set((state) => {
      const newMetrics = new Map(state.outputMetrics);
      newMetrics.delete(orderId);
      return { outputMetrics: newMetrics };
    });
  },
}));
