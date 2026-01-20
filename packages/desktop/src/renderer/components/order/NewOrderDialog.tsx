/**
 * New Order Dialog
 * 오더 생성 모달 (워크트리 자동 생성 옵션 포함)
 */

import { useState, useEffect, type ReactElement } from 'react';
import { X } from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { cn } from '../../utils/cn';
import type { WorkflowInfo } from '../../types/window';

interface NewOrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cafeId: string;
  onSuccess: (orderId: string) => void;
}

export function NewOrderDialog({
  isOpen,
  onClose,
  cafeId,
  onSuccess,
}: NewOrderDialogProps): ReactElement | null {
  const [workflowId, setWorkflowId] = useState('');
  const [workflowName, setWorkflowName] = useState('');
  const [createWorktree, setCreateWorktree] = useState(true);
  const [loading, setLoading] = useState(false);
  const [workflows, setWorkflows] = useState<WorkflowInfo[]>([]);

  // 워크플로우 목록 로드
  useEffect(() => {
    if (isOpen) {
      loadWorkflows();
    }
  }, [isOpen]);

  const loadWorkflows = async () => {
    try {
      const result = await window.codecafe.workflow.list();
      setWorkflows(result.data || []);
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
      // Provider는 workflow의 stageConfigs에서 결정됨
      const result = await window.codecafe.order.createWithWorktree({
        cafeId,
        workflowId,
        workflowName: workflowName || workflowId,
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
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Order"
      size="small"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Workflow Selection */}
        <div>
          <label className="block text-sm font-medium text-cafe-300 mb-1">
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
              'w-full px-3 py-2 bg-cafe-950 border border-cafe-700 rounded-lg text-cafe-200',
              'focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-transparent'
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
            <p className="mt-1 text-xs text-cafe-400">
              {workflows.find((w) => w.id === workflowId)?.description}
            </p>
          )}
        </div>

        {/* Worktree Option */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="createWorktree"
            checked={createWorktree}
            onChange={(e) => setCreateWorktree(e.target.checked)}
            className="w-4 h-4 rounded border-cafe-700 bg-cafe-950 text-brand focus:ring-brand focus:ring-offset-0"
          />
          <label htmlFor="createWorktree" className="text-sm text-cafe-300">
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
    </Dialog>
  );
}
