import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SupportedLanguage = 'ko' | 'en' | 'ja' | 'zh';

interface SettingsState {
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'en',
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'codecafe-settings',
    }
  )
);
