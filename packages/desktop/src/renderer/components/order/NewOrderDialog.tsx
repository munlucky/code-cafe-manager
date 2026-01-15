/**
 * New Order Dialog
 * 오더 생성 모달 (워크트리 자동 생성 옵션 포함)
 */

import { useState, useEffect, type ReactElement } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { cn } from '../../utils/cn';

interface NewOrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cafeId: string;
  onSuccess: (orderId: string) => void;
}

interface Workflow {
  id: string;
  name: string;
  description?: string;
}

export function NewOrderDialog({
  isOpen,
  onClose,
  cafeId,
  onSuccess,
}: NewOrderDialogProps): ReactElement | null {
  const [workflowId, setWorkflowId] = useState('');
  const [workflowName, setWorkflowName] = useState('');
  const [provider, setProvider] = useState('claude-code');
  const [createWorktree, setCreateWorktree] = useState(true);
  const [loading, setLoading] = useState(false);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);

  // 워크플로우 목록 로드
  useEffect(() => {
    if (isOpen) {
      loadWorkflows();
    }
  }, [isOpen]);

  const loadWorkflows = async () => {
    try {
      // TODO: 실제 워크플로우 목록 API 호출
      // const result = await window.codecafe.workflow.list();
      // setWorkflows(result.data || []);

      // 임시 데이터
      setWorkflows([
        { id: 'feature-workflow', name: 'Feature Development', description: 'Develop a new feature' },
        { id: 'bugfix-workflow', name: 'Bug Fix', description: 'Fix a bug' },
        { id: 'refactor-workflow', name: 'Refactoring', description: 'Refactor code' },
      ]);
    } catch (error) {
      console.error('[NewOrderDialog] Failed to load workflows:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!workflowId) {
      alert('Please select a workflow');
      return;
    }

    setLoading(true);
    try {
      const result = await window.codecafe.order.createWithWorktree({
        cafeId,
        workflowId,
        workflowName: workflowName || workflowId,
        provider,
        createWorktree,
        worktreeOptions: {
          branchPrefix: 'order',
        },
      });

      if (result.success && result.data) {
        console.log('[NewOrderDialog] Order created:', result.data);
        onSuccess(result.data.order.id);
        onClose();
      } else {
        alert(`Failed to create order: ${result.error?.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('[NewOrderDialog] Failed to create order:', error);
      alert(`Failed to create order: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-card border border-border rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-bone">Create New Order</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-bone transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Workflow Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Workflow
            </label>
            <select
              value={workflowId}
              onChange={(e) => {
                setWorkflowId(e.target.value);
                const selected = workflows.find((w) => w.id === e.target.value);
                if (selected) {
                  setWorkflowName(selected.name);
                }
              }}
              className={cn(
                'w-full px-3 py-2 bg-background border border-border rounded text-bone',
                'focus:outline-none focus:ring-2 focus:ring-coffee/50'
              )}
              required
            >
              <option value="">Select a workflow...</option>
              {workflows.map((workflow) => (
                <option key={workflow.id} value={workflow.id}>
                  {workflow.name}
                </option>
              ))}
            </select>
            {workflowId && workflows.find((w) => w.id === workflowId)?.description && (
              <p className="mt-1 text-xs text-gray-400">
                {workflows.find((w) => w.id === workflowId)?.description}
              </p>
            )}
          </div>

          {/* Provider */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Provider
            </label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className={cn(
                'w-full px-3 py-2 bg-background border border-border rounded text-bone',
                'focus:outline-none focus:ring-2 focus:ring-coffee/50'
              )}
            >
              <option value="claude-code">Claude Code</option>
              <option value="codex">Codex</option>
              <option value="gemini">Gemini</option>
            </select>
          </div>

          {/* Worktree Option */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="createWorktree"
              checked={createWorktree}
              onChange={(e) => setCreateWorktree(e.target.checked)}
              className="w-4 h-4 rounded border-border bg-background text-coffee focus:ring-coffee focus:ring-offset-0"
            />
            <label htmlFor="createWorktree" className="text-sm text-gray-300">
              Auto-create worktree
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Creating...' : 'Create Order'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
