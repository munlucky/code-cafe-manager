/**
 * IPC API for Role System
 * Gap 3 해결: Complete IPC/UI API contracts with Zod validation
 * Phase 2: Integrated with orchestrator RoleManager
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';
import * as path from 'path';
import type { Role as CoreRole } from '@codecafe/core';
import { RoleSchema, RoleVariableSchema, ProviderTypeSchema } from '@codecafe/core';
import { RoleManager } from '@codecafe/orchestrator';
import type { Role as OrchestratorRole } from '@codecafe/orchestrator';

/**
 * Convert orchestrator Role (Phase 1/2 compatible) to core Role (Phase 2 only)
 */
function convertToCoreRole(orchRole: OrchestratorRole): CoreRole {
  return {
    id: orchRole.id,
    name: orchRole.name,
    systemPrompt: orchRole.template, // template → systemPrompt
    skills: orchRole.skills || [],
    recommendedProvider: orchRole.recommendedProvider || 'claude-code',
    variables: orchRole.variables || [],
    isDefault: orchRole.isDefault || false,
    source: orchRole.source || '',
  };
}

/**
 * Role Registry using orchestrator RoleManager
 */
class RoleRegistryImpl {
  private roleManager: RoleManager;

  constructor() {
    // Initialize RoleManager with role paths
    const rolePaths = [
      path.join(process.cwd(), '.orch', 'roles'), // User-defined roles
      path.join(process.cwd(), 'packages', 'roles'), // Built-in roles
    ];
    this.roleManager = new RoleManager(undefined, rolePaths);
  }

  getAll(): CoreRole[] {
    const roleIds = this.roleManager.listRoles();
    const roles: CoreRole[] = [];

    for (const roleId of roleIds) {
      const orchRole = this.roleManager.loadRole(roleId);
      if (orchRole) {
        roles.push(convertToCoreRole(orchRole));
      }
    }

    return roles;
  }

  get(id: string): CoreRole | null {
    const orchRole = this.roleManager.loadRole(id);
    if (!orchRole) {
      return null;
    }
    return convertToCoreRole(orchRole);
  }

  register(role: CoreRole): void {
    // Convert core Role to orchestrator Role
    const orchRole: OrchestratorRole = {
      id: role.id,
      name: role.name,
      template: role.systemPrompt,
      skills: role.skills,
      recommendedProvider: role.recommendedProvider as any, // Type assertion for ProviderType compatibility
      variables: role.variables,
      isDefault: role.isDefault,
      source: role.source,
    };
    this.roleManager.saveRole(orchRole);
  }

  update(id: string, role: CoreRole): void {
    this.register(role); // saveRole overwrites
  }

  delete(id: string): void {
    this.roleManager.deleteRole(id);
  }

  reload(): void {
    // RoleManager loads from disk each time, no need to reload
  }
}

const roleRegistry = new RoleRegistryImpl();

// Zod schemas for request/response validation
const RoleIdSchema = z.string().min(1);

const RoleCreateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  systemPrompt: z.string().min(1),
  skills: z.array(z.string()),
  recommendedProvider: ProviderTypeSchema,
  variables: z.array(RoleVariableSchema).optional(),
});

const RoleUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  systemPrompt: z.string().min(1).optional(),
  skills: z.array(z.string()).optional(),
  recommendedProvider: ProviderTypeSchema.optional(),
  variables: z.array(RoleVariableSchema).optional(),
});

// Error codes enum
export enum RoleErrorCode {
  NOT_FOUND = 'ROLE_NOT_FOUND',
  VALIDATION_FAILED = 'ROLE_VALIDATION_FAILED',
  ALREADY_EXISTS = 'ROLE_ALREADY_EXISTS',
  PARSE_ERROR = 'ROLE_PARSE_ERROR',
  UNKNOWN = 'ROLE_UNKNOWN_ERROR',
}

// Error response type
interface ErrorResponse {
  success: false;
  error: {
    code: RoleErrorCode;
    message: string;
    details?: any;
  };
}

// Success response types
interface SuccessResponse<T = void> {
  success: true;
  data: T;
}

type IpcResponse<T = void> = SuccessResponse<T> | ErrorResponse;

// Helper function to create error response
function createErrorResponse(
  code: RoleErrorCode,
  message: string,
  details?: any
): ErrorResponse {
  return {
    success: false,
    error: { code, message, details },
  };
}

// Helper function to create success response
function createSuccessResponse<T>(data: T): SuccessResponse<T> {
  return { success: true, data };
}

/**
 * Register all role-related IPC handlers
 */
