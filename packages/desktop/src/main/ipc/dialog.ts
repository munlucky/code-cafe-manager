/**
 * Dialog IPC Handlers
 * Native OS dialogs for file/folder selection
 */

import { ipcMain, dialog, BrowserWindow } from 'electron';

interface IpcResponse<T = void> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Register Dialog IPC Handlers
 */
export function registerDialogHandlers(): void {
  // Select folder using native dialog
  ipcMain.handle('dialog:selectFolder', async (): Promise<IpcResponse<string | null>> => {
    try {
      const window = BrowserWindow.getFocusedWindow();
      const result = await dialog.showOpenDialog(window!, {
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select Project Folder',
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, data: null };
      }

      return { success: true, data: result.filePaths[0] };
    } catch (error: any) {
      console.error('[Dialog] selectFolder error:', error);
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
        const result = await dialog.showOpenDialog(window!, {
          properties: ['openFile'],
          title: 'Select File',
          filters: options?.filters,
        });

        if (result.canceled || result.filePaths.length === 0) {
          return { success: true, data: null };
        }

        return { success: true, data: result.filePaths[0] };
      } catch (error: any) {
        console.error('[Dialog] selectFile error:', error);
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

  console.log('[IPC] Dialog handlers registered');
}
