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
 * Converts an orchestrator Role (Phase 1/2 compatible) to a core Role (Phase 2 only).
 * This acts as an adapter between the orchestrator's flexible role definition and the stricter core type.
 */
function convertToCoreRole(orchRole: OrchestratorRole): CoreRole {
  return {
    id: orchRole.id,
    name: orchRole.name,
    systemPrompt: orchRole.template, // 'template' is the legacy name for 'systemPrompt'
    skills: orchRole.skills ?? [],
    recommendedProvider: orchRole.recommendedProvider ?? 'claude-code',
    variables: orchRole.variables ?? [],
    isDefault: orchRole.isDefault ?? false,
    source: orchRole.source ?? '',
  };
}

/**
 * Manages role operations by interfacing with the orchestrator's RoleManager.
 */
class RoleRegistry {
  private roleManager: RoleManager;

  constructor() {
    const rolePaths = [
      path.join(process.cwd(), '.orch', 'roles'), // User-defined roles
      path.join(process.cwd(), 'packages', 'roles'), // Built-in roles
    ];
    this.roleManager = new RoleManager(undefined, rolePaths);
  }

  /**
   * Retrieves all available roles.
   */
  getAll(): CoreRole[] {
    return this.roleManager
      .listRoles()
      .map((roleId) => this.roleManager.loadRole(roleId))
      .filter((orchRole): orchRole is OrchestratorRole => !!orchRole)
      .map(convertToCoreRole);
  }

  /**
   * Retrieves a single role by its ID.
   */
  get(id: string): CoreRole | null {
    const orchRole = this.roleManager.loadRole(id);
    return orchRole ? convertToCoreRole(orchRole) : null;
  }

  /**
   * Registers a new role or updates an existing one.
   */
  save(role: CoreRole): void {
    const orchRole: OrchestratorRole = {
      id: role.id,
      name: role.name,
      template: role.systemPrompt,
      skills: role.skills,
      recommendedProvider: role.recommendedProvider as any, // Type assertion for compatibility
      variables: role.variables,
      isDefault: role.isDefault,
      source: role.source,
    };
    this.roleManager.saveRole(orchRole);
  }

  /**
   * Deletes a role by its ID.
   */
  delete(id: string): void {
    this.roleManager.deleteRole(id);
  }
}

const roleRegistry = new RoleRegistry();

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

// Error handling
export enum RoleErrorCode {
  NOT_FOUND = 'ROLE_NOT_FOUND',
  VALIDATION_FAILED = 'ROLE_VALIDATION_FAILED',
  ALREADY_EXISTS = 'ROLE_ALREADY_EXISTS',
  UNKNOWN = 'ROLE_UNKNOWN_ERROR',
}

interface ErrorResponse {
  success: false;
  error: {
    code: RoleErrorCode;
    message: string;
    details?: any;
  };
}

interface SuccessResponse<T> {
  success: true;
  data: T;
}

type IpcResponse<T> = SuccessResponse<T> | ErrorResponse;

function createErrorResponse(code: RoleErrorCode, message: string, details?: any): ErrorResponse {
  return { success: false, error: { code, message, details } };
}

function createSuccessResponse<T>(data: T): SuccessResponse<T> {
  return { success: true, data };
}

/**
 * Registers all role-related IPC handlers.
 */
