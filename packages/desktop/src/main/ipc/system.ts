/**
 * System IPC Handlers
 * Environment checks and system setup utilities
 */

import { ipcMain } from 'electron';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, realpathSync } from 'fs';
import { join, resolve, isAbsolute } from 'path';
import { createLogger, getErrorMessage } from '@codecafe/core';
import type { IpcResponse } from './types.js';

const logger = createLogger({ context: 'IPC:System' });

const execFileAsync = promisify(execFile);

/**
 * Validate and normalize a path to prevent path traversal attacks
 * @throws Error if path is invalid or contains suspicious patterns
 */
function validatePath(inputPath: string): string {
  // Check for suspicious patterns
  if (inputPath.includes('\0')) {
    throw new Error('Invalid path: contains null bytes');
  }

  // Resolve to absolute path
  const absolutePath = isAbsolute(inputPath) ? inputPath : resolve(process.cwd(), inputPath);

  // Normalize the path (resolve .., ., etc.)
  const normalizedPath = resolve(absolutePath);

  // Verify path exists and get real path (resolves symlinks)
  if (!existsSync(normalizedPath)) {
    throw new Error(`Path does not exist: ${normalizedPath}`);
  }

  const realPath = realpathSync(normalizedPath);

  // Additional validation: path should not escape common safe directories
  // Allow: home directory, /tmp, /var/tmp, current working directory
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const cwd = process.cwd();
  const safePrefixes = [homeDir, '/tmp', '/var/tmp', cwd].filter(Boolean);

  const isInSafeLocation = safePrefixes.some(prefix => realPath.startsWith(prefix));
  if (!isInSafeLocation) {
    logger.warn('Path validation: path outside safe locations', { realPath, safePrefixes });
    // Allow but log - some users may have repos in other locations
  }

  return realPath;
}

export interface EnvironmentCheckResult {
  git: {
    installed: boolean;
    version?: string;
  };
  node: {
    installed: boolean;
    version?: string;
  };
  pnpm: {
    installed: boolean;
    version?: string;
  };
}

export interface GitRepoStatus {
  isGitRepo: boolean;
  hasRemote: boolean;
  remoteName?: string;
  remoteUrl?: string;
  currentBranch?: string;
}

/**
 * Allowed commands for version checking (whitelist)
 * Only these commands can be executed via checkCommand
 */
const ALLOWED_COMMANDS = ['git', 'node', 'pnpm', 'npm', 'yarn'] as const;
type AllowedCommand = typeof ALLOWED_COMMANDS[number];

/**
 * Check if a command is in the allowed list
 */
function isAllowedCommand(command: string): command is AllowedCommand {
  return ALLOWED_COMMANDS.includes(command as AllowedCommand);
}

/**
 * Check if a command is available and get its version
 * Uses execFile instead of exec to prevent command injection
 */
async function checkCommand(
  command: string,
  versionArg = '--version'
): Promise<{ installed: boolean; version?: string }> {
  // Security: Only allow whitelisted commands
  if (!isAllowedCommand(command)) {
    logger.warn('checkCommand: rejected non-whitelisted command', { command });
    return { installed: false };
  }

  try {
    // Use execFile with separate arguments to prevent command injection
    const { stdout } = await execFileAsync(command, [versionArg]);
    const version = stdout.trim().split('\n')[0];
    return { installed: true, version };
  } catch {
    return { installed: false };
  }
}

/**
 * Register System IPC Handlers
 */
export function registerSystemHandlers(): void {
  // Check environment (git, node, pnpm)
  ipcMain.handle('system:checkEnvironment', async (): Promise<IpcResponse<EnvironmentCheckResult>> => {
    try {
      const [git, node, pnpm] = await Promise.all([
        checkCommand('git'),
        checkCommand('node'),
        checkCommand('pnpm'),
      ]);

      return {
        success: true,
        data: { git, node, pnpm },
      };
    } catch (error: unknown) {
      logger.error('checkEnvironment error', { error: getErrorMessage(error) });
      return {
        success: false,
        error: {
          code: 'CHECK_ERROR',
          message: getErrorMessage(error),
        },
      };
    }
  });

  // Check if path is a git repository
  ipcMain.handle('system:checkGitRepo', async (_, inputPath: string): Promise<IpcResponse<GitRepoStatus>> => {
    try {
      // Security: Validate and normalize path
      const path = validatePath(inputPath);

      const gitDir = join(path, '.git');
      const isGitRepo = existsSync(gitDir);

      if (!isGitRepo) {
        return {
          success: true,
          data: { isGitRepo: false, hasRemote: false },
        };
      }

      // Get current branch using execFile (prevents command injection)
      let currentBranch: string | undefined;
      try {
        const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: path });
        currentBranch = stdout.trim();
      } catch (error: unknown) {
        logger.warn('Failed to get current branch', { error: getErrorMessage(error) });
      }

      // Check for remote using execFile
      let hasRemote = false;
      let remoteName: string | undefined;
      let remoteUrl: string | undefined;
      try {
        const { stdout } = await execFileAsync('git', ['remote', '-v'], { cwd: path });
        const lines = stdout.trim().split('\n');
        if (lines.length > 0 && lines[0]) {
          const parts = lines[0].split(/\s+/);
          if (parts.length >= 2) {
            hasRemote = true;
            remoteName = parts[0];
            remoteUrl = parts[1];
          }
        }
      } catch (error: unknown) {
        logger.warn('No remote configured or failed to get remote', { error: getErrorMessage(error) });
      }

      return {
        success: true,
        data: {
          isGitRepo: true,
          hasRemote,
          remoteName,
          remoteUrl,
          currentBranch,
        },
      };
    } catch (error: unknown) {
      logger.error('checkGitRepo error', { error: getErrorMessage(error) });
      return {
        success: false,
        error: {
          code: 'GIT_CHECK_ERROR',
          message: getErrorMessage(error),
        },
      };
    }
  });

  // Initialize git repository
  ipcMain.handle('system:gitInit', async (_, inputPath: string): Promise<IpcResponse<void>> => {
    try {
      // Security: Validate path (allow non-existent for git init, but validate format)
      if (inputPath.includes('\0')) {
        throw new Error('Invalid path: contains null bytes');
      }
      const path = isAbsolute(inputPath) ? inputPath : resolve(process.cwd(), inputPath);

      // Use execFile instead of exec to prevent command injection
      await execFileAsync('git', ['init'], { cwd: path });
      logger.info(`Git repository initialized at: ${path}`);
      return { success: true };
    } catch (error: unknown) {
      logger.error('gitInit error', { error: getErrorMessage(error) });
      return {
        success: false,
        error: {
          code: 'GIT_INIT_ERROR',
          message: getErrorMessage(error),
        },
      };
    }
  });

  logger.info('System handlers registered');
}