export function registerRoleIpcHandlers(): void {
  // Get all roles (alias for list)
  ipcMain.handle('role:list', async (): Promise<IpcResponse<CoreRole[]>> => {
    try {
      const roles = roleRegistry.getAll();
      return createSuccessResponse(roles);
    } catch (error) {
      return createErrorResponse(
        RoleErrorCode.UNKNOWN,
        'Failed to get roles',
        String(error)
      );
    }
  });

  // Get all roles (backward compatibility)
  ipcMain.handle('role:getAll', async (): Promise<IpcResponse<CoreRole[]>> => {
    try {
      const roles = roleRegistry.getAll();
      return createSuccessResponse(roles);
    } catch (error) {
      return createErrorResponse(
        RoleErrorCode.UNKNOWN,
        'Failed to get roles',
        String(error)
      );
    }
  });

  // Get role by ID
  ipcMain.handle('role:get', async (
    event: IpcMainInvokeEvent,
    roleId: string
  ): Promise<IpcResponse<CoreRole>> => {
    try {
      const validatedId = RoleIdSchema.parse(roleId);
      const role = roleRegistry.get(validatedId);
      if (!role) {
        return createErrorResponse(
          RoleErrorCode.NOT_FOUND,
          `Role not found: ${validatedId}`
        );
      }
      return createSuccessResponse(role);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse(
          RoleErrorCode.VALIDATION_FAILED,
          'Invalid role ID',
          (error as any).errors
        );
      }
      return createErrorResponse(
        RoleErrorCode.UNKNOWN,
        'Failed to get role',
        String(error)
      );
    }
  });

  // Create new role
  ipcMain.handle('role:create', async (
    event: IpcMainInvokeEvent,
    roleData: unknown
  ): Promise<IpcResponse<CoreRole>> => {
    try {
      const validatedData = RoleCreateSchema.parse(roleData);

      // Check if role already exists
      if (roleRegistry.get(validatedData.id)) {
        return createErrorResponse(
          RoleErrorCode.ALREADY_EXISTS,
          `Role already exists: ${validatedData.id}`
        );
      }

      const role: CoreRole = {
        ...validatedData,
        isDefault: false,
        source: 'user-defined',
        variables: validatedData.variables || [],
      };

      roleRegistry.register(role);
      return createSuccessResponse(role);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse(
          RoleErrorCode.VALIDATION_FAILED,
          'Invalid role data',
          (error as any).errors
        );
      }
      return createErrorResponse(
        RoleErrorCode.UNKNOWN,
        'Failed to create role',
        String(error)
      );
    }
  });

  // Update existing role
  ipcMain.handle('role:update', async (
    event: IpcMainInvokeEvent,
    roleId: string,
    updates: unknown
  ): Promise<IpcResponse<CoreRole>> => {
    try {
      const validatedId = RoleIdSchema.parse(roleId);
      const validatedUpdates = RoleUpdateSchema.parse(updates);

      const existingRole = roleRegistry.get(validatedId);
      if (!existingRole) {
        return createErrorResponse(
          RoleErrorCode.NOT_FOUND,
          `Role not found: ${validatedId}`
        );
      }

      // Update role
      const updatedRole: CoreRole = {
        ...existingRole,
        ...validatedUpdates,
        variables: validatedUpdates.variables || existingRole.variables,
      };

      roleRegistry.update(validatedId, updatedRole);
      return createSuccessResponse(updatedRole);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse(
          RoleErrorCode.VALIDATION_FAILED,
          'Invalid role data',
          (error as any).errors
        );
      }
      return createErrorResponse(
        RoleErrorCode.UNKNOWN,
        'Failed to update role',
        error
      );
    }
  });

  // Delete role
  ipcMain.handle('role:delete', async (
    event: IpcMainInvokeEvent,
    roleId: string
  ): Promise<IpcResponse<void>> => {
    try {
      const validatedId = RoleIdSchema.parse(roleId);

      const existingRole = roleRegistry.get(validatedId);
      if (!existingRole) {
        return createErrorResponse(
          RoleErrorCode.NOT_FOUND,
          `Role not found: ${validatedId}`
        );
      }

      // Don't allow deletion of default roles
      if (existingRole.isDefault) {
        return createErrorResponse(
          RoleErrorCode.VALIDATION_FAILED,
          'Cannot delete default role'
        );
      }

      roleRegistry.delete(validatedId);
      return createSuccessResponse(undefined);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse(
          RoleErrorCode.VALIDATION_FAILED,
          'Invalid role ID',
          (error as any).errors
        );
      }
      return createErrorResponse(
        RoleErrorCode.UNKNOWN,
        'Failed to delete role',
        String(error)
      );
    }
  });

  // Get default roles (alias for list-default)
  ipcMain.handle('role:list-default', async (): Promise<IpcResponse<CoreRole[]>> => {
    try {
      const defaultRoles = roleRegistry.getAll().filter((role: any) => role.isDefault);
      return createSuccessResponse(defaultRoles);
    } catch (error) {
      return createErrorResponse(
        RoleErrorCode.UNKNOWN,
        'Failed to get default roles',
        String(error)
      );
    }
  });

  // Get default roles (backward compatibility)
  ipcMain.handle('role:getDefaults', async (): Promise<IpcResponse<CoreRole[]>> => {
    try {
      const defaultRoles = roleRegistry.getAll().filter((role: any) => role.isDefault);
      return createSuccessResponse(defaultRoles);
    } catch (error) {
      return createErrorResponse(
        RoleErrorCode.UNKNOWN,
        'Failed to get default roles',
        String(error)
      );
    }
  });

  // Get user-defined roles (list-user)
  ipcMain.handle('role:list-user', async (): Promise<IpcResponse<CoreRole[]>> => {
    try {
      const userRoles = roleRegistry.getAll().filter((role: any) => !role.isDefault);
      return createSuccessResponse(userRoles);
    } catch (error) {
      return createErrorResponse(
        RoleErrorCode.UNKNOWN,
        'Failed to get user roles',
        String(error)
      );
    }
  });

  // Reload roles from disk
  ipcMain.handle('role:reload', async (): Promise<IpcResponse<CoreRole[]>> => {
    try {
      roleRegistry.reload();
      const roles = roleRegistry.getAll();
      return createSuccessResponse(roles);
    } catch (error) {
      return createErrorResponse(
        RoleErrorCode.UNKNOWN,
        'Failed to reload roles',
        String(error)
      );
    }
  });
}