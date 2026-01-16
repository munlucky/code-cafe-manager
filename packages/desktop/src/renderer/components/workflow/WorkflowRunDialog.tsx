import { useState, useEffect, type ReactElement } from 'react';
import { Play, AlertCircle } from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { ExtendedWorkflowInfo, WorkflowRunOptions, FailureStrategy } from '../../types/models';

interface WorkflowRunDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (runId: string) => void;
  workflow: ExtendedWorkflowInfo | null;
}

export function WorkflowRunDialog({
  isOpen,
  onClose,
  onSuccess,
  workflow,
}: WorkflowRunDialogProps): ReactElement | null {
  const [vars, setVars] = useState<Record<string, string>>({});
  const [varInput, setVarInput] = useState('');
  const [mode, setMode] = useState<'auto' | 'assisted' | 'headless'>('auto');
  const [interactive, setInteractive] = useState(false);
  const [onFailure, setOnFailure] = useState<FailureStrategy | undefined>(undefined);
  const [maxIters, setMaxIters] = useState<number | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setVars({});
      setVarInput('');
      setMode('auto');
      setInteractive(false);
      setOnFailure(undefined);
      setMaxIters(undefined);
      setError(null);
    }
  }, [isOpen]);

  const addVar = () => {
    const parts = varInput.split('=');
    if (parts.length === 2) {
      const key = parts[0].trim();
      const value = parts[1].trim();
      if (key) {
        setVars({ ...vars, [key]: value });
        setVarInput('');
      }
    }
  };

  const removeVar = (key: string) => {
    const newVars = { ...vars };
    delete newVars[key];
    setVars(newVars);
  };

  const handleSubmit = async () => {
    if (!workflow) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const options: WorkflowRunOptions = {
        vars: Object.keys(vars).length > 0 ? vars : undefined,
        mode,
        interactive,
        on_failure: onFailure,
        max_iters: maxIters,
      };

      const response = await window.codecafe.workflow.run(workflow.id, options);

      if (response.success && response.data?.runId) {
        onSuccess(response.data.runId);
        onClose();
      } else {
        throw new Error(response.error?.message || 'Failed to start workflow');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!workflow) return null as ReactElement | null;

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={`Run ${workflow.name}`}>
      <div className="space-y-4">
        {/* Workflow Info */}
        <div className="p-3 bg-gray-800 rounded-lg">
          <p className="text-sm text-gray-300">{workflow.description || 'No description'}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {workflow.stages.map((stage) => (
              <span
                key={stage}
                className="px-2 py-0.5 bg-gray-700 text-xs text-gray-200 rounded-full"
              >
                {stage}
              </span>
            ))}
          </div>
        </div>

        {/* Input Variables */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Input Variables (key=value format)
          </label>
          <div className="flex gap-2">
            <Input
              value={varInput}
              onChange={(e) => setVarInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addVar()}
              placeholder="e.g., feature_name=add-login"
              className="flex-1"
            />
            <Button onClick={addVar} variant="secondary" size="sm">
              Add
            </Button>
          </div>
          {Object.keys(vars).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(vars).map(([key, value]) => (
                <span
                  key={key}
                  className="px-2 py-1 bg-gray-700 text-xs text-gray-200 rounded-full flex items-center gap-1"
                >
                  <span className="text-coffee">{key}</span>: {value}
                  <button
                    type="button"
                    onClick={() => removeVar(key)}
                    className="ml-1 text-gray-400 hover:text-red-400"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Execution Mode */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Execution Mode
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['auto', 'assisted', 'headless'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-3 py-2 rounded-lg text-sm capitalize transition-colors ${
                  mode === m
                    ? 'bg-coffee text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Interactive Mode */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="interactive"
            checked={interactive}
            onChange={(e) => setInteractive(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-coffee focus:ring-coffee"
          />
          <label htmlFor="interactive" className="text-sm text-gray-300">
            Interactive mode (with TUI)
          </label>
        </div>

        {/* Advanced Options */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Failure Override (optional)
          </label>
          <select
            value={onFailure || ''}
            onChange={(e) => setOnFailure((e.target.value || undefined) as FailureStrategy | undefined)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm text-bone focus:outline-none focus:ring-1 focus:ring-coffee"
          >
            <option value="">Use workflow default</option>
            <option value="stop">Stop on failure</option>
            <option value="continue">Continue on failure</option>
            <option value="retry">Retry on failure</option>
          </select>
        </div>

        {/* Max Iterations */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Max Iterations (optional)
          </label>
          <Input
            type="number"
            min="1"
            max="100"
            value={maxIters || ''}
            onChange={(e) => setMaxIters(e.target.value ? parseInt(e.target.value) : undefined)}
            placeholder="Use workflow default"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting} className="flex items-center gap-2">
          <Play className="w-4 h-4" />
          {isSubmitting ? 'Starting...' : 'Start Workflow'}
        </Button>
      </div>
    </Dialog>
  );
}
