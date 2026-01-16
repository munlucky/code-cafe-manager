import * as React from 'react';
import { useEffect, useState, type ReactElement } from 'react';
import { Plus, AlertCircle, Edit, Trash2, ChevronRight } from 'lucide-react';
import type { ExtendedWorkflowInfo } from '../../types/models';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { WorkflowEditorDialog } from '../workflow/WorkflowEditorDialog';
import { useViewStore } from '../../store/useViewStore';

interface WorkflowCardProps {
  workflow: ExtendedWorkflowInfo;
  onEdit: (workflow: ExtendedWorkflowInfo, e: React.MouseEvent) => void;
  onDelete: (workflow: ExtendedWorkflowInfo, e: React.MouseEvent) => void;
}

function WorkflowCard({
  workflow,
  onEdit,
  onDelete,
}: WorkflowCardProps): ReactElement {
  const { setView } = useViewStore();

  const handleClick = (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest('button')) {
      setView('workflow-detail', { workflowId: workflow.id });
    }
  };

  return (
    <Card
      className="p-4 hover:border-coffee transition-colors cursor-pointer group"
      onClick={handleClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-bone truncate">{workflow.name}</h3>
            {workflow.stageConfigs && (
              <span className="px-1.5 py-0.5 bg-coffee/20 text-coffee text-xs rounded flex-shrink-0">
                Configured
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 truncate">ID: {workflow.id}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => onEdit(workflow, e)}
            className="p-1.5 h-auto hover:bg-gray-700"
            title="Edit workflow"
          >
            <Edit className="w-4 h-4 text-gray-400 group-hover:text-bone" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => onDelete(workflow, e)}
            className="p-1.5 h-auto hover:bg-red-900/30"
            title="Delete workflow"
          >
            <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-400" />
          </Button>
          <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-bone" />
        </div>
      </div>
      <p className="mt-2 text-sm text-gray-300 line-clamp-2">{workflow.description}</p>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-gray-400">Stages:</span>
        <div className="flex flex-wrap gap-1">
          {workflow.stages.map((stage) => {
            const config = workflow.stageConfigs?.[stage];
            return (
              <span
                key={stage}
                className="px-2 py-0.5 bg-gray-700 text-xs text-gray-200 rounded-full flex items-center gap-1"
                title={config ? `Provider: ${config.provider}, Role: ${config.role}` : undefined}
              >
                {stage}
                {config && <span className="text-coffee">•{config.provider}</span>}
              </span>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

export function Workflows(): ReactElement {
  const [workflows, setWorkflows] = useState<ExtendedWorkflowInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<ExtendedWorkflowInfo | null>(null);

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

  const handleEditWorkflow = (workflow: ExtendedWorkflowInfo, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingWorkflow(workflow);
    setIsEditorOpen(true);
  };

  const handleDeleteWorkflow = async (workflow: ExtendedWorkflowInfo, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
