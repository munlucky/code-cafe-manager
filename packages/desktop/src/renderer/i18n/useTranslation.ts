import { useCallback } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';
import { getTranslation, type TranslationKey } from './translations';

export function useTranslation() {
  const language = useSettingsStore((state) => state.language);

  const t = useCallback(
    (key: TranslationKey): string => {
      return getTranslation(language, key);
    },
    [language]
  );

  return { t, language };
}
