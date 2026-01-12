/**
 * Cafe Registry IPC Handlers
 * Manages Cafe (Repository) registration and metadata
 */

import { ipcMain } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';
import {
  Cafe,
  CafeRegistry,
  CreateCafeParams,
  UpdateCafeParams,
  CafeRegistrySchema,
  CreateCafeParamsSchema,
  UpdateCafeParamsSchema,
} from '@codecafe/core';

/**
 * Get Cafe Registry file path
 * Windows: %USERPROFILE%/.codecafe/cafes.json
 * macOS/Linux: ~/.codecafe/cafes.json
 */
function getCafeRegistryPath(): string {
  const codecafeDir = join(homedir(), '.codecafe');
  return join(codecafeDir, 'cafes.json');
}

/**
 * Ensure .codecafe directory exists
 */
async function ensureCodecafeDir(): Promise<void> {
  const codecafeDir = join(homedir(), '.codecafe');
  if (!existsSync(codecafeDir)) {
    await fs.mkdir(codecafeDir, { recursive: true });
  }
}

/**
 * Load Cafe Registry from disk
 * Creates empty registry if file doesn't exist
 */
async function loadCafeRegistry(): Promise<CafeRegistry> {
  const registryPath = getCafeRegistryPath();

  // If file doesn't exist, return empty registry
  if (!existsSync(registryPath)) {
    const emptyRegistry: CafeRegistry = {
      version: '1.0',
      cafes: [],
    };
    return emptyRegistry;
  }

  try {
    const content = await fs.readFile(registryPath, 'utf-8');
    const data = JSON.parse(content);

    // Validate with Zod
    const validated = CafeRegistrySchema.parse(data);
    return validated;
  } catch (error) {
    // If validation fails, backup corrupted file and return empty registry
    console.error('[Cafe Registry] Failed to load registry:', error);

    // Create backup
    const backupPath = `${registryPath}.backup.${Date.now()}`;
    await fs.copyFile(registryPath, backupPath);
    console.log(`[Cafe Registry] Corrupted registry backed up to: ${backupPath}`);

    // Return empty registry
    const emptyRegistry: CafeRegistry = {
      version: '1.0',
      cafes: [],
    };
    return emptyRegistry;
  }
}

/**
 * Save Cafe Registry to disk
 */
async function saveCafeRegistry(registry: CafeRegistry): Promise<void> {
  await ensureCodecafeDir();
  const registryPath = getCafeRegistryPath();

  // Validate before saving
  const validated = CafeRegistrySchema.parse(registry);

  await fs.writeFile(registryPath, JSON.stringify(validated, null, 2), 'utf-8');
}

/**
 * Get Git repository name from path
 */
async function getRepoName(repoPath: string): Promise<string> {
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

    // Fallback: use directory name
    const parts = repoPath.split(/[/\\]/);
    return parts[parts.length - 1] || 'unknown';
  } catch (error) {
    // Fallback: use directory name
    const parts = repoPath.split(/[/\\]/);
    return parts[parts.length - 1] || 'unknown';
  }
}

/**
 * Get current Git branch
 */
