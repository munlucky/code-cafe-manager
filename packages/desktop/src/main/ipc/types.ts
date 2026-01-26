/**
 * Common IPC Types
 * Shared type definitions for IPC handlers
 */

export interface IpcResponse<T = void> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
