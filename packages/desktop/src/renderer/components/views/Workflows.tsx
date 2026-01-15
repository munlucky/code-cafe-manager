import * as React from 'react';
import { useEffect, useState, type ReactElement } from 'react';
import { Plus, AlertCircle, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import type { Workflow } from '../../types/models';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { WorkflowEditorDialog } from '../workflow/WorkflowEditorDialog';

function WorkflowCard({
  workflow,
  onEdit,
  onDelete,
}: {
  workflow: Workflow;
  onEdit: (workflow: Workflow) => void;
  onDelete: (workflow: Workflow) => void;
}): ReactElement {
  const [showMenu, setShowMenu] = React.useState(false);

  return (
    <Card className="p-4 hover:border-coffee transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-bone mb-1">{workflow.name}</h3>
          <p className="text-sm text-gray-400">ID: {workflow.id}</p>
        </div>
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="p-1 h-auto"
            onClick={() => setShowMenu(!showMenu)}
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-8 z-50 min-w-[8rem] overflow-hidden rounded-md border border-gray-600 bg-gray-800 p-1 shadow-lg">
                <button
                  className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-gray-700 focus:bg-gray-700"
                  onClick={() => {
                    setShowMenu(false);
                    onEdit(workflow);
                  }}
                >
                  <Edit className="w-3 h-3 mr-2" />
                  Edit
                </button>
                <button
                  className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-gray-700 focus:bg-gray-700 text-red-400"
                  onClick={() => {
                    setShowMenu(false);
                    onDelete(workflow);
                  }}
                >
                  <Trash2 className="w-3 h-3 mr-2" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <p className="mt-2 text-sm text-gray-300">{workflow.description}</p>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-gray-400">Stages:</span>
        <div className="flex flex-wrap gap-1">
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
    </Card>
  );
}

export function Workflows(): ReactElement {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await window.codecafe.workflow.list();
      if (response.success && response.data) {
        setWorkflows(response.data);
      } else {
        setError(response.error?.message || 'Failed to load workflows');
      }
    } catch (err: any) {
      console.error('[Workflows] Failed to load workflows:', err);
      setError(err.message || 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkflows();
  }, []);

  const handleNewWorkflow = () => {
    setEditingWorkflow(null);
    setIsEditorOpen(true);
  };

  const handleEditWorkflow = (workflow: Workflow) => {
    setEditingWorkflow(workflow);
    setIsEditorOpen(true);
  };

  const handleDeleteWorkflow = async (workflow: Workflow) => {
    if (!confirm(`Are you sure you want to delete workflow "${workflow.name}"?`)) {
      return;
    }
    try {
      const response = await window.codecafe.workflow.delete(workflow.id);
      if (response.success) {
        await loadWorkflows();
      } else {
        throw new Error(response.error?.message || 'Failed to delete');
      }
    } catch (err: any) {
      alert(`Error deleting workflow: ${err.message}`);
    }
  };

  const handleSuccess = async () => {
    await loadWorkflows();
  };

  if (loading && workflows.length === 0) {
    return (
      <div className="p-6 h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-coffee border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400">Loading workflows...</p>
        </div>
      </div>
    );
  }

  if (error && workflows.length === 0) {
    return (
      <div className="p-6 h-full flex flex-col items-center justify-center text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-bone mb-2">Failed to load workflows</h3>
        <p className="text-gray-400 mb-6">{error}</p>
        <Button onClick={loadWorkflows} variant="secondary">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="p-6 h-full overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-bone">Workflows</h1>
          <Button onClick={handleNewWorkflow} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Workflow
          </Button>
        </div>

        {workflows.length === 0 ? (
          <EmptyState
            icon={AlertCircle}
            title="No Workflows Found"
            description="Create your first workflow to get started."
            action={
              <Button onClick={handleNewWorkflow} className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                New Workflow
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {workflows.map((workflow) => (
              <WorkflowCard
                key={workflow.id}
                workflow={workflow}
                onEdit={handleEditWorkflow}
                onDelete={handleDeleteWorkflow}
              />
            ))}
          </div>
        )}
      </div>
      <WorkflowEditorDialog
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSuccess={handleSuccess}
        workflow={editingWorkflow}
      />
    </>
  );
}
