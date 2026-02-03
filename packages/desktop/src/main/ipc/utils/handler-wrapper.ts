/**
 * IPC Handler Wrapper Utilities
 * Standardized IPC response handling and error management
 */

import { ipcMain } from 'electron';
import { toCodeCafeError } from '@codecafe/core';

/**
 * IPC Response type
 */
export interface IpcResponse<T = void> {
  success: boolean;
  data?: T;
  error?: IpcError;
}

/**
 * IPC Error type
 */
export interface IpcError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Standardized IPC handler wrapper
 * Provides consistent error handling and response formatting
 */
export async function handleIpc<T>(
  handler: () => Promise<T> | T,
  context: string
): Promise<IpcResponse<T>> {
  try {
    const data = await handler();
    return { success: true, data };
  } catch (error: unknown) {
    const cafeError = toCodeCafeError(error);
    return {
      success: false,
      error: {
        code: cafeError.code,
        message: cafeError.message,
        details: cafeError.details,
      },
    };
  }
}

/**
 * Helper to register IPC handler with standard error handling
 */
export function createIpcHandler<T extends unknown[], TResult>(
  channel: string,
  handler: (...args: T) => Promise<TResult> | TResult
): void {
  ipcMain.handle(channel, async (_, ...args) =>
    handleIpc(async () => handler(...args as T), channel)
  );
}
