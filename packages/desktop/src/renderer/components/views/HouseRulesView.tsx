import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollText,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info,
} from 'lucide-react';
import type { Cafe } from '../../types/design';
import { useTranslation } from '../../i18n';

/** Duration in ms to display save success status */
const SAVE_STATUS_DISPLAY_MS = 2000;

interface HouseRulesViewProps {
  cafe: Cafe | null;
  onUpdateCafe: (id: string, settings: { systemPrompt?: string }) => Promise<void>;
}

export const HouseRulesView: React.FC<HouseRulesViewProps> = ({
  cafe,
  onUpdateCafe,
}) => {
  const { t } = useTranslation();
  const [systemPrompt, setSystemPrompt] = useState('');
  const [originalPrompt, setOriginalPrompt] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (cafe?.settings?.systemPrompt) {
      setSystemPrompt(cafe.settings.systemPrompt);
      setOriginalPrompt(cafe.settings.systemPrompt);
    } else {
      setSystemPrompt('');
      setOriginalPrompt('');
    }
  }, [cafe]);

  const hasChanges = systemPrompt !== originalPrompt;

  const handleSave = useCallback(async () => {
    if (!cafe) return;
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      await onUpdateCafe(cafe.id, { systemPrompt });
      setOriginalPrompt(systemPrompt);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), SAVE_STATUS_DISPLAY_MS);
    } catch (error) {
      console.error('Failed to save system prompt:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  }, [cafe, systemPrompt, onUpdateCafe]);

  const handleReset = useCallback(() => {
    setSystemPrompt(originalPrompt);
  }, [originalPrompt]);

  if (!cafe) {
    return (
      <div className="p-10 max-w-4xl mx-auto">
        <div className="text-center py-24 border-2 border-dashed border-cafe-800 rounded-3xl bg-cafe-900/30">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-cafe-800 mb-6 shadow-inner">
            <ScrollText className="w-10 h-10 text-cafe-600" />
          </div>
          <h3 className="text-2xl font-bold text-cafe-200 mb-3">
            {t('houseRules.noSelection')}
          </h3>
          <p className="text-cafe-500 max-w-md mx-auto">
            {t('houseRules.noSelectionDesc')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-10 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-cafe-100 mb-2 tracking-tight">
          {t('houseRules.title')}
        </h1>
        <p className="text-cafe-400">
          {t('houseRules.subtitle')}{' '}
          <span className="text-brand-light font-medium">{cafe.name}</span>
        </p>
      </div>

      {/* Info Box */}
      <div className="mb-8 p-4 bg-blue-900/20 border border-blue-700/30 rounded-xl">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-200">
            <p className="font-medium mb-1">{t('houseRules.whatIs')}</p>
            <p className="text-blue-300/80">
              {t('houseRules.whatIsDesc')}
            </p>
          </div>
        </div>
      </div>

      {/* System Prompt Editor */}
      <div className="bg-cafe-800 border border-cafe-700 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand/20 rounded-lg">
              <ScrollText className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-cafe-100">
                {t('houseRules.systemPrompt')}
              </h3>
              <p className="text-xs text-cafe-500">
                {t('houseRules.systemPromptDesc')}
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
            {saveStatus === 'error' && (
              <span className="flex items-center gap-1 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                {t('houseRules.failedToSave')}
              </span>
            )}
          </div>
        </div>

        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder={`Example:
# Project Guidelines

## Coding Standards
- Use TypeScript with strict mode
- Follow ESLint rules
- Write unit tests for new features

## Architecture
- Follow clean architecture patterns
- Use dependency injection
- Keep components small and focused

## Context
This is a React application using Next.js...`}
          className="w-full h-[400px] bg-cafe-950 border border-cafe-700 text-cafe-200 p-4 rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent outline-none font-mono text-sm resize-none"
        />

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-cafe-700">
          <div className="text-xs text-cafe-500">
            {systemPrompt.length} {t('houseRules.characters')}
            {hasChanges && (
              <span className="ml-2 text-amber-400">
                ({t('houseRules.unsavedChanges')})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              disabled={!hasChanges || isSaving}
              className="px-4 py-2 text-cafe-400 hover:text-cafe-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              {t('houseRules.reset')}
            </button>
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
              {t('houseRules.save')}
            </button>
          </div>
        </div>
      </div>

      {/* Usage Tips */}
      <div className="mt-6 p-4 bg-cafe-900/50 border border-cafe-700/50 rounded-xl">
        <h4 className="text-sm font-medium text-cafe-300 mb-2">{t('houseRules.tips')}</h4>
        <ul className="text-xs text-cafe-500 space-y-1">
          <li>{t('houseRules.tip1')}</li>
          <li>{t('houseRules.tip2')}</li>
          <li>{t('houseRules.tip3')}</li>
          <li>{t('houseRules.tip4')}</li>
        </ul>
      </div>
    </div>
  );
};
