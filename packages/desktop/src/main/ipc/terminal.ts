/**
 * IPC API for Terminal Pool
 * Gap 3 해결: Complete IPC/UI API contracts
 * P1-6: Terminal Pool 상태 조회 및 Metrics API
 * P2-8: Zod validation 추가
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';
import { TerminalPool } from '@codecafe/orchestrator';
import { TerminalPoolConfig, PoolStatus, PoolMetrics, ProviderType } from '@codecafe/core';
import { TerminalPoolConfigSchema } from '@codecafe/core';

export enum TerminalErrorCode {
  NOT_INITIALIZED = 'TERMINAL_NOT_INITIALIZED',
  NOT_FOUND = 'TERMINAL_NOT_FOUND',
  VALIDATION_FAILED = 'TERMINAL_VALIDATION_FAILED',
  POOL_SHUTDOWN = 'TERMINAL_POOL_SHUTDOWN',
  UNKNOWN = 'TERMINAL_UNKNOWN_ERROR',
}

interface ErrorResponse {
  success: false;
  error: {
    code: TerminalErrorCode;
    message: string;
    details?: any;
  };
}

interface SuccessResponse<T = void> {
  success: true;
  data?: T;
}

type IpcResponse<T = void> = SuccessResponse<T> | ErrorResponse;

let pool: TerminalPool | null = null;

// Helper function to create error response
function createErrorResponse(
  code: TerminalErrorCode,
  message: string,
  details?: any
): ErrorResponse {
  return {
    success: false,
    error: { code, message, details },
  };
}

// Helper function to create success response
function createSuccessResponse<T>(data?: T): SuccessResponse<T> {
  return { success: true, data };
}

function withTerminalPool<T>(
  handler: (pool: TerminalPool) => Promise<T> | T,
  { errorMessage }: { errorMessage: string }
): (event: IpcMainInvokeEvent) => Promise<IpcResponse<T>> {
  return async () => {
    if (!pool) {
      return createErrorResponse(TerminalErrorCode.NOT_INITIALIZED, 'Terminal pool not initialized');
    }
    try {
      const result = await handler(pool);
      return createSuccessResponse(result);
    } catch (error) {
      return createErrorResponse(
        TerminalErrorCode.UNKNOWN,
        errorMessage,
        error instanceof Error ? error.message : String(error)
      );
    }
  };
}

/**
 * Register Terminal IPC handlers
 */
export function registerTerminalHandlers() {
  // terminal:init - Initialize terminal pool
  ipcMain.handle('terminal:init', async (_: IpcMainInvokeEvent, config: unknown): Promise<IpcResponse<void>> => {
    try {
      const validConfig = TerminalPoolConfigSchema.parse(config);

      if (pool) {
        await pool.dispose();
      }

      pool = new TerminalPool(validConfig);

      return createSuccessResponse();
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return createErrorResponse(
          TerminalErrorCode.VALIDATION_FAILED,
          'Invalid terminal pool configuration',
          error.errors
        );
      }
      return createErrorResponse(
        TerminalErrorCode.UNKNOWN,
        'Failed to initialize terminal pool',
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  // terminal:pool-status - Get pool status (per-provider status)
  ipcMain.handle(
    'terminal:pool-status',
    withTerminalPool(p => p.getStatus(), {
      errorMessage: 'Failed to get pool status',
    })
  );

  // terminal:pool-metrics - Get pool metrics
  ipcMain.handle(
    'terminal:pool-metrics',
    withTerminalPool(p => p.getMetrics(), {
      errorMessage: 'Failed to get pool metrics',
    })
  );

  // terminal:shutdown - Shutdown terminal pool
  ipcMain.handle(
    'terminal:shutdown',
    withTerminalPool(
      async p => {
        await p.dispose();
        pool = null;
      },
      { errorMessage: 'Failed to shutdown terminal pool' }
    )
  );
}

/**
 * Get singleton Terminal Pool instance (for internal use)
 */
export function getTerminalPool(): TerminalPool | null {
  return pool;
}