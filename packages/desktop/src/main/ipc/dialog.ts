/**
 * Dialog IPC Handlers
 * Native OS dialogs for file/folder selection
 */

import { ipcMain, dialog, BrowserWindow } from 'electron';
import { createLogger } from '@codecafe/core';
import type { IpcResponse } from './types.js';

const logger = createLogger({ context: 'IPC:Dialog' });

/**
 * Register Dialog IPC Handlers
 */
export function registerDialogHandlers(): void {
  // Select folder using native dialog
  ipcMain.handle('dialog:selectFolder', async (): Promise<IpcResponse<string | null>> => {
    try {
      const window = BrowserWindow.getFocusedWindow();
      if (!window) {
        return {
          success: false,
          error: { code: 'NO_FOCUSED_WINDOW', message: 'No focused window available.' },
        };
      }

      const result = await dialog.showOpenDialog(window, {
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select Project Folder',
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null };
      }

      return { success: true, data: result.filePaths[0] };
    } catch (error: any) {
      logger.error('selectFolder error', { error: error.message });
      return {
        success: false,
        error: {
          code: 'DIALOG_ERROR',
          message: error.message || 'Failed to open folder dialog',
        },
      };
    }
  });

  // Select file using native dialog
  ipcMain.handle(
    'dialog:selectFile',
    async (_, options?: { filters?: { name: string; extensions: string[] }[] }): Promise<IpcResponse<string | null>> => {
      try {
        const window = BrowserWindow.getFocusedWindow();
        if (!window) {
          return {
            success: false,
            error: { code: 'NO_FOCUSED_WINDOW', message: 'No focused window available.' },
          };
        }

        const result = await dialog.showOpenDialog(window, {
          properties: ['openFile'],
          title: 'Select File',
          filters: options?.filters,
        });

        if (result.canceled || result.filePaths.length === 0) {
          return { success: true, data: null };
        }

        return { success: true, data: result.filePaths[0] };
      } catch (error: any) {
        logger.error('selectFile error', { error: error.message });
        return {
          success: false,
          error: {
            code: 'DIALOG_ERROR',
            message: error.message || 'Failed to open file dialog',
          },
        };
      }
    }
  );

  logger.info('Dialog handlers registered');
}
