import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info,
} from 'lucide-react';
import type { Cafe } from '../../types/design';

/** Duration in ms to display save success status */
const SAVE_STATUS_DISPLAY_MS = 2000;

interface BlueprintsViewProps {
  cafe: Cafe | null;
  onUpdateCafe: (id: string, settings: { systemPrompt?: string }) => Promise<void>;
}

export const BlueprintsView: React.FC<BlueprintsViewProps> = ({
  cafe,
  onUpdateCafe,
}) => {
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
            <FileText className="w-10 h-10 text-cafe-600" />
          </div>
          <h3 className="text-2xl font-bold text-cafe-200 mb-3">
            No Cafe Selected
          </h3>
          <p className="text-cafe-500 max-w-md mx-auto">
            Select a cafe from the sidebar to configure its blueprints.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-10 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-cafe-100 mb-2 tracking-tight">
          Blueprints
        </h1>
        <p className="text-cafe-400">
          Configure system prompts and guidelines for{' '}
          <span className="text-brand-light font-medium">{cafe.name}</span>
        </p>
      </div>

      {/* Info Box */}
      <div className="mb-8 p-4 bg-blue-900/20 border border-blue-700/30 rounded-xl">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-200">
            <p className="font-medium mb-1">What are Blueprints?</p>
            <p className="text-blue-300/80">
              Blueprints define the system prompt that will be applied to all
              orders in this cafe. Use it to set coding standards, project
              context, architectural patterns, and any guidelines the AI should
              follow.
            </p>
          </div>
        </div>
      </div>

      {/* System Prompt Editor */}
      <div className="bg-cafe-800 border border-cafe-700 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand/20 rounded-lg">
              <FileText className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-cafe-100">
                System Prompt
              </h3>
              <p className="text-xs text-cafe-500">
                Instructions applied to all AI interactions
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
            {systemPrompt.length} characters
            {hasChanges && (
              <span className="ml-2 text-amber-400">
                (unsaved changes)
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
              Reset
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
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Usage Tips */}
      <div className="mt-6 p-4 bg-cafe-900/50 border border-cafe-700/50 rounded-xl">
        <h4 className="text-sm font-medium text-cafe-300 mb-2">Tips</h4>
        <ul className="text-xs text-cafe-500 space-y-1">
          <li>
            Use Markdown formatting for better organization
          </li>
          <li>
            Include project-specific context like tech stack and conventions
          </li>
          <li>
            Keep prompts concise but comprehensive - they affect token usage
          </li>
          <li>
            System prompts are applied in English for token efficiency
          </li>
        </ul>
      </div>
    </div>
  );
};
