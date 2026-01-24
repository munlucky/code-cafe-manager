/**
 * Workflow IPC Handlers
 * Wraps orchestrator workflow functions with standardized IpcResponse format
 */

import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { WorkflowExecutor, WorkflowRun } from '@codecafe/orchestrator';
import type { WorkflowExecutionOptions } from '@codecafe/orchestrator';

/**
 * IPC Response 타입
 */
interface IpcResponse<T = void> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Stage Assignment 타입
 */
interface StageAssignment {
  provider: string;
  role?: string;
  profile?: string;
  /** Execution mode: sequential (default) or parallel */
  mode?: 'sequential' | 'parallel';
  /** Failure handling strategy */
  on_failure?: 'stop' | 'continue' | 'retry';
  /** Number of retries when on_failure is 'retry' */
  retries?: number;
  /** Backoff multiplier in seconds for retries */
  retry_backoff?: number;
  /** List of skill names to use */
  skills?: string[];
  /** Custom prompt template for this stage */
  prompt?: string;
}

/**
 * Workflow Info 타입
 */
interface WorkflowInfo {
  id: string;
  name: string;
  description?: string;
  stages: string[];
  // Stage별 provider 설정 (workflow 내에 정의된 경우)
  stageConfigs?: Record<string, StageAssignment>;
  // 기본 레시피 여부
  isDefault?: boolean;
  // 삭제/수정 보호 여부
  protected?: boolean;
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
  } catch (error: any) {
    console.error(`[IPC] Error in ${context}:`, error);

    return {
      success: false,
      error: {
        code: error.code || 'UNKNOWN',
        message: error.message || 'Unknown error',
        details: error.details,
      },
    };
  }
}

/**
 * Get orchestrator directory
 */
