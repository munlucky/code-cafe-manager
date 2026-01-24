import { ipcMain, shell } from 'electron';
import { WorktreeManager, WorktreeMergeOptions } from '@codecafe/git-worktree';

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

  /**
   * Worktree 브랜치를 대상 브랜치에 병합
   */
  ipcMain.handle(
    'worktree:mergeToTarget',
    async (_, options: WorktreeMergeOptions) =>
      handleIpc(() => WorktreeManager.mergeToTarget(options), 'worktree:mergeToTarget')
  );

  /**
   * Worktree만 삭제하고 브랜치/커밋 내역은 유지
   * Order 작업 내역을 보존하면서 worktree 디렉터리만 정리
   */
  ipcMain.handle(
    'worktree:removeOnly',
    async (_, worktreePath: string, repoPath: string) =>
      handleIpc(() => WorktreeManager.removeWorktreeOnly(worktreePath, repoPath), 'worktree:removeOnly')
  );

  console.log('[IPC] Worktree handlers registered');
}
