/**
 * Cafe CRUD handlers hook
 */

import { useCallback } from 'react';
import { useCafeStore } from '../store/useCafeStore';

export function useCafeHandlers() {
  const { loadCafes } = useCafeStore();

  const handleCreateCafe = useCallback(
    async (path: string) => {
      const res = await window.codecafe.cafe.create({ path });
      if (res.success && res.data) {
        await loadCafes();
      }
    },
    [loadCafes]
  );

  const handleDeleteCafe = useCallback(
    async (cafeId: string) => {
      const res = await window.codecafe.cafe.delete(cafeId);
      if (res.success) {
        await loadCafes();
      }
    },
    [loadCafes]
  );

  return {
    handleCreateCafe,
    handleDeleteCafe,
  };
}
