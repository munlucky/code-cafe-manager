import { useEffect } from 'react';
import { useRoleStore } from '../../store/useRoleStore';
import { RoleCard } from './RoleCard';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
// import type { Role } from '@codecafe/core/types/role';

// Temporary type for compilation
interface Role {
  id: string;
  name: string;
  systemPrompt: string;
  skills: string[];
  recommendedProvider: string;
  variables: any[];
  isDefault: boolean;
  source: string;
}

export function RoleManager() {
  const { roles, loading, error, loadRoles, selectRole } = useRoleStore();

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const defaultRoles = roles.filter((role) => role.isDefault);
  const userRoles = roles.filter((role) => !role.isDefault);

  const handleRoleClick = (roleId: string) => {
    selectRole(roleId);
    alert(`Selected role: ${roleId}`);
    // TODO: Navigate to role detail or show modal
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading roles...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-destructive mb-2">Error loading roles</p>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={loadRoles}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Role Manager</h1>
          <p className="text-muted-foreground mt-1">
            Manage AI agent roles for different tasks
          </p>
        </div>
        <Button onClick={() => alert('Create Role functionality not implemented yet')}>
          Create Role
        </Button>
      </div>

      {/* Default Roles Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Default Roles</h2>
          <span className="text-sm text-muted-foreground">
            {defaultRoles.length} roles
          </span>
        </div>
        {defaultRoles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {defaultRoles.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                onClick={() => handleRoleClick(role.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No default roles"
            description="Default roles will appear here once loaded"
          />
        )}
      </section>

      {/* User Roles Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">User Roles</h2>
          <span className="text-sm text-muted-foreground">
            {userRoles.length} roles
          </span>
        </div>
        {userRoles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userRoles.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                onClick={() => handleRoleClick(role.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No user roles"
            description="Create custom roles to appear here"
            action={
              <Button onClick={() => alert('Create Role functionality not implemented yet')}>
                Create Role
              </Button>
            }
          />
        )}
      </section>
    </div>
  );
}