/**
 * System IPC Handlers
 * Environment checks and system setup utilities
 */

import { ipcMain } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';
import { createLogger, getErrorMessage } from '@codecafe/core';
import type { IpcResponse } from './types.js';

const logger = createLogger({ context: 'IPC:System' });

const execAsync = promisify(exec);

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
 * Check if a command is available and get its version
 */
async function checkCommand(
  command: string,
  versionArg = '--version'
): Promise<{ installed: boolean; version?: string }> {
  try {
    const { stdout } = await execAsync(`${command} ${versionArg}`);
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
  ipcMain.handle('system:checkGitRepo', async (_, path: string): Promise<IpcResponse<GitRepoStatus>> => {
    try {
      const gitDir = join(path, '.git');
      const isGitRepo = existsSync(gitDir);

      if (!isGitRepo) {
        return {
          success: true,
          data: { isGitRepo: false, hasRemote: false },
        };
      }

      // Get current branch
      let currentBranch: string | undefined;
      try {
        const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: path });
        currentBranch = stdout.trim();
      } catch (error: unknown) {
        logger.warn('Failed to get current branch', { error: getErrorMessage(error) });
      }

      // Check for remote
      let hasRemote = false;
      let remoteName: string | undefined;
      let remoteUrl: string | undefined;
      try {
        const { stdout } = await execAsync('git remote -v', { cwd: path });
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
  ipcMain.handle('system:gitInit', async (_, path: string): Promise<IpcResponse<void>> => {
    try {
      await execAsync('git init', { cwd: path });
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
