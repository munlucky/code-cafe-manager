import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRoleStore } from '../../store/useRoleStore';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import type { Role, RoleVariable } from '@codecafe/core/types/role';

interface OrderStage {
  id: string;
  stageName: string;
  roleId: string;
  baristaCount: number;
  variables: Record<string, any>;
}

interface StageConfigCardProps {
  stage: OrderStage;
  index: number;
  roles: Role[];
  canRemove: boolean;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<OrderStage>) => void;
}

function StageConfigCard({
  stage,
  index,
  roles,
  canRemove,
  onRemove,
  onUpdate,
}: StageConfigCardProps) {
  const selectedRole = useMemo(
    () => roles.find((r) => r.id === stage.roleId),
    [roles, stage.roleId]
  );

  const handleUpdate = useCallback(
    (updates: Partial<OrderStage>) => {
      onUpdate(stage.id, updates);
    },
    [onUpdate, stage.id]
  );

  const handleVariableChange = useCallback(
    (name: string, value: any) => {
      handleUpdate({
        variables: {
          ...stage.variables,
          [name]: value,
        },
      });
    },
    [handleUpdate, stage.variables]
  );

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Stage {index + 1}</Badge>
          <h3 className="font-medium text-foreground">
            {stage.stageName || `Stage ${index + 1}`}
          </h3>
        </div>
        {canRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(stage.id)}
            className="text-destructive hover:text-destructive"
          >
            Remove
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Stage Name */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Stage Name
          </label>
          <Input
            value={stage.stageName}
            onChange={(e) => handleUpdate({ stageName: e.target.value })}
            placeholder="e.g., plan, code, test"
          />
        </div>

        {/* Role Selection */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Role
          </label>
          <select
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
            value={stage.roleId}
            onChange={(e) => handleUpdate({ roleId: e.target.value })}
          >
            <option value="">Select a role</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name} ({role.id})
              </option>
            ))}
          </select>
        </div>

        {/* Barista Count */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Barista Count (1-10)
          </label>
          <Input
            type="number"
            min="1"
            max="10"
            value={stage.baristaCount}
            onChange={(e) =>
              handleUpdate({
                baristaCount: parseInt(e.target.value, 10) || 1,
              })
            }
          />
        </div>
      </div>

      {/* Role Variables */}
      {selectedRole && selectedRole.variables.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <h4 className="text-sm font-medium text-foreground mb-2">
            Role Variables
          </h4>
          <div className="space-y-2">
            {selectedRole.variables.map((variable: RoleVariable) => (
              <div key={variable.name} className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-1/3">
                  {variable.name} ({variable.type})
                </span>
                <Input
                  placeholder={variable.default?.toString() || 'Enter value'}
                  className="flex-1"
                  value={stage.variables[variable.name] || ''}
                  onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

interface OrderSummaryCardProps {
  stages: OrderStage[];
}

function OrderSummaryCard({ stages }: OrderSummaryCardProps) {
  const totalBaristas = useMemo(
    () => stages.reduce((sum, stage) => sum + stage.baristaCount, 0),
    [stages]
  );

  const rolesUsed = useMemo(
    () => stages.filter((s) => s.roleId).length,
    [stages]
  );

  return (
    <Card className="p-4">
      <h3 className="font-medium text-foreground mb-3">Order Summary</h3>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total Stages:</span>
          <span className="font-medium">{stages.length}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total Baristas:</span>
          <span className="font-medium">{totalBaristas}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Roles Used:</span>
          <span className="font-medium">
            {rolesUsed} of {stages.length}
          </span>
        </div>
      </div>
    </Card>
  );
}

export function OrderCreationKiosk() {
  const { roles, loading: rolesLoading, loadRoles } = useRoleStore();
  const [stages, setStages] = useState<OrderStage[]>([
    {
      id: 'stage-1',
      stageName: 'plan',
      roleId: '',
      baristaCount: 1,
      variables: {},
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const addStage = useCallback(() => {
    setStages((prev) => [
      ...prev,
      {
        id: `stage-${prev.length + 1}`,
        stageName: `stage-${prev.length + 1}`,
        roleId: '',
        baristaCount: 1,
        variables: {},
      },
    ]);
  }, []);

  const removeStage = useCallback((id: string) => {
    setStages((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((stage) => stage.id !== id);
    });
  }, []);

  const updateStage = useCallback((id: string, updates: Partial<OrderStage>) => {
    setStages((prev) =>
      prev.map((stage) =>
        stage.id === id ? { ...stage, ...updates } : stage
      )
    );
  }, []);

  const handleReset = useCallback(() => {
    setStages([
      {
        id: 'stage-1',
        stageName: 'plan',
        roleId: '',
        baristaCount: 1,
        variables: {},
      },
    ]);
  }, []);

  const handleCreateOrder = async () => {
    setIsSubmitting(true);
    try {
      // TODO: Implement actual order creation with IPC
      console.log('Creating order with stages:', stages);
      alert('Order creation functionality not implemented yet');
    } catch (error) {
      console.error('Failed to create order:', error);
      alert('Failed to create order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = useMemo(
    () => stages.length > 0 && stages.every((s) => s.roleId && s.stageName),
    [stages]
  );

  if (rolesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading roles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Create New Order</h1>
        <p className="text-muted-foreground mt-1">
          Configure multi-stage workflows with role assignments
        </p>
      </div>

      {/* Stages List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Stages</h2>
          <Button onClick={addStage} variant="outline" size="sm">
            Add Stage
          </Button>
        </div>

        {stages.map((stage, index) => (
          <StageConfigCard
            key={stage.id}
            stage={stage}
            index={index}
            roles={roles}
            canRemove={stages.length > 1}
            onRemove={removeStage}
            onUpdate={updateStage}
          />
        ))}
      </div>

      {/* Order Summary */}
      <OrderSummaryCard stages={stages} />

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={handleReset} disabled={isSubmitting}>
          Reset
        </Button>
        <Button
          onClick={handleCreateOrder}
          disabled={isSubmitting || !isValid}
        >
          {isSubmitting ? 'Creating...' : 'Create Order'}
        </Button>
      </div>
    </div>
  );
}
