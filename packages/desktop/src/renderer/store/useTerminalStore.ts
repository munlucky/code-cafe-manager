/**
 * Terminal Store (Zustand)
 * Manages Terminal Pool state for UI
 */

import { create } from 'zustand';
import type { PoolStatus, PoolMetrics } from '@codecafe/core';

interface TerminalStoreState {
  // State
  status: PoolStatus | null;
  metrics: PoolMetrics | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;

  // Actions
  load: () => Promise<void>;
  initPool: (config: any) => Promise<void>;
  shutdown: () => Promise<void>;
  clearError: () => void;
}

export const useTerminalStore = create<TerminalStoreState>((set, get) => ({
  // Initial State
  status: null,
  metrics: null,
  loading: false,
  error: null,
  initialized: false,

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
}));
