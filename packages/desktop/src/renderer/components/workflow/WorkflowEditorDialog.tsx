import { useState, useEffect, type ReactElement } from 'react';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { StageConfigEditor } from './StageConfigEditor';
import type { Workflow, ExtendedWorkflowInfo, ExtendedStageAssignment } from '../../types/models';

interface WorkflowEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (workflow: Workflow | ExtendedWorkflowInfo) => void;
  workflow?: Workflow | ExtendedWorkflowInfo | null;
}

// Default available options
const DEFAULT_PROVIDERS = ['claude-code', 'codex', 'gemini', 'grok'];
const DEFAULT_ROLES = ['planner', 'coder', 'tester', 'checker', 'reviewer'];
const DEFAULT_SKILLS = ['code-review', 'test-integration', 'plan-validate'];

export function WorkflowEditorDialog({
  isOpen,
  onClose,
  onSuccess,
  workflow,
}: WorkflowEditorDialogProps): ReactElement {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [stages, setStages] = useState('');
  const [stageConfigs, setStageConfigs] = useState<Record<string, ExtendedStageAssignment>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!workflow;
  const stageList = stages.split(',').map(s => s.trim()).filter(Boolean);

  useEffect(() => {
    if (isOpen) {
      setId(workflow?.id || '');
      setName(workflow?.name || '');
      setDescription(workflow?.description || '');
      setStages(workflow?.stages?.join(', ') || 'plan, code, test, check');
      setStageConfigs(
        (workflow as ExtendedWorkflowInfo)?.stageConfigs ||
        buildDefaultStageConfigs(workflow?.stages || ['plan', 'code', 'test', 'check'])
      );
      setError(null);
    }
  }, [isOpen, workflow]);

  const buildDefaultStageConfigs = (stageNames: string[]): Record<string, ExtendedStageAssignment> => {
    const configs: Record<string, ExtendedStageAssignment> = {};
    for (const stage of stageNames) {
      configs[stage] = {
        provider: 'claude-code',
        role: stage,
        profile: 'simple',
        mode: 'sequential',
        on_failure: 'stop',
      };
    }
    return configs;
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const workflowData = {
        id,
        name,
        description,
        stages: stageList,
        stageConfigs,
      };

      const response = isEditing
        ? await window.codecafe.workflow.update(workflowData)
        : await window.codecafe.workflow.create(workflowData);

      if (response.success && response.data) {
        onSuccess(response.data);
        onClose();
      } else {
        throw new Error(response.error?.message || 'Failed to save workflow');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Workflow' : 'New Workflow'}
      size="large"
    >
      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="workflow-id" className="block text-sm font-medium text-gray-400 mb-1">
              ID
            </label>
            <Input
              id="workflow-id"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="e.g., my-custom-workflow"
              disabled={isEditing}
            />
          </div>
          <div>
            <label htmlFor="workflow-name" className="block text-sm font-medium text-gray-400 mb-1">
              Name
            </label>
            <Input
              id="workflow-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My Custom Workflow"
            />
          </div>
        </div>

        <div>
          <label htmlFor="workflow-desc" className="block text-sm font-medium text-gray-400 mb-1">
            Description
          </label>
          <Input
            id="workflow-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A brief description of the workflow"
          />
        </div>

        <div>
          <label htmlFor="workflow-stages" className="block text-sm font-medium text-gray-400 mb-1">
            Stages (comma-separated)
          </label>
          <Input
            id="workflow-stages"
            value={stages}
            onChange={(e) => setStages(e.target.value)}
            placeholder="e.g., plan, code, test, check"
          />
        </div>

        {/* Advanced: Stage Configuration */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-bone transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-coffee" />
            {showAdvanced ? 'Hide' : 'Show'} Stage Configuration
          </button>
        </div>

        {showAdvanced && (
          <StageConfigEditor
            stages={stageList}
            stageConfigs={stageConfigs}
            availableProviders={DEFAULT_PROVIDERS}
            availableRoles={DEFAULT_ROLES}
            availableSkills={DEFAULT_SKILLS}
            onChange={setStageConfigs}
          />
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Workflow'}
        </Button>
      </div>
    </Dialog>
  );
}
