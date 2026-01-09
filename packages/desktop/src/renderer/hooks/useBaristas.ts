import { useBaristaStore } from '../store/useBaristaStore';
import type { ProviderType } from '../types/models';

export function useBaristas() {
  const { baristas, setBaristas, addBarista, updateBarista } = useBaristaStore();

  const fetchBaristas = async () => {
    try {
      const data = await window.codecafe.getAllBaristas();
      setBaristas(data);
    } catch (error) {
      console.error('Failed to fetch baristas:', error);
    }
  };

  const createBarista = async (provider: ProviderType) => {
    try {
      const barista = await window.codecafe.createBarista(provider);
      addBarista(barista);
      return barista;
    } catch (error) {
      console.error('Failed to create barista:', error);
      throw error;
    }
  };

  return { baristas, fetchBaristas, createBarista, updateBarista };
}
