/**
 * Cafe Registry IPC Handlers
 * Manages Cafe (Repository) registration and metadata
 */

import { ipcMain } from 'electron';
import { promises as fs, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import {
  Cafe,
  CafeRegistry as CafeRegistryData,
  CreateCafeParams,
  UpdateCafeParams,
  CafeRegistrySchema,
  CreateCafeParamsSchema,
  UpdateCafeParamsSchema,
  createLogger,
} from '@codecafe/core';

const logger = createLogger({ context: 'IPC:Cafe' });

// Error handling
export enum CafeErrorCode {
  NOT_FOUND = 'CAFE_NOT_FOUND',
  VALIDATION_FAILED = 'CAFE_VALIDATION_FAILED',
  ALREADY_EXISTS = 'CAFE_ALREADY_EXISTS',
  INVALID_PATH = 'CAFE_INVALID_PATH',
  UNKNOWN = 'CAFE_UNKNOWN_ERROR',
}

class CafeError extends Error {
  constructor(
    public readonly code: CafeErrorCode,
    message: string,
    public readonly details?: any,
  ) {
    super(message);
    this.name = 'CafeError';
  }
}

/**
 * Manages the Cafe registry file and operations
 */
class CafeRegistry {
  private get registryPath(): string {
    return join(homedir(), '.codecafe', 'cafes.json');
  }

  private get codecafeDir(): string {
    return join(homedir(), '.codecafe');
  }

  private async ensureDir(): Promise<void> {
    if (!existsSync(this.codecafeDir)) {
      await fs.mkdir(this.codecafeDir, { recursive: true });
    }
  }

  private async getRepoName(repoPath: string): Promise<string> {
    try {
      // Try to read from .git/config
      const gitConfigPath = join(repoPath, '.git', 'config');
      if (existsSync(gitConfigPath)) {
        const configContent = await fs.readFile(gitConfigPath, 'utf-8');
        const match = configContent.match(/\[remote "origin"\][^\[]*url\s*=\s*.*\/([^\/]+?)(?:\.git)?\s*$/m);
        if (match && match[1]) {
          return match[1];
        }
      }
    } catch {
      // Ignore error and fallback
    }

    // Fallback: use directory name
    const parts = repoPath.split(/[/\\]/);
    return parts[parts.length - 1] || 'unknown';
  }

  private async getCurrentBranch(repoPath: string): Promise<string> {
    try {
      const headPath = join(repoPath, '.git', 'HEAD');
      if (existsSync(headPath)) {
        const headContent = await fs.readFile(headPath, 'utf-8');
        const match = headContent.match(/ref: refs\/heads\/(.+)/);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
    } catch {
      // Ignore error
    }
    return 'unknown';
  }

  private async checkIsDirty(_repoPath: string): Promise<boolean> {
    // Simplified check: this would need proper git status in production
    // For now, return false as per original implementation
    return false;
  }

  async load(): Promise<CafeRegistryData> {
    const path = this.registryPath;

    if (!existsSync(path)) {
      return { version: '1.0', cafes: [] };
    }

    try {
      const content = await fs.readFile(path, 'utf-8');
      const data = JSON.parse(content);
      return CafeRegistrySchema.parse(data);
    } catch (error) {
      logger.error('Failed to load registry', { error: error instanceof Error ? error.message : String(error) });

      // Backup corrupted file
      const backupPath = `${path}.backup.${Date.now()}`;
      await fs.copyFile(path, backupPath);
      logger.info(`Corrupted registry backed up to: ${backupPath}`);

      return { version: '1.0', cafes: [] };
    }
  }

  async save(registry: CafeRegistryData): Promise<void> {
    await this.ensureDir();
    const validated = CafeRegistrySchema.parse(registry);
    await fs.writeFile(this.registryPath, JSON.stringify(validated, null, 2), 'utf-8');
  }

  async getAll(): Promise<Cafe[]> {
    const registry = await this.load();
    return registry.cafes;
  }

  async get(id: string): Promise<Cafe | null> {
    const registry = await this.load();
    return registry.cafes.find((c) => c.id === id) || null;
  }

  async create(params: CreateCafeParams): Promise<Cafe> {
    const validatedParams = CreateCafeParamsSchema.parse(params);

    if (!existsSync(validatedParams.path)) {
      throw new CafeError(CafeErrorCode.INVALID_PATH, `Path does not exist: ${validatedParams.path}`);
    }

    const gitDir = join(validatedParams.path, '.git');
    if (!existsSync(gitDir)) {
      throw new CafeError(CafeErrorCode.INVALID_PATH, `Not a git repository: ${validatedParams.path}`);
    }

    const registry = await this.load();

    if (registry.cafes.some((c) => c.path === validatedParams.path)) {
      throw new CafeError(CafeErrorCode.ALREADY_EXISTS, `Cafe already registered: ${validatedParams.path}`);
    }

    const [name, currentBranch, isDirty] = await Promise.all([
      this.getRepoName(validatedParams.path),
      this.getCurrentBranch(validatedParams.path),
      this.checkIsDirty(validatedParams.path),
    ]);

    const cafe: Cafe = {
      id: randomUUID(),
      name,
      path: validatedParams.path,
      currentBranch,
      isDirty,
      activeOrders: 0,
      createdAt: new Date().toISOString(),
      settings: {
        baseBranch: validatedParams.baseBranch || 'main',
        worktreeRoot: validatedParams.worktreeRoot || '../.codecafe-worktrees',
      },
    };

    registry.cafes.push(cafe);
    await this.save(registry);
    logger.info(`Created Cafe: ${cafe.name} (${cafe.id})`);

    return cafe;
  }

  async update(id: string, params: UpdateCafeParams): Promise<Cafe> {
    const validatedParams = UpdateCafeParamsSchema.parse(params);
    const registry = await this.load();
    const cafeIndex = registry.cafes.findIndex((c) => c.id === id);

    if (cafeIndex === -1) {
      throw new CafeError(CafeErrorCode.NOT_FOUND, `Cafe not found: ${id}`);
    }

    const cafe = registry.cafes[cafeIndex];

    if (validatedParams.name !== undefined) cafe.name = validatedParams.name;
    if (validatedParams.currentBranch !== undefined) cafe.currentBranch = validatedParams.currentBranch;
    if (validatedParams.isDirty !== undefined) cafe.isDirty = validatedParams.isDirty;
    if (validatedParams.activeOrders !== undefined) cafe.activeOrders = validatedParams.activeOrders;
    if (validatedParams.settings !== undefined) {
      cafe.settings = { ...cafe.settings, ...validatedParams.settings };
    }

    await this.save(registry);
    logger.info(`Updated Cafe: ${cafe.name} (${cafe.id})`);

    return cafe;
  }

  async delete(id: string): Promise<void> {
    const registry = await this.load();
    const cafeIndex = registry.cafes.findIndex((c) => c.id === id);

    if (cafeIndex === -1) {
      throw new CafeError(CafeErrorCode.NOT_FOUND, `Cafe not found: ${id}`);
    }

    const cafe = registry.cafes[cafeIndex];
    registry.cafes.splice(cafeIndex, 1);

    if (registry.lastAccessed === id) {
      registry.lastAccessed = undefined;
    }

    await this.save(registry);
    logger.info(`Deleted Cafe: ${cafe.name} (${cafe.id})`);
  }

  async setLastAccessed(id: string): Promise<void> {
    const registry = await this.load();
    const cafe = registry.cafes.find((c) => c.id === id);

    if (!cafe) {
      throw new CafeError(CafeErrorCode.NOT_FOUND, `Cafe not found: ${id}`);
    }

    registry.lastAccessed = id;
    await this.save(registry);
    logger.info(`Set last accessed: ${cafe.name} (${cafe.id})`);
  }

  async getLastAccessed(): Promise<Cafe | null> {
    const registry = await this.load();
    if (!registry.lastAccessed) return null;
    return registry.cafes.find((c) => c.id === registry.lastAccessed) || null;
  }
}

const cafeRegistry = new CafeRegistry();

interface IpcResponse<T = void> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Standardized IPC handler wrapper
 */
async function handleIpc<T>(
  handler: () => Promise<T>,
  context: string
): Promise<IpcResponse<T>> {
  try {
    const data = await handler();
    return {
      success: true,
      data
    };
  } catch (error: any) {
    logger.error(`Error in ${context}`, { error: error instanceof Error ? error.message : String(error) });

    let errorMessage = error.message || 'Unknown error';
    if (error instanceof z.ZodError) {
      errorMessage = `Validation failed: ${error.errors.map(e => e.message).join(', ')}`;
    }

    return {
      success: false,
      error: {
        code: error.code || 'UNKNOWN',
        message: errorMessage,
        details: error.details
      }
    };
  }
}

/**
 * Register Cafe IPC Handlers
 */
export function registerCafeHandlers(): void {
  ipcMain.handle('cafe:list', () =>
    handleIpc(() => cafeRegistry.getAll(), 'cafe:list')
  );

  ipcMain.handle('cafe:get', (_, id: string) =>
    handleIpc(() => cafeRegistry.get(id), 'cafe:get')
  );

  ipcMain.handle('cafe:create', (_, params: CreateCafeParams) =>
    handleIpc(() => cafeRegistry.create(params), 'cafe:create')
  );

  ipcMain.handle('cafe:update', (_, id: string, params: UpdateCafeParams) =>
    handleIpc(() => cafeRegistry.update(id, params), 'cafe:update')
  );

  ipcMain.handle('cafe:delete', (_, id: string) =>
    handleIpc(() => cafeRegistry.delete(id), 'cafe:delete')
  );

  ipcMain.handle('cafe:setLastAccessed', (_, id: string) =>
    handleIpc(() => cafeRegistry.setLastAccessed(id), 'cafe:setLastAccessed')
  );

  ipcMain.handle('cafe:getLastAccessed', () =>
    handleIpc(() => cafeRegistry.getLastAccessed(), 'cafe:getLastAccessed')
  );

  logger.info('Cafe handlers registered');
}
