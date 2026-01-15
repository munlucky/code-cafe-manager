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
import type { Role as OrchestratorRole, ProviderType } from '@codecafe/orchestrator';

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
      recommendedProvider: role.recommendedProvider as ProviderType,
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
   * Note: RoleManager reads directly from disk on each access, so no action needed.
   */
  reload(): void {
    // No-op: RoleManager does not use caching, roles are always read fresh from disk
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


/**
 * Registers all role-related IPC handlers.
 */
export function registerRoleIpcHandlers(): void {
  ipcMain.handle('role:list', async () => {
    try {
      return { status: 'success', data: roleRegistry.getAll() };
    } catch (error) {
      console.error('Failed to list roles:', error);
      return { status: 'error', error: { message: 'Failed to list roles', code: 'UNKNOWN' } };
    }
  });
  ipcMain.handle('role:getAll', async () => { // For backward compatibility
    try {
      return { status: 'success', data: roleRegistry.getAll() };
    } catch (error) {
      console.error('Failed to list roles:', error);
      return { status: 'error', error: { message: 'Failed to list roles', code: 'UNKNOWN' } };
    }
  });

  ipcMain.handle('role:get', async (_, roleId: string) => {
    try {
      const validatedId = RoleIdSchema.parse(roleId);
      const role = roleRegistry.get(validatedId);
      if (!role) {
        return { status: 'error', error: { message: `Role not found: ${validatedId}`, code: 'NOT_FOUND' } };
      }
      return { status: 'success', data: role };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { status: 'error', error: { message: 'Invalid role ID', code: 'VALIDATION_FAILED', details: error.errors } };
      }
      console.error('Failed to get role:', error);
      return { status: 'error', error: { message: 'Failed to get role', code: 'UNKNOWN' } };
    }
  });

  ipcMain.handle('role:create', async (_, roleData: unknown) => {
    try {
      const validatedData = RoleCreateSchema.parse(roleData);
      if (roleRegistry.get(validatedData.id)) {
        return { status: 'error', error: { message: `Role already exists: ${validatedData.id}`, code: 'ALREADY_EXISTS' } };
      }
      const role: CoreRole = {
        ...validatedData,
        isDefault: false,
        source: 'user-defined',
        variables: validatedData.variables ?? [],
      };
      roleRegistry.save(role);
      return { status: 'success', data: role };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { status: 'error', error: { message: 'Invalid role data', code: 'VALIDATION_FAILED', details: error.errors } };
      }
      console.error('Failed to create role:', error);
      return { status: 'error', error: { message: 'Failed to create role', code: 'UNKNOWN' } };
    }
  });

  ipcMain.handle('role:update', async (_, roleId: string, updates: unknown) => {
    try {
      const validatedId = RoleIdSchema.parse(roleId);
      const validatedUpdates = RoleUpdateSchema.parse(updates);
      const existingRole = roleRegistry.get(validatedId);
      if (!existingRole) {
        return { status: 'error', error: { message: `Role not found: ${validatedId}`, code: 'NOT_FOUND' } };
      }
      const updatedRole: CoreRole = {
        ...existingRole,
        ...validatedUpdates,
        variables: validatedUpdates.variables ?? existingRole.variables,
      };
      roleRegistry.save(updatedRole);
      return { status: 'success', data: updatedRole };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { status: 'error', error: { message: 'Invalid update data', code: 'VALIDATION_FAILED', details: error.errors } };
      }
      console.error('Failed to update role:', error);
      return { status: 'error', error: { message: 'Failed to update role', code: 'UNKNOWN' } };
    }
  });

  ipcMain.handle('role:delete', async (_, roleId: string) => {
    try {
      const validatedId = RoleIdSchema.parse(roleId);
      const existingRole = roleRegistry.get(validatedId);
      if (!existingRole) {
        return { status: 'error', error: { message: `Role not found: ${validatedId}`, code: 'NOT_FOUND' } };
      }
      if (existingRole.isDefault) {
        return { status: 'error', error: { message: 'Cannot delete a default role', code: 'VALIDATION_FAILED' } };
      }
      roleRegistry.delete(validatedId);
      return { status: 'success', data: undefined };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { status: 'error', error: { message: 'Invalid role ID', code: 'VALIDATION_FAILED', details: error.errors } };
      }
      console.error('Failed to delete role:', error);
      return { status: 'error', error: { message: 'Failed to delete role', code: 'UNKNOWN' } };
    }
  });

  ipcMain.handle('role:list-default', async () => {
    try {
      const roles = roleRegistry.getAll().filter((role) => role.isDefault);
      return { status: 'success', data: roles };
    } catch (error) {
      console.error('Failed to get default roles:', error);
      return { status: 'error', error: { message: 'Failed to get default roles', code: 'UNKNOWN' } };
    }
  });
  ipcMain.handle('role:getDefaults', async () => { // For backward compatibility
    try {
      const roles = roleRegistry.getAll().filter((role) => role.isDefault);
      return { status: 'success', data: roles };
    } catch (error) {
      console.error('Failed to get default roles:', error);
      return { status: 'error', error: { message: 'Failed to get default roles', code: 'UNKNOWN' } };
    }
  });

  ipcMain.handle('role:list-user', async () => {
    try {
      const roles = roleRegistry.getAll().filter((role) => !role.isDefault);
      return { status: 'success', data: roles };
    } catch (error) {
      console.error('Failed to get user roles:', error);
      return { status: 'error', error: { message: 'Failed to get user roles', code: 'UNKNOWN' } };
    }
  });

  ipcMain.handle('role:reload', async () => {
    try {
      roleRegistry.reload();
      return { status: 'success', data: roleRegistry.getAll() };
    } catch (error) {
      console.error('Failed to reload roles:', error);
      return { status: 'error', error: { message: 'Failed to reload roles', code: 'UNKNOWN' } };
    }
  });
}
