import { useState, useEffect, type ReactElement } from 'react';
import { Play, AlertCircle, Terminal } from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
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
      // 기존 vars가 있으면 복원
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
      size="large"
    >
      <div className="space-y-4">
        {/* Order Info */}
        <div className="p-3 bg-gray-800 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Terminal className="w-4 h-4 text-coffee" />
            <span className="font-medium text-bone">{order.workflowName}</span>
          </div>
          <div className="text-xs text-gray-400 space-y-1">
            <div>Order ID: <span className="font-mono text-gray-300">{order.id}</span></div>
            <div>Provider: <span className="text-gray-300">{order.provider}</span></div>
            {order.worktreeInfo && (
              <div>Branch: <span className="font-mono text-coffee">{order.worktreeInfo.branch}</span></div>
            )}
          </div>
        </div>

        {/* Task Prompt */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Task Description <span className="text-red-400">*</span>
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want the AI to do...&#10;&#10;Examples:&#10;• Implement user authentication with JWT&#10;• Fix the bug in the login page&#10;• Add unit tests for the User model"
            className="w-full h-32 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-bone placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-coffee resize-none"
          />
        </div>

        {/* Input Variables */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Variables (optional, key=value format)
          </label>
          <div className="flex gap-2">
            <Input
              value={varInput}
              onChange={(e) => setVarInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addVar()}
              placeholder="e.g., feature_name=authentication"
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

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm p-2 bg-red-400/10 rounded">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !prompt.trim()}
          className="flex items-center gap-2"
        >
          <Play className="w-4 h-4" />
          {isSubmitting ? 'Starting...' : 'Execute'}
        </Button>
      </div>
    </Dialog>
  );
}
