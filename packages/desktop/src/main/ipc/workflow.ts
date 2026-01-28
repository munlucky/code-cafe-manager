/**
 * Workflow IPC Handlers
 * Wraps WorkflowService with standardized IpcResponse format
 */

import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import {
  createLogger,
  toCodeCafeError,
} from '@codecafe/core';
import type { WorkflowInfo } from '@codecafe/core';
import { WorkflowExecutor, WorkflowRun, ExecutionMode } from '@codecafe/orchestrator';
import { WorkflowService } from '../services/workflow-service.js';

const logger = createLogger({ context: 'IPC:Workflow' });

/**
 * IPC Response type
 */
interface IpcResponse<T = void> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Standardized IPC handler wrapper
 */
async function handleIpc<T>(
  handler: () => Promise<T> | T,
  context: string
): Promise<IpcResponse<T>> {
  try {
    const data = await handler();
    return {
      success: true,
      data,
    };
  } catch (error: unknown) {
    const cafeError = toCodeCafeError(error);
    logger.error(`Error in ${context}`, { error: cafeError.message });

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
 * Register Workflow IPC Handlers
 */
export function registerWorkflowHandlers(): void {
  // Initialize WorkflowService
  const workflowService = new WorkflowService();
  const orchDir = workflowService.getOrchDir();

  logger.debug('Initializing workflow handlers', {
    orchDir,
    cwd: process.cwd()
  });

  // =============================================
  // Workflow CRUD Handlers
  // =============================================

  /**
   * List all workflows
   */
  ipcMain.handle('workflow:list', async () =>
    handleIpc(async () => {
      return workflowService.listWorkflows();
    }, 'workflow:list')
  );

  /**
   * Get a single workflow
   */
  ipcMain.handle('workflow:get', async (_, id: string) =>
    handleIpc(async () => {
      const workflow = workflowService.getWorkflow(id);
      if (!workflow) {
        throw new Error(`Workflow not found: ${id}`);
      }
      return workflow;
    }, 'workflow:get')
  );

  /**
   * Create a new workflow
   */
  ipcMain.handle('workflow:create', async (_, workflowData: WorkflowInfo) =>
    handleIpc(async () => {
      return workflowService.createWorkflow(workflowData);
    }, 'workflow:create')
  );

  /**
   * Update an existing workflow
   */
  ipcMain.handle('workflow:update', async (_, workflowData: WorkflowInfo) =>
    handleIpc(async () => {
      return workflowService.updateWorkflow(workflowData);
    }, 'workflow:update')
  );

  /**
   * Delete a workflow
   */
  ipcMain.handle('workflow:delete', async (_, id: string) =>
    handleIpc(async () => {
      return workflowService.deleteWorkflow(id);
    }, 'workflow:delete')
  );

  // =============================================
  // Run Management Handlers
  // =============================================

  // Shared executor instance
  let executorInstance: WorkflowExecutor | null = null;

  function getExecutor(): WorkflowExecutor {
    if (!executorInstance) {
      executorInstance = new WorkflowExecutor(orchDir);
    }
    return executorInstance;
  }

  // Event listeners for run state changes
  const runEventListeners: Set<(event: { type: string; run?: WorkflowRun; [key: string]: unknown }) => void> = new Set();

  /**
   * Notify all registered listeners
   */
  function notifyListeners(event: { type: string; run?: WorkflowRun; [key: string]: unknown }): void {
    for (const listener of runEventListeners) {
      try {
        listener(event);
      } catch (e) {
        logger.error('Error notifying run event listener', { error: String(e) });
      }
    }
  }

  /**
   * Run a workflow
   */
  ipcMain.handle('workflow:run', async (_, workflowId: string, options?: { mode?: ExecutionMode; vars?: Record<string, string> }) =>
    handleIpc(async () => {
      const executor = getExecutor();
      const runId = await executor.start(workflowId, {
        orchDir,
        mode: options?.mode,
        vars: options?.vars || {},
        onStateChange: (run: WorkflowRun) => {
          notifyListeners({ type: 'stateChange', run });
        },
        onEvent: (event: { type: string; [key: string]: unknown }) => {
          notifyListeners(event);
        },
      });
      return { runId };
    }, 'workflow:run')
  );

  /**
   * List all active runs
   */
  ipcMain.handle('run:list', async () =>
    handleIpc(async () => {
      const executor = getExecutor();
      const runs = executor.listRuns();
      return runs.map((run: WorkflowRun) => ({
        runId: run.runId,
        workflowId: run.workflowId,
        currentStage: run.currentStage,
        currentIter: run.iteration,
        status: run.status,
        createdAt: run.startedAt,
        updatedAt: run.completedAt || run.startedAt,
        completedNodes: [],
        lastError: run.lastError,
      }));
    }, 'run:list')
  );

  /**
   * Get run status
   */
  ipcMain.handle('run:getStatus', async (_, runId: string) =>
    handleIpc(async () => {
      const executor = getExecutor();
      const run = executor.getRun(runId);
      if (!run) {
        return null;
      }
      return {
        runId: run.runId,
        workflowId: run.workflowId,
        currentStage: run.currentStage,
        currentIter: run.iteration,
        status: run.status,
        createdAt: run.startedAt,
        updatedAt: run.completedAt || run.startedAt,
        completedNodes: [],
        lastError: run.lastError,
      };
    }, 'run:getStatus')
  );

  /**
   * Get run detail
   */
  ipcMain.handle('run:getDetail', async (_, runId: string) =>
    handleIpc(async () => {
      const executor = getExecutor();
      const run = executor.getRun(runId);
      if (!run) {
        return null;
      }
      return {
        runId: run.runId,
        workflowId: run.workflowId,
        status: run.status,
        currentStage: run.currentStage,
        iteration: run.iteration,
        context: run.context,
        stageResults: Object.fromEntries(run.stageResults),
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        lastError: run.lastError,
      };
    }, 'run:getDetail')
  );

  /**
   * Pause a run
   */
  ipcMain.handle('run:pause', async (_, runId: string) =>
    handleIpc(async () => {
      const executor = getExecutor();
      const success = executor.pause(runId);
      if (!success) {
        throw new Error(`Failed to pause run: ${runId}`);
      }
    }, 'run:pause')
  );

  /**
   * Resume a run
   */
  ipcMain.handle('run:resume', async (_, runId: string) =>
    handleIpc(async () => {
      const executor = getExecutor();
      const success = executor.resume(runId, {
        orchDir,
        onStateChange: (run: WorkflowRun) => {
          notifyListeners({ type: 'stateChange', run });
        },
        onEvent: (event: { type: string; [key: string]: unknown }) => {
          notifyListeners(event);
        },
      });
      if (!success) {
        throw new Error(`Failed to resume run: ${runId}`);
      }
    }, 'run:resume')
  );

  /**
   * Cancel a run
   */
  ipcMain.handle('run:cancel', async (_, runId: string) =>
    handleIpc(async () => {
      const executor = getExecutor();
      const success = executor.cancel(runId);
      if (!success) {
        throw new Error(`Failed to cancel run: ${runId}`);
      }
    }, 'run:cancel')
  );

  /**
   * Get run logs
   */
  ipcMain.handle('run:getLogs', async (_, runId: string) =>
    handleIpc(async () => {
      const runEventsPath = path.join(orchDir, 'runs', runId, 'events.jsonl');
      if (!fs.existsSync(runEventsPath)) {
        return [];
      }

      const content = fs.readFileSync(runEventsPath, 'utf-8');
      return content
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter((event): event is Record<string, unknown> => event !== null)
        .map((event) => ({
          type: event.type,
          message: event.error || `${event.type}${event.nodeId ? `: ${event.nodeId}` : ''}${event.stage ? ` (${event.stage})` : ''}`,
          timestamp: event.timestamp,
          stage: event.stage,
          nodeId: event.nodeId,
        }));
    }, 'run:getLogs')
  );

  /**
   * Subscribe to run events
   */
  ipcMain.on('run:subscribe', (event) => {
    const webContents = event.sender;
    const listener = (data: { type: string; [key: string]: unknown }) => {
      try {
        webContents.send('run:event', data);
      } catch {
        // WebContents might be destroyed
      }
    };
    runEventListeners.add(listener);

    // Remove listener when webContents is destroyed
    webContents.once('destroyed', () => {
      runEventListeners.delete(listener);
    });
  });

  logger.info('Workflow handlers registered');
}
