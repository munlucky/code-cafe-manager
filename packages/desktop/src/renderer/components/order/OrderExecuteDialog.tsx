import { useState, useEffect, type ReactElement } from 'react';
import { Play, AlertCircle, Terminal, X as XIcon } from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { Textarea } from '../ui/Textarea';
import { Input } from '../ui/Input';
import type { Order } from '../../types/models';

interface OrderExecuteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute: (orderId: string, prompt: string, vars: Record<string, string>) => Promise<void>;
  order: Order | null;
}

export function OrderExecuteDialog({
  isOpen,
  onClose,
  onExecute,
  order,
}: OrderExecuteDialogProps): ReactElement | null {
  const [prompt, setPrompt] = useState('');
  const [vars, setVars] = useState<Record<string, string>>({});
  const [varInput, setVarInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && order) {
      // Restore existing vars
      setVars(order.vars || {});
      setPrompt('');
      setVarInput('');
      setError(null);
    }
  }, [isOpen, order]);

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
    if (!order) return;

    if (!prompt.trim()) {
      setError('Please enter a task description');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onExecute(order.id, prompt, vars);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to execute order');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!order) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Execute Order"
      icon={<Play className="w-5 h-5 text-brand" />}
      description={
        <span className="text-cafe-500 text-sm">
          Start workflow execution for <span className="text-cafe-300 font-mono font-medium">{order.workflowName}</span>
        </span>
      }
      size="medium"
    >
      {/* Order Info */}
      <div className="p-4 bg-cafe-950 rounded-xl border border-cafe-800">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-brand/20 rounded-lg">
            <Terminal className="w-4 h-4 text-brand" />
          </div>
          <span className="font-bold text-cafe-100">{order.workflowName}</span>
        </div>
        <div className="text-xs text-cafe-500 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-cafe-600">Order ID:</span>
            <span className="font-mono text-cafe-300">{order.id.substring(0, 12)}...</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-cafe-600">Provider:</span>
            <span className="text-cafe-300">{order.provider}</span>
          </div>
          {order.worktreeInfo && (
            <div className="flex items-center gap-2">
              <span className="text-cafe-600">Branch:</span>
              <span className="font-mono text-brand-light">{order.worktreeInfo.branch}</span>
            </div>
          )}
        </div>
      </div>

      {/* Task Prompt */}
      <div>
        <label className="block text-xs font-bold text-cafe-500 uppercase mb-2.5 tracking-wider">
          Task Description <span className="text-red-400">*</span>
        </label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what you want the AI to do...&#10;&#10;Examples:&#10;• Implement user authentication with JWT&#10;• Fix the bug in the login page&#10;• Add unit tests for the User model"
          className="h-32 font-mono text-sm px-4 py-3 rounded-xl"
        />
      </div>

      {/* Input Variables */}
      <div>
        <label className="block text-xs font-bold text-cafe-500 uppercase mb-2 tracking-wider">
          Variables (optional, key=value format)
        </label>
        <div className="flex gap-2">
          <Input
            type="text"
            value={varInput}
            onChange={(e) => setVarInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addVar()}
            placeholder="e.g., feature_name=authentication"
            className="flex-1"
          />
          <button
            onClick={addVar}
            className="px-4 py-2.5 bg-cafe-800 hover:bg-cafe-700 text-cafe-200 rounded-xl text-sm font-medium transition-colors border border-cafe-700"
          >
            Add
          </button>
        </div>
        {Object.keys(vars).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(vars).map(([key, value]) => (
              <span
                key={key}
                className="px-3 py-1.5 bg-brand/10 border border-brand/30 text-xs text-brand-light rounded-full flex items-center gap-1.5"
              >
                <span className="font-semibold">{key}</span>: {value}
                <button
                  type="button"
                  onClick={() => removeVar(key)}
                  className="ml-1 text-brand/60 hover:text-brand-light"
                >
                  <XIcon className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm p-3 bg-red-900/20 border border-red-500/30 rounded-xl">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Footer Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="px-5 py-2.5 text-cafe-400 hover:text-cafe-200 font-medium transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !prompt.trim()}
          className="px-6 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-brand/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Play className="w-4 h-4" />
          {isSubmitting ? 'Starting...' : 'Execute'}
        </button>
      </div>
    </Dialog>
  );
}
