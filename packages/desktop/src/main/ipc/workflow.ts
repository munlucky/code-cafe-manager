/**
 * Workflow IPC Handlers
 * Wraps orchestrator workflow functions with standardized IpcResponse format
 */

import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

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
 * Workflow Info 타입
 */
interface WorkflowInfo {
  id: string;
  name: string;
  description?: string;
  stages: string[];
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

  writeWorkflowToFile(filePath, workflowData);
  return workflowData;
}

/**
 * Delete a workflow
 */
function deleteWorkflow(orchDir: string, id: string): { success: boolean } {
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

    return {
      id,
      name,
      description,
      stages,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Write workflow to YAML file
 */
function writeWorkflowToFile(filePath: string, workflowData: WorkflowInfo): void {
  const stageProfiles = workflowData.stages.reduce(
    (acc, stage) => ({ ...acc, [stage]: 'simple' }),
    {}
  );

  const yamlData = {
    workflow: {
      name: workflowData.name,
      description: workflowData.description,
      stages: workflowData.stages,
    },
    ...stageProfiles,
  };

  const content = yaml.dump(yamlData);
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Register Workflow IPC Handlers
 */
export function registerWorkflowHandlers(): void {
  const orchDir = getOrchDir();

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

  console.log('[IPC] Workflow handlers registered');
}
