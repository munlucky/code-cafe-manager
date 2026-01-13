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
      const [statusResponse, metricsResponse] = await Promise.all([
        window.api.terminal.getStatus(),
        window.api.terminal.getMetrics(),
      ]);

      const newState: Partial<TerminalStoreState> = { loading: false };
      let errorMessage: string | null = null;

      if (statusResponse.success && statusResponse.data) {
        newState.status = statusResponse.data;
      } else {
        errorMessage = statusResponse.error?.message || 'Failed to load terminal status';
      }

      if (metricsResponse.success && metricsResponse.data) {
        newState.metrics = metricsResponse.data;
      } else {
        const metricsError = metricsResponse.error?.message || 'Failed to load terminal metrics';
        errorMessage = errorMessage ? `${errorMessage}, ${metricsError}` : metricsError;
      }

      if (errorMessage) {
        newState.error = errorMessage;
      }

      set(newState);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false,
      });
    }
  },

  initPool: async (config: any) => {
    set({ loading: true, error: null });
    try {
      const response = await window.api.terminal.init(config);
      if (response.success) {
        set({ initialized: true, loading: false });
        // Load initial status
        await get().load();
      } else {
        set({
          error: response.error?.message || 'Failed to initialize terminal pool',
          loading: false
        });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false
      });
    }
  },

  shutdown: async () => {
    set({ loading: true, error: null });
    try {
      const response = await window.api.terminal.shutdown();
      if (response.success) {
        set({
          initialized: false,
          status: null,
          metrics: null,
          loading: false
        });
      } else {
        set({
          error: response.error?.message || 'Failed to shutdown terminal pool',
          loading: false
        });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false
      });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
