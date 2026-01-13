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

  /**
   * Reloads roles from the disk.
   */
  reload(): void {
    // This will clear the cache and force re-reading from disk on next access
    this.roleManager.rescanRoles();
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
 * Wraps an async function with standardized try-catch and error reporting.
 */
async function handleIpc<T>(
  logic: () => Promise<T> | T,
  errorContext: { unknown: string; zod?: string },
): Promise<IpcResponse<T>> {
  try {
    const result = await Promise.resolve(logic());
    return createSuccessResponse(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(
        RoleErrorCode.VALIDATION_FAILED,
        errorContext.zod || 'Validation failed',
        error.errors,
      );
    }
    return createErrorResponse(
      RoleErrorCode.UNKNOWN,
      errorContext.unknown,
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * Registers all role-related IPC handlers.
 */
export function registerRoleIpcHandlers(): void {
  const listRolesHandler = () => handleIpc(() => roleRegistry.getAll(), { unknown: 'Failed to list roles' });
  ipcMain.handle('role:list', listRolesHandler);
  ipcMain.handle('role:getAll', listRolesHandler); // For backward compatibility

  ipcMain.handle('role:get', (_, roleId: string) =>
    handleIpc(() => {
      const validatedId = RoleIdSchema.parse(roleId);
      const role = roleRegistry.get(validatedId);
      if (!role) {
        throw createErrorResponse(RoleErrorCode.NOT_FOUND, `Role not found: ${validatedId}`);
      }
      return role;
    }, { unknown: 'Failed to get role', zod: 'Invalid role ID' }),
  );

  ipcMain.handle('role:create', (_, roleData: unknown) =>
    handleIpc(() => {
      const validatedData = RoleCreateSchema.parse(roleData);
      if (roleRegistry.get(validatedData.id)) {
        throw createErrorResponse(RoleErrorCode.ALREADY_EXISTS, `Role already exists: ${validatedData.id}`);
      }
      const role: CoreRole = {
        ...validatedData,
        isDefault: false,
        source: 'user-defined',
        variables: validatedData.variables ?? [],
      };
      roleRegistry.save(role);
      return role;
    }, { unknown: 'Failed to create role', zod: 'Invalid role data' }),
  );

  ipcMain.handle('role:update', (_, roleId: string, updates: unknown) =>
    handleIpc(() => {
      const validatedId = RoleIdSchema.parse(roleId);
      const validatedUpdates = RoleUpdateSchema.parse(updates);
      const existingRole = roleRegistry.get(validatedId);
      if (!existingRole) {
        throw createErrorResponse(RoleErrorCode.NOT_FOUND, `Role not found: ${validatedId}`);
      }
      const updatedRole: CoreRole = {
        ...existingRole,
        ...validatedUpdates,
        variables: validatedUpdates.variables ?? existingRole.variables,
      };
      roleRegistry.save(updatedRole);
      return updatedRole;
    }, { unknown: 'Failed to update role', zod: 'Invalid update data' }),
  );

  ipcMain.handle('role:delete', (_, roleId: string) =>
    handleIpc(() => {
      const validatedId = RoleIdSchema.parse(roleId);
      const existingRole = roleRegistry.get(validatedId);
      if (!existingRole) {
        throw createErrorResponse(RoleErrorCode.NOT_FOUND, `Role not found: ${validatedId}`);
      }
      if (existingRole.isDefault) {
        throw createErrorResponse(RoleErrorCode.VALIDATION_FAILED, 'Cannot delete a default role');
      }
      roleRegistry.delete(validatedId);
      return undefined;
    }, { unknown: 'Failed to delete role', zod: 'Invalid role ID' }),
  );

  const listDefaultRolesHandler = () =>
    handleIpc(() => roleRegistry.getAll().filter((role) => role.isDefault), {
      unknown: 'Failed to get default roles',
    });
  ipcMain.handle('role:list-default', listDefaultRolesHandler);
  ipcMain.handle('role:getDefaults', listDefaultRolesHandler); // For backward compatibility

  const listUserRolesHandler = () =>
    handleIpc(() => roleRegistry.getAll().filter((role) => !role.isDefault), {
      unknown: 'Failed to get user roles',
    });
  ipcMain.handle('role:list-user', listUserRolesHandler);

  ipcMain.handle('role:reload', () =>
    handleIpc(() => {
      roleRegistry.reload();
      return roleRegistry.getAll();
    }, { unknown: 'Failed to reload roles' }),
  );
}
