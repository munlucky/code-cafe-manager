import { useState, useEffect, useMemo } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type {
  ProviderInfo,
  ProviderAssignmentInfo,
  WorkflowInfo,
} from '../../types/window';

interface NewOrderProps {
  onSuccess?: () => void;
}

export function NewOrder({ onSuccess }: NewOrderProps) {
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
    let active = true;
    const loadWorkflowData = async () => {
      setIsWorkflowLoading(true);
      try {
        const [workflowList, providerList, roles, assignments] = await Promise.all([
          window.codecafe.workflow.list(),
          window.codecafe.getAvailableProviders(),
          window.codecafe.config.roles.list(),
          window.codecafe.config.assignments.get(),
        ]);

        if (!active) {
          return;
        }

        setWorkflows(workflowList.data || []);
        setAvailableProviders(providerList.data || []);
        setAvailableRoles(roles.data || []);
        setAssignmentsByStage(
          (assignments.data || []).reduce<Record<string, ProviderAssignmentInfo>>((acc: Record<string, ProviderAssignmentInfo>, item: ProviderAssignmentInfo) => {
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
  }, []);

  useEffect(() => {
    if (!selectedWorkflowId && workflows.length > 0) {
      setSelectedWorkflowId(workflows[0].id);
    }
  }, [workflows, selectedWorkflowId]);

  useEffect(() => {
    let active = true;
    const loadProfiles = async () => {
      try {
        const entries = await Promise.all(
          workflowStages.map(async (stage) => {
            const response = await window.codecafe.config.profiles.list(stage);
            return [stage, response.data || []] as const;
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
  }, [workflowStages.join('|')]);

  const resolveAssignment = (stage: string): ProviderAssignmentInfo => {
    const fallbackProvider = availableProviders[0]?.id || 'claude-code';
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
      await window.codecafe.config.assignments.set(stage, next.provider, next.role);
    } catch (error) {
      console.error('Failed to update assignment:', error);
    }
  };

  const updateProfile = async (stage: string, profile: string) => {
    const next = { ...resolveAssignment(stage), profile };
    setAssignmentsByStage((prev) => ({ ...prev, [stage]: next }));

    try {
      await window.codecafe.config.profiles.set(stage, profile);
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
      const response = await window.codecafe.workflow.run(selectedWorkflowId, {
        mode: 'auto',
        interactive: false,
      });
      if (response.success && response.data) {
        alert(`Workflow started. Run ID: ${response.data}`);
        onSuccess?.();
      } else {
        throw new Error(response.error?.message || 'Failed to start workflow');
      }
    } catch (error) {
      alert(`Failed to run workflow: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-3xl">
      <h3 className="text-xl font-bold text-coffee mb-6">Run Workflow</h3>

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
    </Card>
  );
}