function getOrchDir(): string {
  const envDir = process.env.CODECAFE_ORCH_DIR;
  if (envDir && fs.existsSync(envDir)) {
    return envDir;
  }

  const candidates = [
    process.cwd(),
    path.join(process.cwd(), '.orch'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return path.join(process.cwd(), '.orch');
}

/**
 * List all workflows
 */
function listWorkflows(orchDir: string): WorkflowInfo[] {
  const workflowsDir = path.join(orchDir, 'workflows');
  console.log('[DEBUG] Listing workflows from:', workflowsDir);

  if (!fs.existsSync(workflowsDir)) {
    return [];
  }

  const files = fs.readdirSync(workflowsDir);
  const workflowFiles = files.filter((file: string) => file.endsWith('.workflow.yml'));

  return workflowFiles.map((file: string) => {
    const id = file.replace('.workflow.yml', '');
    const info = parseWorkflowInfo(path.join(workflowsDir, file), id);
    if (info) {
      return info;
    }
    return {
      id,
      name: id.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      description: `Workflow: ${id}`,
      stages: ['plan', 'code', 'test', 'check'],
    };
  });
}

/**
 * Get a single workflow
 */
function getWorkflow(orchDir: string, id: string): WorkflowInfo | null {
  const workflowPath = path.join(orchDir, 'workflows', `${id}.workflow.yml`);

  if (!fs.existsSync(workflowPath)) {
    return null;
  }

  const parsed = parseWorkflowInfo(workflowPath, id);
  if (parsed) {
    return parsed;
  }

  return {
    id,
    name: id.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
    description: `Workflow: ${id}`,
    stages: ['plan', 'code', 'test', 'check'],
  };
}

/**
 * Create a new workflow
 */
function createWorkflow(orchDir: string, workflowData: WorkflowInfo): WorkflowInfo {
  const workflowsDir = path.join(orchDir, 'workflows');
  if (!fs.existsSync(workflowsDir)) {
    fs.mkdirSync(workflowsDir, { recursive: true });
  }

  const filePath = path.join(workflowsDir, `${workflowData.id}.workflow.yml`);
  if (fs.existsSync(filePath)) {
    throw new Error(`Workflow with id "${workflowData.id}" already exists.`);
  }

  writeWorkflowToFile(filePath, workflowData);
  return workflowData;
}

/**
 * Update an existing workflow
 */
function updateWorkflow(orchDir: string, workflowData: WorkflowInfo): WorkflowInfo {
  const filePath = path.join(orchDir, 'workflows', `${workflowData.id}.workflow.yml`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Workflow with id "${workflowData.id}" not found.`);
  }

  // Check if workflow is protected
  const existingWorkflow = getWorkflow(orchDir, workflowData.id);
  if (existingWorkflow?.protected) {
    throw new Error(`Cannot modify protected workflow: ${workflowData.id}`);
  }

  console.log('[DEBUG] updateWorkflow received:', JSON.stringify(workflowData, null, 2));
  
  writeWorkflowToFile(filePath, workflowData);
  
  // Return freshly parsed data from file to ensure consistency
  const freshData = parseWorkflowInfo(filePath, workflowData.id);
  if (freshData) {
    console.log('[DEBUG] updateWorkflow returning:', JSON.stringify(freshData, null, 2));
    return freshData;
  }
  
  return workflowData;
}

/**
 * Delete a workflow
 */
function deleteWorkflow(orchDir: string, id: string): { success: boolean } {
  // Check if workflow is protected
  const workflow = getWorkflow(orchDir, id);
  if (workflow?.protected) {
    throw new Error(`Cannot delete protected workflow: ${id}`);
  }
  
  const filePath = path.join(orchDir, 'workflows', `${id}.workflow.yml`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  return { success: true };
}

/**
 * Parse workflow info from YAML file
 */
function parseWorkflowInfo(filePath: string, id: string): WorkflowInfo | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = yaml.load(content) as any;
    const workflow = parsed?.workflow || parsed;
    const stages = Array.isArray(workflow?.stages)
      ? workflow.stages
      : ['plan', 'code', 'test', 'check'];
    const name =
      (typeof workflow?.name === 'string' && workflow.name) ||
      id.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    const description =
      (typeof workflow?.description === 'string' && workflow.description) || `Workflow: ${id}`;

    console.log('[parseWorkflowInfo] Parsing workflow:', { filePath, id, stages });

    // Stage별 provider/role/profile 설정 파싱 (new fields 포함)
    // 주의: stage 설정은 workflow 객체 바깥(root level)에 있음
    const stageConfigs: Record<string, StageAssignment> = {};
    for (const stage of stages) {
      const stageConfig = parsed?.[stage];
      if (stageConfig && typeof stageConfig === 'object') {
        const skills = (stageConfig as any).skills;
        console.log('[parseWorkflowInfo] Stage config:', { stage, skills, stageConfig });
        stageConfigs[stage] = {
          provider: (stageConfig as any).provider || 'claude-code',
          role: (stageConfig as any).role,
          profile: (stageConfig as any).profile || (stageConfig as any).toString?.() || 'simple',
          mode: (stageConfig as any).mode,
          on_failure: (stageConfig as any).on_failure,
          retries: (stageConfig as any).retries,
          retry_backoff: (stageConfig as any).retry_backoff,
          skills: skills,
          prompt: (stageConfig as any).prompt,
        };
      } else if (typeof stageConfig === 'string') {
        // 기존 방식: stage: profile 형식
        stageConfigs[stage] = {
          provider: 'claude-code',
          profile: stageConfig,
        };
      }
    }

    console.log('[parseWorkflowInfo] Parsed stageConfigs:', Object.keys(stageConfigs));

    return {
      id,
      name,
      description,
      stages,
      stageConfigs: Object.keys(stageConfigs).length > 0 ? stageConfigs : undefined,
      isDefault: workflow?.isDefault === true,
      protected: workflow?.protected === true,
    };
  } catch (error) {
    console.error('[parseWorkflowInfo] Error parsing workflow:', error);
    return null;
  }
}

/**
 * Write workflow to YAML file
 */
function writeWorkflowToFile(filePath: string, workflowData: WorkflowInfo): void {
  const assignments = workflowData.stageConfigs || {};

  const stageConfigs = workflowData.stages.reduce((acc, stage) => {
    const config = assignments[stage];
    if (config) {
      const cleanConfig = Object.fromEntries(
        Object.entries(config).filter(([_, v]) => v !== undefined)
      );
      return { ...acc, [stage]: cleanConfig };
    }
    return { ...acc, [stage]: 'simple' };
  }, {});

  const yamlData = {
    workflow: {
      name: workflowData.name,
      description: workflowData.description,
      stages: workflowData.stages,
    },
    ...stageConfigs,
  };

  const content = yaml.dump(yamlData);
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Register Workflow IPC Handlers
 */
export function registerWorkflowHandlers(): void {
  const orchDir = getOrchDir();
  console.log('[DEBUG] orchDir resolved to:', orchDir);
  console.log('[DEBUG] process.cwd():', process.cwd());

  /**
   * List all workflows
   */
  ipcMain.handle('workflow:list', async () =>
    handleIpc(async () => {
      return listWorkflows(orchDir);
    }, 'workflow:list')
  );

  /**
   * Get a single workflow
   */
  ipcMain.handle('workflow:get', async (_, id: string) =>
    handleIpc(async () => {
      const workflow = getWorkflow(orchDir, id);
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
      return createWorkflow(orchDir, workflowData);
    }, 'workflow:create')
  );

  /**
   * Update an existing workflow
   */
  ipcMain.handle('workflow:update', async (_, workflowData: WorkflowInfo) =>
    handleIpc(async () => {
      return updateWorkflow(orchDir, workflowData);
    }, 'workflow:update')
  );

  /**
   * Delete a workflow
   */
  ipcMain.handle('workflow:delete', async (_, id: string) =>
    handleIpc(async () => {
      return deleteWorkflow(orchDir, id);
    }, 'workflow:delete')
  );

  // =============================================
  // Run Management Handlers
  // =============================================

  // Create a shared executor instance
  let executorInstance: WorkflowExecutor | null = null;

  function getExecutor(): WorkflowExecutor {
    if (!executorInstance) {
      executorInstance = new WorkflowExecutor(orchDir);
    }
    return executorInstance;
  }

  // Event listeners for run state changes
  const runEventListeners: Set<(event: { type: string; run?: WorkflowRun; [key: string]: any }) => void> = new Set();

  /**
   * Run a workflow
   */
  ipcMain.handle('workflow:run', async (_, workflowId: string, options?: any) =>
    handleIpc(async () => {
      const executor = getExecutor();
      const runId = await executor.start(workflowId, {
        orchDir,
        mode: options?.mode,
        vars: options?.vars || {},
        onStateChange: (run: WorkflowRun) => {
          // Notify all listeners
          for (const listener of runEventListeners) {
            try {
              listener({ type: 'stateChange', run });
            } catch (e) {
              console.error('Error notifying run event listener:', e);
            }
          }
        },
        onEvent: (event: any) => {
          // Notify all listeners
          for (const listener of runEventListeners) {
            try {
              listener(event);
            } catch (e) {
              console.error('Error notifying run event listener:', e);
            }
          }
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
          for (const listener of runEventListeners) {
            try {
              listener({ type: 'stateChange', run });
            } catch (e) {
              console.error('Error notifying run event listener:', e);
            }
          }
        },
        onEvent: (event: any) => {
          for (const listener of runEventListeners) {
            try {
              listener(event);
            } catch (e) {
              console.error('Error notifying run event listener:', e);
            }
          }
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
        .filter((event): event is any => event !== null)
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
    const listener = (data: any) => {
      try {
        webContents.send('run:event', data);
      } catch (e) {
        // WebContents might be destroyed
      }
    };
    runEventListeners.add(listener);

    // Remove listener when webContents is destroyed
    webContents.once('destroyed', () => {
      runEventListeners.delete(listener);
    });
  });

  console.log('[IPC] Workflow handlers registered');
}
