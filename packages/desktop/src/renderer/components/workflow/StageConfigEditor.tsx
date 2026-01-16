import { useState, useEffect, type ReactElement } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import type {
  ExtendedStageAssignment,
  StageExecutionMode,
  FailureStrategy,
  ProviderConfigItem,
} from '../../types/window';

interface StageConfigEditorProps {
  stages: string[];
  stageConfigs: Record<string, ExtendedStageAssignment>;
  availableProviders: string[];
  availableRoles: string[];
  availableSkills: string[];
  onChange: (stageConfigs: Record<string, ExtendedStageAssignment>) => void;
}

export function StageConfigEditor({
  stages,
  stageConfigs,
  availableProviders,
  availableRoles,
  availableSkills,
  onChange,
}: StageConfigEditorProps): ReactElement {
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());

  const toggleExpanded = (stage: string) => {
    const newExpanded = new Set(expandedStages);
    if (newExpanded.has(stage)) {
      newExpanded.delete(stage);
    } else {
      newExpanded.add(stage);
    }
    setExpandedStages(newExpanded);
  };

  const updateStageConfig = (stage: string, updates: Partial<ExtendedStageAssignment>) => {
    const current = stageConfigs[stage] || {
      provider: 'claude-code',
      role: stage,
      profile: 'simple',
    };
    onChange({
      ...stageConfigs,
      [stage]: { ...current, ...updates },
    });
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-400">
        Stage Configuration
      </label>
      <div className="space-y-2">
        {stages.map((stage) => {
          const config = stageConfigs[stage] || {
            provider: 'claude-code',
            role: stage,
            profile: 'simple',
          };
          const isExpanded = expandedStages.has(stage);

          return (
            <div key={stage} className="border border-gray-600 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => toggleExpanded(stage)}
                className="w-full px-3 py-2 bg-gray-800 flex items-center justify-between hover:bg-gray-700 transition-colors"
              >
                <span className="font-medium text-bone capitalize">{stage}</span>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {isExpanded && (
                <div className="p-3 space-y-3 bg-gray-900">
                  {/* Provider */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        Provider
                      </label>
                      <select
                        value={config.provider || ''}
                        onChange={(e) => updateStageConfig(stage, { provider: e.target.value })}
                        className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm text-bone focus:outline-none focus:ring-1 focus:ring-coffee"
                      >
                        {availableProviders.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    {/* Role */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        Role (Agent)
                      </label>
                      <select
                        value={config.role || ''}
                        onChange={(e) => updateStageConfig(stage, { role: e.target.value })}
                        className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm text-bone focus:outline-none focus:ring-1 focus:ring-coffee"
                      >
                        {availableRoles.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Profile */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Profile
                    </label>
                    <input
                      type="text"
                      value={config.profile || 'simple'}
                      onChange={(e) => updateStageConfig(stage, { profile: e.target.value })}
                      placeholder="simple"
                      className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm text-bone focus:outline-none focus:ring-1 focus:ring-coffee"
                    />
                  </div>

                  {/* Execution Mode & Failure Strategy */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        Execution Mode
                      </label>
                      <select
                        value={config.mode || 'sequential'}
                        onChange={(e) => {
                          const newMode = e.target.value as StageExecutionMode;
                          const updates: Partial<ExtendedStageAssignment> = { mode: newMode };
                          // Reset providers when switching to sequential, initialize when switching to parallel
                          if (newMode === 'sequential') {
                            updates.providers = undefined;
                            updates.parallel_strategy = undefined;
                          } else if (newMode === 'parallel' && !config.providers?.length) {
                            updates.providers = [{ provider: 'claude-code', role: stage, weight: 1 }];
                            updates.parallel_strategy = 'all';
                          }
                          updateStageConfig(stage, updates);
                        }}
                        className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm text-bone focus:outline-none focus:ring-1 focus:ring-coffee"
                      >
                        <option value="sequential">Sequential</option>
                        <option value="parallel">Parallel</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        On Failure
                      </label>
                      <select
                        value={config.on_failure || 'stop'}
                        onChange={(e) => updateStageConfig(stage, { on_failure: e.target.value as FailureStrategy })}
                        className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm text-bone focus:outline-none focus:ring-1 focus:ring-coffee"
                      >
                        <option value="stop">Stop</option>
                        <option value="continue">Continue</option>
                        <option value="retry">Retry</option>
                      </select>
                    </div>
                  </div>

                  {/* Parallel Providers Configuration */}
                  {config.mode === 'parallel' && (
                    <div className="space-y-3 p-3 bg-gray-800 rounded-lg">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs text-gray-400">
                          Parallel Providers
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const currentProviders = config.providers || [];
                            updateStageConfig(stage, {
                              providers: [
                                ...currentProviders,
                                { provider: 'claude-code', role: stage, weight: 1 },
                              ],
                            });
                          }}
                          className="flex items-center gap-1 px-2 py-1 bg-coffee hover:bg-coffee/80 text-white text-xs rounded transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          Add Provider
                        </button>
                      </div>

                      {/* Parallel Strategy */}
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">
                          Parallel Strategy
                        </label>
                        <select
                          value={config.parallel_strategy || 'all'}
                          onChange={(e) => updateStageConfig(stage, {
                            parallel_strategy: e.target.value as 'all' | 'race' | 'majority'
                          })}
                          className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm text-bone focus:outline-none focus:ring-1 focus:ring-coffee"
                        >
                          <option value="all">All (run all providers)</option>
                          <option value="race">Race (first to finish wins)</option>
                          <option value="majority">Majority (consensus wins)</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          {config.parallel_strategy === 'all' && 'Execute all providers and merge results'}
                          {config.parallel_strategy === 'race' && 'Use the first result available'}
                          {config.parallel_strategy === 'majority' && 'Use majority voting for decisions'}
                        </p>
                      </div>

                      {/* Providers List */}
                      {(config.providers || []).length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-2">
                          No providers added. Click "Add Provider" to add one.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {(config.providers || []).map((providerItem, idx) => (
                            <div key={idx} className="p-2 bg-gray-700 rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-gray-400">Provider #{idx + 1}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newProviders = [...(config.providers || [])];
                                    newProviders.splice(idx, 1);
                                    updateStageConfig(stage, { providers: newProviders });
                                  }}
                                  className="p-1 text-gray-400 hover:text-red-400 hover:bg-gray-600 rounded transition-colors"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>

                              <div className="grid grid-cols-3 gap-2">
                                {/* Provider Select */}
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">
                                    Provider
                                  </label>
                                  <select
                                    value={providerItem.provider}
                                    onChange={(e) => {
                                      const newProviders = [...(config.providers || [])];
                                      newProviders[idx] = { ...providerItem, provider: e.target.value };
                                      updateStageConfig(stage, { providers: newProviders });
                                    }}
                                    className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-bone focus:outline-none focus:ring-1 focus:ring-coffee"
                                  >
                                    {availableProviders.map((p) => (
                                      <option key={p} value={p}>{p}</option>
                                    ))}
                                  </select>
                                </div>

                                {/* Role Select */}
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">
                                    Role
                                  </label>
                                  <select
                                    value={providerItem.role || stage}
                                    onChange={(e) => {
                                      const newProviders = [...(config.providers || [])];
                                      newProviders[idx] = { ...providerItem, role: e.target.value };
                                      updateStageConfig(stage, { providers: newProviders });
                                    }}
                                    className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-bone focus:outline-none focus:ring-1 focus:ring-coffee"
                                  >
                                    {availableRoles.map((r) => (
                                      <option key={r} value={r}>{r}</option>
                                    ))}
                                  </select>
                                </div>

                                {/* Weight Input */}
                                <div>
                                  <label className="block text-xs text-gray-500 mb-1">
                                    Weight
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    value={providerItem.weight ?? 1}
                                    onChange={(e) => {
                                      const newProviders = [...(config.providers || [])];
                                      newProviders[idx] = {
                                        ...providerItem,
                                        weight: parseFloat(e.target.value) || 0
                                      };
                                      updateStageConfig(stage, { providers: newProviders });
                                    }}
                                    className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-bone focus:outline-none focus:ring-1 focus:ring-coffee"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Retries (when on_failure is retry) */}
                  {config.on_failure === 'retry' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">
                          Max Retries
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={config.retries || 3}
                          onChange={(e) => updateStageConfig(stage, { retries: parseInt(e.target.value) || 0 })}
                          className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm text-bone focus:outline-none focus:ring-1 focus:ring-coffee"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">
                          Backoff (sec)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={config.retry_backoff || 1}
                          onChange={(e) => updateStageConfig(stage, { retry_backoff: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm text-bone focus:outline-none focus:ring-1 focus:ring-coffee"
                        />
                      </div>
                    </div>
                  )}

                  {/* Min Iterations (only for review/check stages) */}
                  {(stage === 'review' || stage === 'check') && (
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        Min Iterations
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={config.min_iterations || ''}
                        onChange={(e) => updateStageConfig(stage, { min_iterations: e.target.value ? parseInt(e.target.value) : undefined })}
                        placeholder="0 = no minimum"
                        className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm text-bone focus:outline-none focus:ring-1 focus:ring-coffee"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        최소 N번 실행 후 종료 가능 (완료 시에도 지정된 횟수만큼 반복)
                      </p>
                    </div>
                  )}

                  {/* Skills */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Skills (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={config.skills?.join(', ') || ''}
                      onChange={(e) => updateStageConfig(stage, {
                        skills: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                      })}
                      placeholder="e.g., code-review, test-integration"
                      className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm text-bone focus:outline-none focus:ring-1 focus:ring-coffee"
                    />
                  </div>

                  {/* Custom Prompt */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Custom Prompt (optional)
                    </label>
                    <textarea
                      value={config.prompt || ''}
                      onChange={(e) => updateStageConfig(stage, { prompt: e.target.value })}
                      placeholder="Override the default prompt for this stage..."
                      rows={2}
                      className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm text-bone focus:outline-none focus:ring-1 focus:ring-coffee resize-none"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
