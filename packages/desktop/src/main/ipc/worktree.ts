import { ipcMain, shell } from 'electron';
import { WorktreeManager } from '@codecafe/git-worktree';

/**
 * Standardized IPC handler wrapper
 */
async function handleIpc<T>(
  handler: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await handler();
  } catch (error) {
    console.error(`[IPC] Error in ${context}:`, error);
    throw error;
  }
}

/**
 * Register Worktree IPC Handlers
 */
export function registerWorktreeHandlers(): void {
  ipcMain.handle('listWorktrees', async (_, repoPath: string) =>
    handleIpc(async () => {
      const worktrees = await WorktreeManager.listWorktrees(repoPath);
      return { success: true, data: worktrees };
    }, 'listWorktrees')
  );

  ipcMain.handle(
    'exportPatch',
    async (_, worktreePath: string, baseBranch: string, outputPath?: string) =>
      handleIpc(async () => {
        const patchPath = await WorktreeManager.exportPatch({
          worktreePath,
          baseBranch,
          outputPath,
        });
        return { success: true, data: patchPath };
      }, 'exportPatch')
  );

  ipcMain.handle('removeWorktree', async (_, worktreePath: string, repoPath: string, force?: boolean) =>
    handleIpc(async () => {
      await WorktreeManager.removeWorktree({ worktreePath, repoPath, force });
      return { success: true };
    }, 'removeWorktree')
  );

  ipcMain.handle('openWorktreeFolder', async (_, worktreePath: string) =>
    handleIpc(async () => {
      await shell.openPath(worktreePath);
      return { success: true };
    }, 'openWorktreeFolder')
  );

  console.log('[IPC] Worktree handlers registered');
}
