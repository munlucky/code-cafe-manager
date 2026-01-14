import { useBaristaStore } from '../store/useBaristaStore';
import type { ProviderType } from '../types/models';

export function useBaristas() {
  const { baristas, setBaristas, addBarista, updateBarista } = useBaristaStore();

  const fetchBaristas = async () => {
    try {
      const response = await window.codecafe.getAllBaristas();
      if (response.success && response.data) {
        setBaristas(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch baristas:', error);
    }
  };

  const createBarista = async (provider: ProviderType) => {
    try {
      const response = await window.codecafe.createBarista(provider);
      if (response.success && response.data) {
        addBarista(response.data);
        return response.data;
      }
      throw new Error(response.error?.message || 'Failed to create barista');
    } catch (error) {
      console.error('Failed to create barista:', error);
      throw error;
    }
  };

  return { baristas, fetchBaristas, createBarista, updateBarista };
}
