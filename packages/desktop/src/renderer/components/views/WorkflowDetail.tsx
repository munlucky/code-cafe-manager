import { useState, useEffect, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  Save,
  X,
  Copy,
  CheckCircle2,
  Edit2,
  Check,
  ChevronDown,
} from 'lucide-react';
import { useViewStore } from '../../store/useViewStore';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { ExtendedWorkflowInfo, ExtendedStageAssignment, Skill } from '../../types/models';
import type { StageExecutionMode, FailureStrategy } from '../../types/window';

interface WorkflowDetailProps {
  workflowId: string;
}

// Default available options
const DEFAULT_PROVIDERS = ['claude-code', 'codex', 'gemini', 'grok'];
const DEFAULT_ROLES = ['planner', 'coder', 'tester', 'checker', 'reviewer'];

export function WorkflowDetail({ workflowId }: WorkflowDetailProps): ReactElement {
  const { setView } = useViewStore();
  const [workflow, setWorkflow] = useState<ExtendedWorkflowInfo | null>(null);
  const [editingStages, setEditingStages] = useState<Record<string, ExtendedStageAssignment>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showSaveAsDialog, setShowSaveAsDialog] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newWorkflowId, setNewWorkflowId] = useState('');
  const [editingWorkflowName, setEditingWorkflowName] = useState(false);
  const [editingWorkflowDesc, setEditingWorkflowDesc] = useState(false);
  const [tempName, setTempName] = useState('');
  const [tempDesc, setTempDesc] = useState('');
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [skillDropdownOpen, setSkillDropdownOpen] = useState<string | null>(null);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);

  const loadWorkflow = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await window.codecafe.workflow.get(workflowId);
      if (response.success && response.data) {
        setWorkflow(response.data);
        setEditingStages({});
        setEditingWorkflowName(false);
        setEditingWorkflowDesc(false);
      } else {
        setError(response.error?.message || 'Failed to load workflow');
      }
    } catch (err: any) {
      console.error('[WorkflowDetail] Failed to load workflow:', err);
      setError(err.message || 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const loadSkills = async () => {
    try {
      const response = await window.codecafe.skill.list();
      if (response.success && response.data) {
        setAvailableSkills(response.data);
      }
    } catch (err) {
      console.error('[WorkflowDetail] Failed to load skills:', err);
    }
  };

  useEffect(() => {
    loadWorkflow();
    loadSkills();
  }, [workflowId]);

  const hasChanges = (): boolean => {
    if (!workflow) return false;
    // Check if workflow info changed
    if (editingWorkflowName && tempName !== workflow.name) return true;
    if (editingWorkflowDesc && tempDesc !== (workflow.description || '')) return true;

    // Check if any stage is being edited
    if (Object.keys(editingStages).length > 0) return true;

    return false;
  };

  const handleBack = () => {
    if (hasChanges()) {
      if (confirm('You have unsaved changes. Are you sure you want to go back?')) {
        setView('workflows');
      }
    } else {
      setView('workflows');
    }
  };

  const showSuccessMessage = (text: string) => {
    setSaveMessage({ type: 'success', text });
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const showErrorMessage = (text: string) => {
    setSaveMessage({ type: 'error', text });
    setTimeout(() => setSaveMessage(null), 5000);
  };

  const handleSave = async () => {
    if (!workflow) return;

    setSaving(true);
    setError(null);

    try {
      const updatedWorkflow: ExtendedWorkflowInfo = {
        ...workflow,
        stageConfigs: {
          ...workflow.stageConfigs,
          ...editingStages,
        },
      };

      if (editingWorkflowName) {
        updatedWorkflow.name = tempName;
      }
      if (editingWorkflowDesc) {
        updatedWorkflow.description = tempDesc;
      }

      const response = await window.codecafe.workflow.update(updatedWorkflow);
      if (response.success && response.data) {
        setWorkflow(response.data);
        setEditingStages({});
        setEditingWorkflowName(false);
        setEditingWorkflowDesc(false);
        showSuccessMessage('Recipe saved successfully');
      } else {
        throw new Error(response.error?.message || 'Failed to save recipe');
      }
    } catch (err: any) {
      showErrorMessage(err.message || 'Failed to save recipe');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAs = async () => {
    if (!workflow || !newWorkflowName || !newWorkflowId) return;

    setSaving(true);
    setError(null);
    try {
      const newWorkflow = {
        ...workflow,
        id: newWorkflowId,
        name: newWorkflowName,
        stageConfigs: {
          ...workflow.stageConfigs,
          ...editingStages,
        },
      };
      const response = await window.codecafe.workflow.create(newWorkflow);
      if (response.success && response.data) {
        showSuccessMessage(`Saved as "${newWorkflowName}"`);
        setShowSaveAsDialog(false);
        setTimeout(() => {
          setView('workflow-detail', { workflowId: newWorkflowId });
        }, 500);
      } else {
        throw new Error(response.error?.message || 'Failed to save as new recipe');
      }
    } catch (err: any) {
      showErrorMessage(err.message || 'Failed to save as new recipe');
    } finally {
      setSaving(false);
    }
  };

  const openSaveAsDialog = () => {
    if (!workflow) return;
    setNewWorkflowName(`${workflow.name} (Copy)`);
    setNewWorkflowId(`${workflow.id}-copy`);
    setShowSaveAsDialog(true);
  };

  const handleCancel = () => {
    setEditingStages({});
    setEditingWorkflowName(false);
    setEditingWorkflowDesc(false);
    setSaveMessage(null);
  };

  const startEditingStage = (stage: string) => {
    if (!workflow) return;
    const config = workflow.stageConfigs?.[stage] || {
      provider: 'claude-code',
      role: stage,
      profile: 'simple',
    };
    setEditingStages({ ...editingStages, [stage]: { ...config } });
  };

  const cancelEditingStage = (stage: string) => {
    const newEditingStages = { ...editingStages };
    delete newEditingStages[stage];
    setEditingStages(newEditingStages);
  };

  const saveEditingStage = async (stage: string) => {
    if (!workflow) return;

    setSaving(true);
    setError(null);

    try {
      const updatedWorkflow: ExtendedWorkflowInfo = {
        ...workflow,
        stageConfigs: {
          ...workflow.stageConfigs,
          [stage]: editingStages[stage],
        },
      };

      const response = await window.codecafe.workflow.update(updatedWorkflow);
      if (response.success && response.data) {
        setWorkflow(response.data);
        const newEditingStages = { ...editingStages };
        delete newEditingStages[stage];
        setEditingStages(newEditingStages);
        showSuccessMessage(`Step "${stage}" saved successfully`);
      } else {
        throw new Error(response.error?.message || 'Failed to save step');
      }
    } catch (err: any) {
      showErrorMessage(err.message || 'Failed to save step');
    } finally {
      setSaving(false);
    }
  };

  const updateStageConfig = (stage: string, updates: Partial<ExtendedStageAssignment>) => {
    setEditingStages({
      ...editingStages,
      [stage]: { ...editingStages[stage], ...updates },
    });
  };

  const addStage = () => {
    if (!workflow) return;
    const newStageName = prompt('Enter new step name:');
    if (!newStageName || !newStageName.trim()) return;

    const stageName = newStageName.trim().toLowerCase().replace(/\s+/g, '-');
    if (workflow.stages.includes(stageName)) {
      alert(`Step "${stageName}" already exists`);
      return;
    }

    const updatedWorkflow: ExtendedWorkflowInfo = {
      ...workflow,
      stages: [...workflow.stages, stageName],
      stageConfigs: {
        ...workflow.stageConfigs,
        [stageName]: {
          provider: 'claude-code',
          role: stageName,
          profile: 'simple',
        },
      },
    };

    setSaving(true);
    window.codecafe.workflow.update(updatedWorkflow).then(response => {
      if (response.success && response.data) {
        setWorkflow(response.data);
        showSuccessMessage(`Step "${stageName}" added`);
      } else {
        showErrorMessage(response.error?.message || 'Failed to add step');
      }
      setSaving(false);
    }).catch(err => {
      showErrorMessage(err.message || 'Failed to add step');
      setSaving(false);
    });
  };

  const removeStage = (stage: string) => {
    if (!workflow) return;
    if (!confirm(`Are you sure you want to remove step "${stage}"?`)) return;

    const updatedWorkflow: ExtendedWorkflowInfo = {
      ...workflow,
      stages: workflow.stages.filter(s => s !== stage),
      stageConfigs: Object.fromEntries(
        Object.entries(workflow.stageConfigs || {}).filter(([s]) => s !== stage)
      ),
    };

    setSaving(true);
    window.codecafe.workflow.update(updatedWorkflow).then(response => {
      if (response.success && response.data) {
        setWorkflow(response.data);
        const newEditingStages = { ...editingStages };
        delete newEditingStages[stage];
        setEditingStages(newEditingStages);
        showSuccessMessage(`Step "${stage}" removed`);
      } else {
        showErrorMessage(response.error?.message || 'Failed to remove step');
      }
      setSaving(false);
    }).catch(err => {
      showErrorMessage(err.message || 'Failed to remove step');
      setSaving(false);
    });
  };

  const startEditingName = () => {
    if (!workflow) return;
    setTempName(workflow.name);
    setEditingWorkflowName(true);
  };

  const saveName = async () => {
    if (!workflow) return;

    setSaving(true);
    setError(null);

    try {
      const response = await window.codecafe.workflow.update({
        ...workflow,
        name: tempName,
      });
      if (response.success && response.data) {
        setWorkflow(response.data);
        setEditingWorkflowName(false);
        showSuccessMessage('Name saved successfully');
      } else {
        throw new Error(response.error?.message || 'Failed to save name');
      }
    } catch (err: any) {
      showErrorMessage(err.message || 'Failed to save name');
    } finally {
      setSaving(false);
    }
  };

  const startEditingDesc = () => {
    if (!workflow) return;
    setTempDesc(workflow.description || '');
    setEditingWorkflowDesc(true);
  };

  const saveDesc = async () => {
    if (!workflow) return;

    setSaving(true);
    setError(null);

    try {
      const response = await window.codecafe.workflow.update({
        ...workflow,
        description: tempDesc,
      });
      if (response.success && response.data) {
        setWorkflow(response.data);
        setEditingWorkflowDesc(false);
        showSuccessMessage('Description saved successfully');
      } else {
        throw new Error(response.error?.message || 'Failed to save description');
      }
    } catch (err: any) {
      showErrorMessage(err.message || 'Failed to save description');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 text-coffee animate-spin" />
          <p className="text-gray-400">Loading recipe...</p>
        </div>
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="p-6 h-full flex flex-col items-center justify-center text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-bone mb-2">Failed to load recipe</h3>
        <p className="text-gray-400 mb-6">{error || 'Recipe not found'}</p>
        <Button onClick={handleBack} variant="secondary">
          Go Back
        </Button>
      </div>
    );
  }

  const isAnyEditing = editingWorkflowName || editingWorkflowDesc || Object.keys(editingStages).length > 0;
  const isProtected = workflow?.id === 'moon'; // moonshot-lite is the default recipe

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-8 py-6 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="p-1 h-auto"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            {/* Workflow Name */}
            {editingWorkflowName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="text-2xl font-bold text-bone bg-card border-border flex-1"
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={saveName}
                  disabled={saving}
                  className="p-1 h-auto text-green-400"
                >
                  <Check className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingWorkflowName(false)}
                  disabled={saving}
                  className="p-1 h-auto text-red-400"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-bone">{workflow.name}</h1>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={startEditingName}
                  className="p-1 h-auto text-gray-400 hover:text-coffee"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <span className="px-2 py-0.5 bg-gray-700 text-xs text-gray-300 rounded">
                  {workflow.id}
                </span>
              </div>
            )}

            {/* Workflow Description */}
            {editingWorkflowDesc ? (
              <div className="flex items-center gap-2 mt-2">
                <Input
                  value={tempDesc}
                  onChange={(e) => setTempDesc(e.target.value)}
                  placeholder="Add a description..."
                  className="text-sm text-gray-400 bg-card border-border flex-1"
                  autoFocus
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={saveDesc}
                  disabled={saving}
                  className="p-1 h-auto text-green-400"
                >
                  <Check className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingWorkflowDesc(false)}
                  disabled={saving}
                  className="p-1 h-auto text-red-400"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <p className="text-gray-400">{workflow.description || 'No description'}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={startEditingDesc}
                  className="p-1 h-auto text-gray-400 hover:text-coffee"
                >
                  <Edit2 className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {saveMessage && (
              <div className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm ${
                saveMessage.type === 'success'
                  ? 'bg-green-600/20 text-green-400'
                  : 'bg-red-600/20 text-red-400'
              }`}>
                {saveMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                {saveMessage.text}
              </div>
            )}
            {isAnyEditing && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  disabled={saving}
                  className="flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Cancel All
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1"
                >
                  <Save className="w-4 h-4" />
                  Save All
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={openSaveAsDialog}
              disabled={saving}
              className="flex items-center gap-1"
            >
              <Copy className="w-4 h-4" />
              Save As
            </Button>
          </div>
        </div>
      </div>

      {/* Kanban-style Step Board */}
      <div className="flex-1 overflow-auto px-8 pb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-bone">Steps</h2>
          {!isProtected && (
            <Button
              variant="ghost"
              size="sm"
              onClick={addStage}
              disabled={saving}
              className="flex items-center gap-1 text-coffee hover:text-coffee/80"
            >
              <Plus className="w-4 h-4" />
              Add Step
            </Button>
          )}
        </div>

        {/* Kanban Board - Horizontal scrollable columns */}
        <div className="flex gap-4 overflow-x-auto pb-4">
          {workflow.stages.map((stage, index) => {
            const config = workflow.stageConfigs?.[stage];
            const isEditing = editingStages[stage] !== undefined;
            const editingConfig = editingStages[stage];

            return (
              <div
                key={stage}
                className={`flex-shrink-0 w-80 rounded-lg border transition-colors ${
                  isEditing
                    ? 'bg-card border-coffee'
                    : 'bg-card border-border'
                }`}
              >
                {/* Stage Header */}
                <div className={`p-4 border-b rounded-t-lg ${
                  isEditing ? 'border-coffee/50' : 'border-border'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold ${
                        isEditing ? 'bg-coffee text-white' : 'bg-gray-700 text-gray-300'
                      }`}>
                        {index + 1}
                      </span>
                      <h3 className="font-semibold text-bone capitalize">{stage}</h3>
                    </div>
                    <div className="flex items-center gap-1">
                      {isEditing ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => saveEditingStage(stage)}
                            disabled={saving}
                            className="p-1 h-auto text-green-400"
                            title="Save"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => cancelEditingStage(stage)}
                            disabled={saving}
                            className="p-1 h-auto text-red-400"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        !isProtected && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEditingStage(stage)}
                              className="p-1 h-auto text-gray-400 hover:text-coffee"
                              title="Edit step"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeStage(stage)}
                              disabled={saving}
                              className="p-1 h-auto text-gray-400 hover:text-red-400"
                              title="Remove step"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* Stage Details - Always Visible */}
                <div className="p-4 space-y-3">
                  {isEditing ? (
                    <>
                      {/* Edit Mode */}
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Barista</label>
                        <select
                          value={editingConfig?.provider || 'claude-code'}
                          onChange={(e) => updateStageConfig(stage, { provider: e.target.value })}
                          className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-bone focus:outline-none focus:ring-1 focus:ring-coffee"
                        >
                          {DEFAULT_PROVIDERS.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Role</label>
                        <select
                          value={editingConfig?.role || stage}
                          onChange={(e) => updateStageConfig(stage, { role: e.target.value })}
                          className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-bone focus:outline-none focus:ring-1 focus:ring-coffee"
                        >
                          {DEFAULT_ROLES.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Mode</label>
                        <select
                          value={editingConfig?.mode || 'sequential'}
                          onChange={(e) => updateStageConfig(stage, {
                            mode: e.target.value as StageExecutionMode,
                            providers: e.target.value === 'sequential' ? undefined : editingConfig?.providers,
                          })}
                          className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-bone focus:outline-none focus:ring-1 focus:ring-coffee"
                        >
                          <option value="sequential">Sequential</option>
                          <option value="parallel">Parallel</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">On Failure</label>
                        <select
                          value={editingConfig?.on_failure || 'stop'}
                          onChange={(e) => updateStageConfig(stage, { on_failure: e.target.value as FailureStrategy })}
                          className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-bone focus:outline-none focus:ring-1 focus:ring-coffee"
                        >
                          <option value="stop">Stop</option>
                          <option value="continue">Continue</option>
                          <option value="retry">Retry</option>
                        </select>
                      </div>

                      {editingConfig?.on_failure === 'retry' && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Max Retries</label>
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={editingConfig?.retries || 3}
                              onChange={(e) => updateStageConfig(stage, { retries: parseInt(e.target.value) || 0 })}
                              className="w-full px-2 py-1.5 bg-background border border-border rounded text-sm text-bone focus:outline-none focus:ring-1 focus:ring-coffee"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Backoff (s)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={editingConfig?.retry_backoff || 1}
                              onChange={(e) => updateStageConfig(stage, { retry_backoff: parseFloat(e.target.value) || 0 })}
                              className="w-full px-2 py-1.5 bg-background border border-border rounded text-sm text-bone focus:outline-none focus:ring-1 focus:ring-coffee"
                            />
                          </div>
                        </div>
                      )}

                      {(stage === 'review' || stage === 'check') && (
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1.5">Min Iterations</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={editingConfig?.min_iterations || ''}
                            onChange={(e) => updateStageConfig(stage, {
                              min_iterations: e.target.value ? parseInt(e.target.value) : undefined
                            })}
                            placeholder="0 = no minimum"
                            className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-bone focus:outline-none focus:ring-1 focus:ring-coffee"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Skills</label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              if (skillDropdownOpen === stage) {
                                setSkillDropdownOpen(null);
                              } else {
                                setDropdownRect(e.currentTarget.getBoundingClientRect());
                                setSkillDropdownOpen(stage);
                              }
                            }}
                            className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-bone focus:outline-none focus:ring-1 focus:ring-coffee flex items-center justify-between"
                          >
                            <span className="truncate">
                              {editingConfig?.skills?.length
                                ? `${editingConfig.skills.length} skill(s) selected`
                                : 'Select skills...'}
                            </span>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${
                              skillDropdownOpen === stage ? 'rotate-180' : ''
                            }`} />
                          </button>
                          {skillDropdownOpen === stage && dropdownRect && createPortal(
                            <>
                              <div 
                                className="fixed inset-0 z-[9998]" 
                                onClick={() => setSkillDropdownOpen(null)} 
                              />
                              <div 
                                className="fixed z-[9999] bg-card border border-border rounded shadow-xl max-h-60 overflow-y-auto custom-scrollbar"
                                style={{
                                  top: dropdownRect.bottom + 4,
                                  left: dropdownRect.left,
                                  width: dropdownRect.width,
                                }}
                              >
                                {availableSkills.length === 0 ? (
                                  <div className="px-3 py-2 text-sm text-gray-500">No skills available</div>
                                ) : (
                                  availableSkills.map((skill) => {
                                    const isSelected = editingConfig?.skills?.includes(skill.id);
                                    return (
                                      <button
                                        key={skill.id}
                                        type="button"
                                        onClick={() => {
                                          const currentSkills = editingConfig?.skills || [];
                                          const newSkills = isSelected
                                            ? currentSkills.filter((s) => s !== skill.id)
                                            : [...currentSkills, skill.id];
                                          updateStageConfig(stage, { skills: newSkills });
                                        }}
                                        className="w-full px-3 py-2 text-left text-sm hover:bg-white/5 flex items-start gap-2 border-b border-white/5 last:border-0"
                                      >
                                        <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                                          isSelected
                                            ? 'bg-coffee border-coffee text-white'
                                            : 'border-gray-600'
                                        }`}>
                                          {isSelected && <Check className="w-3 h-3" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="font-medium text-bone truncate">{skill.name}</span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                                              skill.category === 'analysis' ? 'bg-blue-900/20 text-blue-300 border-blue-900/50' :
                                              skill.category === 'planning' ? 'bg-purple-900/20 text-purple-300 border-purple-900/50' :
                                              skill.category === 'implementation' ? 'bg-green-900/20 text-green-300 border-green-900/50' :
                                              skill.category === 'verification' ? 'bg-yellow-900/20 text-yellow-300 border-yellow-900/50' :
                                              'bg-gray-800 text-gray-400 border-gray-700'
                                            }`}>
                                              {skill.category}
                                            </span>
                                          </div>
                                          <p className="text-xs text-gray-500 truncate">{skill.id}</p>
                                        </div>
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            </>,
                            document.body
                          )}
                        </div>

                        {/* Selected skills tags */}
                        {editingConfig?.skills && editingConfig.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {editingConfig.skills.map((skillId) => {
                              const skill = availableSkills.find((s) => s.id === skillId);
                              return (
                                <span
                                  key={skillId}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded"
                                >
                                  {skill?.name || skillId}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newSkills = editingConfig.skills!.filter((s) => s !== skillId);
                                      updateStageConfig(stage, { skills: newSkills });
                                    }}
                                    className="text-gray-400 hover:text-red-400"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Custom Prompt</label>
                        <textarea
                          value={editingConfig?.prompt || ''}
                          onChange={(e) => updateStageConfig(stage, { prompt: e.target.value })}
                          placeholder="Override default prompt..."
                          rows={3}
                          className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-bone focus:outline-none focus:ring-1 focus:ring-coffee resize-none"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {/* View Mode - Display all info */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <span className="text-xs text-gray-500 uppercase tracking-wide">Barista</span>
                          <span className="text-coffee font-medium">{config?.provider || 'claude-code'}</span>
                        </div>
                        <div className="flex justify-between items-start">
                          <span className="text-xs text-gray-500 uppercase tracking-wide">Role</span>
                          <span className="text-gray-200">{config?.role || stage}</span>
                        </div>
                        <div className="flex justify-between items-start">
                          <span className="text-xs text-gray-500 uppercase tracking-wide">Mode</span>
                          <span className="text-gray-200 capitalize">{config?.mode || 'sequential'}</span>
                        </div>
                        <div className="flex justify-between items-start">
                          <span className="text-xs text-gray-500 uppercase tracking-wide">On Failure</span>
                          <span className="text-gray-200 capitalize">{config?.on_failure || 'stop'}</span>
                        </div>
                        {config?.on_failure === 'retry' && (
                          <div className="flex justify-between items-start">
                            <span className="text-xs text-gray-500 uppercase tracking-wide">Retry</span>
                            <span className="text-gray-200 text-sm">
                              Max: {config?.retries || 3} | Backoff: {config?.retry_backoff || 1}s
                            </span>
                          </div>
                        )}
                        {(stage === 'review' || stage === 'check') && config?.min_iterations !== undefined && (
                          <div className="flex justify-between items-start">
                            <span className="text-xs text-gray-500 uppercase tracking-wide">Min Iterations</span>
                            <span className="text-gray-200">{config.min_iterations}</span>
                          </div>
                        )}
                        {config?.skills && config.skills.length > 0 && (
                          <div>
                            <span className="text-xs text-gray-500 uppercase tracking-wide">Skills</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {config.skills.map((skill) => (
                                <span
                                  key={skill}
                                  className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {config?.prompt && (
                          <div>
                            <span className="text-xs text-gray-500 uppercase tracking-wide">Custom Prompt</span>
                            <p className="text-gray-400 text-sm mt-1 whitespace-pre-wrap">{config.prompt}</p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save As Dialog */}
      {showSaveAsDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg p-6 w-full max-w-md border border-gray-700">
            <h3 className="text-lg font-semibold text-bone mb-4">Save as New Recipe</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Recipe ID</label>
                <Input
                  value={newWorkflowId}
                  onChange={(e) => setNewWorkflowId(e.target.value)}
                  placeholder="e.g., my-custom-recipe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Recipe Name</label>
                <Input
                  value={newWorkflowName}
                  onChange={(e) => setNewWorkflowName(e.target.value)}
                  placeholder="e.g., My Custom Recipe"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="ghost"
                onClick={() => setShowSaveAsDialog(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveAs}
                disabled={saving || !newWorkflowId || !newWorkflowName}
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
