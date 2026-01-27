import { ipcMain } from 'electron';
import { createLogger } from '@codecafe/core';

const logger = createLogger({ context: 'IPC:Provider' });

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
    logger.error(`Error in ${context}`, { error: error instanceof Error ? error.message : String(error) });
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

  logger.info('Provider handlers registered');
}