async function getCurrentBranch(repoPath: string): Promise<string> {
  try {
    const headPath = join(repoPath, '.git', 'HEAD');
    if (existsSync(headPath)) {
      const headContent = await fs.readFile(headPath, 'utf-8');
      const match = headContent.match(/ref: refs\/heads\/(.+)/);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return 'unknown';
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Check if repository has uncommitted changes
 */
async function checkIsDirty(repoPath: string): Promise<boolean> {
  // Simplified check: this would need proper git status in production
  // For now, return false
  return false;
}

/**
 * Register IPC Handlers
 */
export function registerCafeHandlers(): void {
  /**
   * List all Cafes
   */
  ipcMain.handle('cafe:list', async (): Promise<Cafe[]> => {
    const registry = await loadCafeRegistry();
    return registry.cafes;
  });

  /**
   * Get a specific Cafe by ID
   */
  ipcMain.handle('cafe:get', async (_event, id: string): Promise<Cafe | null> => {
    const registry = await loadCafeRegistry();
    const cafe = registry.cafes.find((c) => c.id === id);
    return cafe || null;
  });

  /**
   * Create a new Cafe
   */
  ipcMain.handle('cafe:create', async (_event, params: CreateCafeParams): Promise<Cafe> => {
    // Validate params
    const validatedParams = CreateCafeParamsSchema.parse(params);

    // Check if path exists
    if (!existsSync(validatedParams.path)) {
      throw new Error(`Path does not exist: ${validatedParams.path}`);
    }

    // Check if it's a git repository
    const gitDir = join(validatedParams.path, '.git');
    if (!existsSync(gitDir)) {
      throw new Error(`Not a git repository: ${validatedParams.path}`);
    }

    // Load registry
    const registry = await loadCafeRegistry();

    // Check if already registered
    const existing = registry.cafes.find((c) => c.path === validatedParams.path);
    if (existing) {
      throw new Error(`Cafe already registered: ${validatedParams.path}`);
    }

    // Get repository info
    const name = await getRepoName(validatedParams.path);
    const currentBranch = await getCurrentBranch(validatedParams.path);
    const isDirty = await checkIsDirty(validatedParams.path);

    // Create Cafe
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

    // Add to registry
    registry.cafes.push(cafe);

    // Save registry
    await saveCafeRegistry(registry);

    console.log(`[Cafe Registry] Created Cafe: ${cafe.name} (${cafe.id})`);

    return cafe;
  });

  /**
   * Update a Cafe
   */
  ipcMain.handle('cafe:update', async (_event, id: string, params: UpdateCafeParams): Promise<Cafe> => {
    // Validate params
    const validatedParams = UpdateCafeParamsSchema.parse(params);

    // Load registry
    const registry = await loadCafeRegistry();

    // Find Cafe
    const cafeIndex = registry.cafes.findIndex((c) => c.id === id);
    if (cafeIndex === -1) {
      throw new Error(`Cafe not found: ${id}`);
    }

    const cafe = registry.cafes[cafeIndex];

    // Update fields
    if (validatedParams.name !== undefined) {
      cafe.name = validatedParams.name;
    }
    if (validatedParams.currentBranch !== undefined) {
      cafe.currentBranch = validatedParams.currentBranch;
    }
    if (validatedParams.isDirty !== undefined) {
      cafe.isDirty = validatedParams.isDirty;
    }
    if (validatedParams.activeOrders !== undefined) {
      cafe.activeOrders = validatedParams.activeOrders;
    }
    if (validatedParams.settings !== undefined) {
      cafe.settings = {
        ...cafe.settings,
        ...validatedParams.settings,
      };
    }

    // Save registry
    await saveCafeRegistry(registry);

    console.log(`[Cafe Registry] Updated Cafe: ${cafe.name} (${cafe.id})`);

    return cafe;
  });

  /**
   * Delete a Cafe
   */
  ipcMain.handle('cafe:delete', async (_event, id: string): Promise<void> => {
    // Load registry
    const registry = await loadCafeRegistry();

    // Find Cafe
    const cafeIndex = registry.cafes.findIndex((c) => c.id === id);
    if (cafeIndex === -1) {
      throw new Error(`Cafe not found: ${id}`);
    }

    const cafe = registry.cafes[cafeIndex];

    // Remove from registry
    registry.cafes.splice(cafeIndex, 1);

    // If this was last accessed, clear it
    if (registry.lastAccessed === id) {
      registry.lastAccessed = undefined;
    }

    // Save registry
    await saveCafeRegistry(registry);

    console.log(`[Cafe Registry] Deleted Cafe: ${cafe.name} (${cafe.id})`);
  });

  /**
   * Set last accessed Cafe
   */
  ipcMain.handle('cafe:setLastAccessed', async (_event, id: string): Promise<void> => {
    const registry = await loadCafeRegistry();

    // Verify Cafe exists
    const cafe = registry.cafes.find((c) => c.id === id);
    if (!cafe) {
      throw new Error(`Cafe not found: ${id}`);
    }

    registry.lastAccessed = id;
    await saveCafeRegistry(registry);

    console.log(`[Cafe Registry] Set last accessed: ${cafe.name} (${cafe.id})`);
  });

  /**
   * Get last accessed Cafe
   */
  ipcMain.handle('cafe:getLastAccessed', async (): Promise<Cafe | null> => {
    const registry = await loadCafeRegistry();

    if (!registry.lastAccessed) {
      return null;
    }

    const cafe = registry.cafes.find((c) => c.id === registry.lastAccessed);
    return cafe || null;
  });

  console.log('[IPC] Cafe handlers registered');
}
