import { useEffect, type ReactElement, type ReactNode } from 'react';
import { useRoleStore } from '../../store/useRoleStore';
import { RoleCard } from './RoleCard';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import type { Role } from '@codecafe/core/types/role';

function FullScreenStatus({ children }: { children: ReactNode }): ReactElement {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">{children}</div>
    </div>
  );
}

interface RoleSectionProps {
  title: string;
  roles: Role[];
  onRoleClick: (roleId: string) => void;
  emptyState: ReactElement;
}

function RoleSection({
  title,
  roles,
  onRoleClick,
  emptyState,
}: RoleSectionProps): ReactElement {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <span className="text-sm text-muted-foreground">
          {roles.length} roles
        </span>
      </div>
      {roles.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              onClick={() => onRoleClick(role.id)}
            />
          ))}
        </div>
      ) : (
        emptyState
      )}
    </section>
  );
}

export function RoleManager(): ReactElement {
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
      <FullScreenStatus>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2 text-muted-foreground">Loading roles...</p>
      </FullScreenStatus>
    );
  }

  if (error) {
    return (
      <FullScreenStatus>
        <p className="text-destructive mb-2">Error loading roles</p>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={loadRoles}>Retry</Button>
      </FullScreenStatus>
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
        <Button
          onClick={() =>
            alert('Create Role functionality not implemented yet')
          }
        >
          Create Role
        </Button>
      </div>

      {/* Default Roles Section */}
      <RoleSection
        title="Default Roles"
        roles={defaultRoles}
        onRoleClick={handleRoleClick}
        emptyState={
          <EmptyState
            title="No default roles"
            description="Default roles will appear here once loaded"
          />
        }
      />

      {/* User Roles Section */}
      <RoleSection
        title="User Roles"
        roles={userRoles}
        onRoleClick={handleRoleClick}
        emptyState={
          <EmptyState
            title="No user roles"
            description="Create custom roles to appear here"
            action={
              <Button
                onClick={() =>
                  alert('Create Role functionality not implemented yet')
                }
              >
                Create Role
              </Button>
            }
          />
        }
      />
    </div>
  );
}
