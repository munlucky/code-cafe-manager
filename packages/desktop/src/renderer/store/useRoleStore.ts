/**
 * Role Store (Zustand)
 * Manages Role state for UI
 */

import { create } from 'zustand';
// import type { Role } from '@codecafe/core/types/role';

// Temporary type for compilation
interface Role {
  id: string;
  name: string;
  systemPrompt: string;
  skills: string[];
  recommendedProvider: string;
  variables: any[];
  isDefault: boolean;
  source: string;
}

interface RoleStoreState {
  // State
  roles: Role[];
  loading: boolean;
  error: string | null;
  selectedRoleId: string | null;

  // Actions
  loadRoles: () => Promise<void>;
  selectRole: (id: string | null) => void;
  clearError: () => void;
}

export const useRoleStore = create<RoleStoreState>((set, get) => ({
  // Initial State
  roles: [],
  loading: false,
  error: null,
  selectedRoleId: null,

  // Actions
  loadRoles: async () => {
    set({ loading: true, error: null });
    try {
      const response = await window.api.role.list();
      if (response.success && response.data) {
        set({ roles: response.data, loading: false });
      } else {
        set({
          error: response.error?.message || 'Failed to load roles',
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

  selectRole: (id: string | null) => {
    set({ selectedRoleId: id });
  },

  clearError: () => {
    set({ error: null });
  },
}));