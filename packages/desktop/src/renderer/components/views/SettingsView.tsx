import React, { useState, useCallback } from 'react';
import {
  Settings,
  Globe,
  Save,
  CheckCircle2,
  Loader2,
  Info,
} from 'lucide-react';
import { useSettingsStore, type SupportedLanguage } from '../../store/useSettingsStore';
import { useTranslation } from '../../i18n';

/** Duration in ms to display save success status */
const SAVE_STATUS_DISPLAY_MS = 2000;

interface LanguageOption {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
];

export const SettingsView: React.FC = () => {
  const { t } = useTranslation();
  const { language, setLanguage } = useSettingsStore();
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(language);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success'>('idle');

  const hasChanges = selectedLanguage !== language;

  const handleSave = useCallback(() => {
    setIsSaving(true);
    // Simulate a brief save delay for UX
    setTimeout(() => {
      setLanguage(selectedLanguage);
      setSaveStatus('success');
      setIsSaving(false);
      setTimeout(() => setSaveStatus('idle'), SAVE_STATUS_DISPLAY_MS);
    }, 300);
  }, [selectedLanguage, setLanguage]);

  return (
    <div className="p-10 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-cafe-100 mb-2 tracking-tight">
          {t('settings.title')}
        </h1>
        <p className="text-cafe-400">
          {t('settings.subtitle')}
        </p>
      </div>

      {/* Language Settings */}
      <div className="bg-cafe-800 border border-cafe-700 rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand/20 rounded-lg">
              <Globe className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-cafe-100">
                {t('settings.language')}
              </h3>
              <p className="text-xs text-cafe-500">
                {t('settings.languageDesc')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {saveStatus === 'success' && (
              <span className="flex items-center gap-1 text-green-400 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                {t('houseRules.saved')}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setSelectedLanguage(lang.code)}
              className={`p-4 rounded-xl border-2 transition-all text-left ${
                selectedLanguage === lang.code
                  ? 'border-brand bg-brand/10 text-cafe-100'
                  : 'border-cafe-700 bg-cafe-900/50 text-cafe-400 hover:border-cafe-600 hover:text-cafe-300'
              }`}
            >
              <div className="font-medium">{lang.nativeName}</div>
              <div className="text-xs opacity-60">{lang.name}</div>
            </button>
          ))}
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-cafe-900/50 border border-cafe-700/50 rounded-xl">
          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-cafe-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-cafe-500">
              <p>{t('settings.languageInfo')}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6 pt-4 border-t border-cafe-700">
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="px-6 py-2 bg-brand hover:bg-brand-hover text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2 transition-colors"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {t('settings.saveChanges')}
          </button>
        </div>
      </div>

      {/* Additional Settings Placeholder */}
      <div className="bg-cafe-800/50 border border-cafe-700/50 border-dashed rounded-2xl p-6">
        <div className="text-center text-cafe-500">
          <p className="text-sm">{t('settings.moreSettings')}</p>
        </div>
      </div>
    </div>
  );
};
