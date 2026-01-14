import { ipcMain } from 'electron';

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
 * Register Provider IPC Handlers
 */
export function registerProviderHandlers(): void {
  ipcMain.handle('getAvailableProviders', async () =>
    handleIpc(async () => {
      // M2: claude-code, codex 지원
      return [
        { id: 'claude-code', name: 'Claude Code' },
        { id: 'codex', name: 'Codex' },
      ];
    }, 'getAvailableProviders')
  );

  console.log('[IPC] Provider handlers registered');
}
