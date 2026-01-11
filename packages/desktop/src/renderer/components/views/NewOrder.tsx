import { useState, useEffect, useMemo } from 'react';
import { useOrders } from '../../hooks/useOrders';
import { useRecipes } from '../../hooks/useRecipes';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { ProviderType } from '../../types/models';
import type {
  ProviderInfo,
  ProviderAssignmentInfo,
  WorkflowInfo,
} from '../../types/window';

interface NewOrderProps {
  onSuccess?: () => void;
}

export function NewOrder({ onSuccess }: NewOrderProps) {
  const { createOrder } = useOrders();
  const { recipes, fetchRecipes } = useRecipes();
  const [orderType, setOrderType] = useState<'recipe' | 'workflow'>('recipe');
  const [selectedRecipeProvider, setSelectedRecipeProvider] =
    useState<ProviderType>('claude-code');
  const [isProviderLoading, setIsProviderLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workflows, setWorkflows] = useState<WorkflowInfo[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');
  const [availableProviders, setAvailableProviders] = useState<ProviderInfo[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [assignmentsByStage, setAssignmentsByStage] = useState<
    Record<string, ProviderAssignmentInfo>
  >({});
  const [profilesByStage, setProfilesByStage] = useState<Record<string, string[]>>({});
  const [isWorkflowLoading, setIsWorkflowLoading] = useState(false);

  const [formData, setFormData] = useState({
    recipeName: '',
    counter: '.',
    issue: '',
    extraVars: '',
  });

  useEffect(() => {
    fetchRecipes();
  }, []);

  useEffect(() => {
    if (recipes.length === 0) return;
    setFormData((prev) => {
      if (prev.recipeName) return prev;
      const defaultRecipe =
        recipes.find(
          (name) =>
            name === 'pm-agent' || name === 'pm-agent.yaml' || name === 'pm-agent.yml'
        ) || recipes[0];
      return { ...prev, recipeName: defaultRecipe };
    });
  }, [recipes]);

  useEffect(() => {
    const recipeName = formData.recipeName;
    if (!recipeName) {
      setSelectedRecipeProvider('claude-code');
      return;
    }

    let active = true;
    setIsProviderLoading(true);
    window.codecafe
      .getRecipe(recipeName)
      .then((result) => {
        if (!active) return;
        if (result.success && result.data?.defaults?.provider) {
          setSelectedRecipeProvider(result.data.defaults.provider);
        } else {
          setSelectedRecipeProvider('claude-code');
        }
      })
      .catch((error) => {
        if (active) {
          console.error('Failed to load recipe provider:', error);
          setSelectedRecipeProvider('claude-code');
        }
      })
      .finally(() => {
        if (active) {
          setIsProviderLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [formData.recipeName]);

  const selectedWorkflow = useMemo(
    () => workflows.find((workflow) => workflow.id === selectedWorkflowId) || null,
    [workflows, selectedWorkflowId]
  );

  const workflowStages = useMemo(() => {
    if (selectedWorkflow?.stages?.length) {
      return selectedWorkflow.stages;
    }
    return ['plan', 'code', 'test', 'check'];
  }, [selectedWorkflow]);

  useEffect(() => {
    if (orderType !== 'workflow') {
      return;
    }

    let active = true;
    const loadWorkflowData = async () => {
      setIsWorkflowLoading(true);
      try {
        const [workflowList, providerList, roles, assignments] = await Promise.all([
          window.codecafe.listWorkflows(),
          window.codecafe.getAvailableProviders(),
          window.codecafe.listRoles(),
          window.codecafe.getAssignments(),
        ]);

        if (!active) {
          return;
        }

        setWorkflows(workflowList);
        setAvailableProviders(providerList);
        setAvailableRoles(roles);
        setAssignmentsByStage(
          assignments.reduce<Record<string, ProviderAssignmentInfo>>((acc, item) => {
            acc[item.stage] = item;
            return acc;
          }, {})
        );
      } catch (error) {
        if (active) {
          console.error('Failed to load workflow configuration:', error);
        }
      } finally {
        if (active) {
          setIsWorkflowLoading(false);
        }
      }
    };

    loadWorkflowData();
    return () => {
      active = false;
    };
  }, [orderType]);

  useEffect(() => {
    if (orderType !== 'workflow') {
      return;
    }

    if (!selectedWorkflowId && workflows.length > 0) {
      setSelectedWorkflowId(workflows[0].id);
    }
  }, [orderType, workflows, selectedWorkflowId]);

  useEffect(() => {
    if (orderType !== 'workflow') {
      return;
    }

    let active = true;
    const loadProfiles = async () => {
      try {
        const entries = await Promise.all(
          workflowStages.map(async (stage) => {
            const profiles = await window.codecafe.listProfiles(stage);
            return [stage, profiles] as const;
          })
        );

        if (!active) {
          return;
        }

        const nextProfiles: Record<string, string[]> = {};
        entries.forEach(([stage, profiles]) => {
          nextProfiles[stage] = profiles;
        });
        setProfilesByStage(nextProfiles);
      } catch (error) {
        if (active) {
          console.error('Failed to load stage profiles:', error);
          setProfilesByStage({});
        }
      }
    };

    loadProfiles();
    return () => {
      active = false;
    };
  }, [orderType, workflowStages.join('|')]);

  const resolveAssignment = (stage: string): ProviderAssignmentInfo => {
    const fallbackProvider =
      availableProviders[0]?.id || ('claude-code' as ProviderType);
    const fallbackRole = availableRoles[0] || stage;
    const fallbackProfile = 'simple';
    const current = assignmentsByStage[stage];

    return {
      stage,
      provider: current?.provider || fallbackProvider,
      role: current?.role || fallbackRole,
      profile: current?.profile || fallbackProfile,
    };
  };

  const providerOptions = useMemo<ProviderInfo[]>(() => {
    if (availableProviders.length > 0) {
      return availableProviders;
    }
    return [
      { id: 'claude-code', name: 'Claude Code' },
      { id: 'codex', name: 'Codex' },
      { id: 'gemini', name: 'Gemini' },
    ] as ProviderInfo[];
  }, [availableProviders]);

  const updateAssignment = async (
    stage: string,
    updates: Partial<Pick<ProviderAssignmentInfo, 'provider' | 'role'>>
  ) => {
    const next = { ...resolveAssignment(stage), ...updates };
    setAssignmentsByStage((prev) => ({ ...prev, [stage]: next }));

    try {
      await window.codecafe.setAssignment(stage, next.provider, next.role);
    } catch (error) {
      console.error('Failed to update assignment:', error);
    }
  };

  const updateProfile = async (stage: string, profile: string) => {
    const next = { ...resolveAssignment(stage), profile };
    setAssignmentsByStage((prev) => ({ ...prev, [stage]: next }));

    try {
      await window.codecafe.setProfile(stage, profile);
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  const handleWorkflowRun = async () => {
    if (!selectedWorkflowId) {
      alert('Select a workflow to run.');
      return;
    }

    setIsSubmitting(true);
    try {
      const runId = await window.codecafe.runWorkflow(selectedWorkflowId, {
        mode: 'auto',
        interactive: false,
      });
      alert(`Workflow started. Run ID: ${runId}`);
      onSuccess?.();
    } catch (error) {
      alert(`Failed to run workflow: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let provider = selectedRecipeProvider;
      if (!provider && formData.recipeName) {
        try {
          const result = await window.codecafe.getRecipe(formData.recipeName);
          if (result.success && result.data?.defaults?.provider) {
            provider = result.data.defaults.provider;
          }
        } catch (error) {
          console.error('Failed to resolve recipe provider:', error);
        }
      }

      let extraVars: Record<string, any> = {};
      if (formData.extraVars.trim()) {
        try {
          extraVars = JSON.parse(formData.extraVars);
        } catch (error) {
          alert('Invalid JSON in extra variables');
          setIsSubmitting(false);
          return;
        }
      }

      const vars: Record<string, any> = {
        issue: formData.issue,
        ...extraVars,
      };

      await createOrder({
        recipeId: formData.recipeName,
        recipeName: formData.recipeName,
        counter: formData.counter,
        provider: provider || 'claude-code',
        vars,
      });

      alert('Order created successfully!');

      // Reset form
      setFormData({
        recipeName: formData.recipeName,
        counter: '.',
        issue: '',
        extraVars: '',
      });

      onSuccess?.();
    } catch (error) {
      alert(`Failed to create order: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h3 className="text-xl font-bold text-coffee">Create New Order</h3>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={orderType === 'recipe' ? 'primary' : 'secondary'}
            onClick={() => setOrderType('recipe')}
          >
            Recipe
          </Button>
          <Button
            type="button"
            variant={orderType === 'workflow' ? 'primary' : 'secondary'}
            onClick={() => setOrderType('workflow')}
          >
            Workflow
          </Button>
        </div>
      </div>

      {orderType === 'recipe' ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-coffee mb-2">Menu</label>
            {recipes.length > 0 ? (
              <select
                value={formData.recipeName}
                onChange={(e) =>
                  setFormData({ ...formData, recipeName: e.target.value })
                }
                className="w-full px-3 py-2 bg-background border border-border rounded text-bone"
                required
              >
                {recipes.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                type="text"
                placeholder="pm-agent"
                value={formData.recipeName}
                onChange={(e) =>
                  setFormData({ ...formData, recipeName: e.target.value })
                }
                required
              />
            )}
            <div className="text-xs text-gray-500 mt-2">Default menu: pm-agent</div>
          </div>

          <div>
            <label className="block text-coffee mb-2">
              Counter (Working Directory)
            </label>
            <Input
              type="text"
              value={formData.counter}
              onChange={(e) =>
                setFormData({ ...formData, counter: e.target.value })
              }
              required
            />
          </div>

          <div>
            <label className="block text-coffee mb-2">Issue</label>
            <textarea
              className="w-full px-3 py-2 bg-background border border-border rounded text-bone text-sm focus:outline-none focus:ring-2 focus:ring-coffee/50"
              rows={6}
              placeholder="Describe the issue or task"
              value={formData.issue}
              onChange={(e) => setFormData({ ...formData, issue: e.target.value })}
              required
            />
          </div>

          <div className="text-xs text-gray-500">
            Barista: {selectedRecipeProvider}
            {isProviderLoading && ' (loading...)'}
          </div>
          <div className="text-xs text-gray-500">Workspace: git worktree</div>

          <div>
            <label className="block text-coffee mb-2">Extra Vars (JSON)</label>
            <textarea
              className="w-full px-3 py-2 bg-background border border-border rounded text-bone font-mono text-sm focus:outline-none focus:ring-2 focus:ring-coffee/50"
              rows={4}
              placeholder='{"key": "value"}'
              value={formData.extraVars}
              onChange={(e) =>
                setFormData({ ...formData, extraVars: e.target.value })
              }
            />
            <div className="text-xs text-gray-500 mt-2">
              Optional variables merged with issue input.
            </div>
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Order'}
          </Button>
        </form>
      ) : (
        <div className="space-y-5">
          <div>
            <label className="block text-coffee mb-2">Workflow</label>
            {workflows.length > 0 ? (
              <select
                value={selectedWorkflowId}
                onChange={(e) => setSelectedWorkflowId(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded text-bone"
              >
                {workflows.map((workflow) => (
                  <option key={workflow.id} value={workflow.id}>
                    {workflow.name}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                type="text"
                placeholder="default"
                value={selectedWorkflowId}
                onChange={(e) => setSelectedWorkflowId(e.target.value)}
              />
            )}
            <div className="text-xs text-gray-500 mt-2">
              {isWorkflowLoading ? 'Loading workflows...' : 'From .orch/workflows'}
            </div>
          </div>

          <div>
            <label className="block text-coffee mb-2">Stage Profiles & Assignments</label>
            <div className="space-y-3">
              {workflowStages.map((stage) => {
                const assignment = resolveAssignment(stage);
                const profiles = profilesByStage[stage] || [];
                const baseProfiles =
                  profiles.length > 0 ? profiles : ['simple', 'committee', 'review-loop'];
                const profileOptions =
                  assignment.profile && !baseProfiles.includes(assignment.profile)
                    ? [assignment.profile, ...baseProfiles]
                    : baseProfiles;
                const roles = availableRoles.includes(assignment.role)
                  ? availableRoles
                  : [assignment.role, ...availableRoles];
                const providers = providerOptions.some((item) => item.id === assignment.provider)
                  ? providerOptions
                  : [
                      { id: assignment.provider, name: assignment.provider },
                      ...providerOptions,
                    ];

                return (
                  <div
                    key={stage}
                    className="rounded border border-border p-3 bg-background"
                  >
                    <div className="text-xs uppercase tracking-wide text-gray-500 mb-3">
                      {stage}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          Provider
                        </label>
                        <select
                          value={assignment.provider}
                          onChange={(e) =>
                            updateAssignment(stage, { provider: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-background border border-border rounded text-bone"
                        >
                          {providers.map((provider) => (
                            <option key={provider.id} value={provider.id}>
                              {provider.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Role</label>
                        {availableRoles.length > 0 ? (
                          <select
                            value={assignment.role}
                            onChange={(e) =>
                              updateAssignment(stage, { role: e.target.value })
                            }
                            className="w-full px-3 py-2 bg-background border border-border rounded text-bone"
                          >
                            {roles.map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            type="text"
                            value={assignment.role}
                            onChange={(e) =>
                              updateAssignment(stage, { role: e.target.value })
                            }
                            placeholder="role id"
                          />
                        )}
                      </div>

                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          Profile
                        </label>
                        <select
                          value={assignment.profile}
                          onChange={(e) => updateProfile(stage, e.target.value)}
                          className="w-full px-3 py-2 bg-background border border-border rounded text-bone"
                        >
                          {profileOptions.map((profile) => (
                            <option key={profile} value={profile}>
                              {profile}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-xs text-gray-500">
            Runs use the `.orch` folder in the current workspace.
          </div>

          <Button
            type="button"
            disabled={isSubmitting || isWorkflowLoading}
            onClick={handleWorkflowRun}
          >
            {isSubmitting ? 'Starting...' : 'Run Workflow'}
          </Button>
        </div>
      )}
    </Card>
  );
}
