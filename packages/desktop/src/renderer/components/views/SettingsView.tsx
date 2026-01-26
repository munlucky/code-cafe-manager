import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Globe,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info,
} from 'lucide-react';
import type { Cafe } from '../../types/design';

/** Duration in ms to display save success status */
const SAVE_STATUS_DISPLAY_MS = 2000;

type SupportedLanguage = 'ko' | 'en' | 'ja' | 'zh';

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

interface SettingsViewProps {
  cafe: Cafe | null;
  onUpdateCafe: (id: string, settings: { language?: SupportedLanguage }) => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  cafe,
  onUpdateCafe,
}) => {
  const [language, setLanguage] = useState<SupportedLanguage>('en');
  const [originalLanguage, setOriginalLanguage] = useState<SupportedLanguage>('en');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    const lang = (cafe?.settings?.language as SupportedLanguage) || 'en';
    setLanguage(lang);
    setOriginalLanguage(lang);
  }, [cafe]);

  const hasChanges = language !== originalLanguage;

  const handleSave = useCallback(async () => {
    if (!cafe) return;
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      await onUpdateCafe(cafe.id, { language });
      setOriginalLanguage(language);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), SAVE_STATUS_DISPLAY_MS);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  }, [cafe, language, onUpdateCafe]);

  if (!cafe) {
    return (
      <div className="p-10 max-w-4xl mx-auto">
        <div className="text-center py-24 border-2 border-dashed border-cafe-800 rounded-3xl bg-cafe-900/30">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-cafe-800 mb-6 shadow-inner">
            <Settings className="w-10 h-10 text-cafe-600" />
          </div>
          <h3 className="text-2xl font-bold text-cafe-200 mb-3">
            No Cafe Selected
          </h3>
          <p className="text-cafe-500 max-w-md mx-auto">
            Select a cafe from the sidebar to configure its settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-10 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-cafe-100 mb-2 tracking-tight">
          Settings
        </h1>
        <p className="text-cafe-400">
          Configure settings for{' '}
          <span className="text-brand-light font-medium">{cafe.name}</span>
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
                Language Mode
              </h3>
              <p className="text-xs text-cafe-500">
                AI response language for this cafe
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {saveStatus === 'success' && (
              <span className="flex items-center gap-1 text-green-400 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                Saved
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center gap-1 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                Failed to save
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={`p-4 rounded-xl border-2 transition-all text-left ${
                language === lang.code
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
              <p>
                The AI will respond in the selected language. System prompts and
                skills remain in English for token efficiency.
              </p>
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
            Save Changes
          </button>
        </div>
      </div>

      {/* Additional Settings Placeholder */}
      <div className="bg-cafe-800/50 border border-cafe-700/50 border-dashed rounded-2xl p-6">
        <div className="text-center text-cafe-500">
          <p className="text-sm">More settings coming soon...</p>
        </div>
      </div>
    </div>
  );
};