export function registerRoleIpcHandlers(): void {
  const listRolesHandler = async (): Promise<IpcResponse<CoreRole[]>> => {
    try {
      return createSuccessResponse(roleRegistry.getAll());
    } catch (error) {
      return createErrorResponse(RoleErrorCode.UNKNOWN, 'Failed to list roles', String(error));
    }
  };
  ipcMain.handle('role:list', listRolesHandler);
  ipcMain.handle('role:getAll', listRolesHandler); // For backward compatibility

  ipcMain.handle(
    'role:get',
    async (event: IpcMainInvokeEvent, roleId: string): Promise<IpcResponse<CoreRole>> => {
      try {
        const validatedId = RoleIdSchema.parse(roleId);
        const role = roleRegistry.get(validatedId);
        if (!role) {
          return createErrorResponse(RoleErrorCode.NOT_FOUND, `Role not found: ${validatedId}`);
        }
        return createSuccessResponse(role);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return createErrorResponse(RoleErrorCode.VALIDATION_FAILED, 'Invalid role ID', error.errors);
        }
        return createErrorResponse(RoleErrorCode.UNKNOWN, 'Failed to get role', String(error));
      }
    },
  );

  ipcMain.handle(
    'role:create',
    async (event: IpcMainInvokeEvent, roleData: unknown): Promise<IpcResponse<CoreRole>> => {
      try {
        const validatedData = RoleCreateSchema.parse(roleData);

        if (roleRegistry.get(validatedData.id)) {
          return createErrorResponse(
            RoleErrorCode.ALREADY_EXISTS,
            `Role already exists: ${validatedData.id}`,
          );
        }

        const role: CoreRole = {
          ...validatedData,
          isDefault: false,
          source: 'user-defined',
          variables: validatedData.variables ?? [],
        };

        roleRegistry.save(role);
        return createSuccessResponse(role);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return createErrorResponse(
            RoleErrorCode.VALIDATION_FAILED,
            'Invalid role data',
            error.errors,
          );
        }
        return createErrorResponse(RoleErrorCode.UNKNOWN, 'Failed to create role', String(error));
      }
    },
  );

  ipcMain.handle(
    'role:update',
    async (
      event: IpcMainInvokeEvent,
      roleId: string,
      updates: unknown,
    ): Promise<IpcResponse<CoreRole>> => {
      try {
        const validatedId = RoleIdSchema.parse(roleId);
        const validatedUpdates = RoleUpdateSchema.parse(updates);

        const existingRole = roleRegistry.get(validatedId);
        if (!existingRole) {
          return createErrorResponse(RoleErrorCode.NOT_FOUND, `Role not found: ${validatedId}`);
        }

        const updatedRole: CoreRole = {
          ...existingRole,
          ...validatedUpdates,
          variables: validatedUpdates.variables ?? existingRole.variables,
        };

        roleRegistry.save(updatedRole);
        return createSuccessResponse(updatedRole);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return createErrorResponse(
            RoleErrorCode.VALIDATION_FAILED,
            'Invalid update data',
            error.errors,
          );
        }
        return createErrorResponse(RoleErrorCode.UNKNOWN, 'Failed to update role', String(error));
      }
    },
  );

  ipcMain.handle(
    'role:delete',
    async (event: IpcMainInvokeEvent, roleId: string): Promise<IpcResponse<void>> => {
      try {
        const validatedId = RoleIdSchema.parse(roleId);
        const existingRole = roleRegistry.get(validatedId);

        if (!existingRole) {
          return createErrorResponse(RoleErrorCode.NOT_FOUND, `Role not found: ${validatedId}`);
        }
        if (existingRole.isDefault) {
          return createErrorResponse(
            RoleErrorCode.VALIDATION_FAILED,
            'Cannot delete a default role',
          );
        }

        roleRegistry.delete(validatedId);
        return createSuccessResponse(undefined);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return createErrorResponse(RoleErrorCode.VALIDATION_FAILED, 'Invalid role ID', error.errors);
        }
        return createErrorResponse(RoleErrorCode.UNKNOWN, 'Failed to delete role', String(error));
      }
    },
  );

  const listDefaultRolesHandler = async (): Promise<IpcResponse<CoreRole[]>> => {
    try {
      const defaultRoles = roleRegistry.getAll().filter((role: CoreRole) => role.isDefault);
      return createSuccessResponse(defaultRoles);
    } catch (error) {
      return createErrorResponse(
        RoleErrorCode.UNKNOWN,
        'Failed to get default roles',
        String(error),
      );
    }
  };
  ipcMain.handle('role:list-default', listDefaultRolesHandler);
  ipcMain.handle('role:getDefaults', listDefaultRolesHandler); // For backward compatibility

  ipcMain.handle('role:list-user', async (): Promise<IpcResponse<CoreRole[]>> => {
    try {
      const userRoles = roleRegistry.getAll().filter((role: CoreRole) => !role.isDefault);
      return createSuccessResponse(userRoles);
    } catch (error) {
      return createErrorResponse(RoleErrorCode.UNKNOWN, 'Failed to get user roles', String(error));
    }
  });
}