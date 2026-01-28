/**
 * Workflow IPC Handlers
 * Wraps WorkflowService with standardized IpcResponse format
 */

import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { createLogger, toCodeCafeError } from '@codecafe/core';
import type { WorkflowInfo } from '@codecafe/core';
import { WorkflowExecutor, WorkflowRun, ExecutionMode } from '@codecafe/orchestrator';
import { WorkflowService } from '../../services/workflow-service.js';

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
    return { success: true, data };
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
 * Helper to register IPC handler
 */
function registerHandler<T extends unknown[], R>(
  channel: string,
  handler: (...args: T) => Promise<R> | R
): void {
  ipcMain.handle(channel, async (_, ...args) => handleIpc(async () => handler(...args as T), channel));
}

// Run management state
let executorInstance: WorkflowExecutor | null = null;
const runEventListeners: Set<(event: { type: string; run?: WorkflowRun; [key: string]: unknown }) => void> = new Set();

function getExecutor(orchDir: string): WorkflowExecutor {
  if (!executorInstance) {
    executorInstance = new WorkflowExecutor(orchDir);
  }
  return executorInstance;
}

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
 * Register Workflow IPC Handlers
 */
export function registerWorkflowHandlers(): void {
  const workflowService = new WorkflowService();
  const orchDir = workflowService.getOrchDir();

  logger.debug('Initializing workflow handlers', { orchDir, cwd: process.cwd() });

  // Workflow CRUD
  registerHandler('workflow:list', () => workflowService.listWorkflows());
  registerHandler('workflow:get', (id: string) => {
    const workflow = workflowService.getWorkflow(id);
    if (!workflow) {
      throw new Error(`Workflow not found: ${id}`);
    }
    return workflow;
  });
  registerHandler('workflow:create', (workflowData: WorkflowInfo) =>
    workflowService.createWorkflow(workflowData)
  );
  registerHandler('workflow:update', (workflowData: WorkflowInfo) =>
    workflowService.updateWorkflow(workflowData)
  );
  registerHandler('workflow:delete', (id: string) => workflowService.deleteWorkflow(id));

  // Run operations
  registerHandler(
    'workflow:run',
    (workflowId: string, options?: { mode?: ExecutionMode; vars?: Record<string, string> }) => {
      const executor = getExecutor(orchDir);
      return executor.start(workflowId, {
        orchDir,
        mode: options?.mode,
        vars: options?.vars || {},
        onStateChange: (run: WorkflowRun) => notifyListeners({ type: 'stateChange', run }),
        onEvent: (event: { type: string; [key: string]: unknown }) => notifyListeners(event),
      }).then((runId) => ({ runId }));
    }
  );

  registerHandler('run:list', () => {
    const executor = getExecutor(orchDir);
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
  });

  registerHandler('run:getStatus', (runId: string) => {
    const executor = getExecutor(orchDir);
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
  });

  registerHandler('run:getDetail', (runId: string) => {
    const executor = getExecutor(orchDir);
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
  });

  registerHandler('run:pause', (runId: string) => {
    const executor = getExecutor(orchDir);
    const success = executor.pause(runId);
    if (!success) {
      throw new Error(`Failed to pause run: ${runId}`);
    }
  });

  registerHandler('run:resume', (runId: string) => {
    const executor = getExecutor(orchDir);
    const success = executor.resume(runId, {
      orchDir,
      onStateChange: (run: WorkflowRun) => notifyListeners({ type: 'stateChange', run }),
      onEvent: (event: { type: string; [key: string]: unknown }) => notifyListeners(event),
    });
    if (!success) {
      throw new Error(`Failed to resume run: ${runId}`);
    }
  });

  registerHandler('run:cancel', (runId: string) => {
    const executor = getExecutor(orchDir);
    const success = executor.cancel(runId);
    if (!success) {
      throw new Error(`Failed to cancel run: ${runId}`);
    }
  });

  registerHandler('run:getLogs', (runId: string) => {
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
        message:
          event.error ||
          `${event.type}${event.nodeId ? `: ${event.nodeId}` : ''}${event.stage ? ` (${event.stage})` : ''}`,
        timestamp: event.timestamp,
        stage: event.stage,
        nodeId: event.nodeId,
      }));
  });

  // Event subscription (uses ipcMain.on, not ipcMain.handle)
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
