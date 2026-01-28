/**
 * Electron IPC handlers for orchestrator UI integration
 *
 * This module provides the backend API for Electron to interact with
 * the orchestrator system. It should be registered in the Electron main process.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { safeParseWorkflowYaml } from '@codecafe/core';
import { runWorkflow, resumeWorkflow } from '../cli/commands/run.js';
import { RunStateManager } from '../storage/run-state.js';
import { EventLogger } from '../storage/event-logger.js';
import { setAssignment } from '../cli/commands/assign.js';
import { setProfile } from '../cli/commands/profile.js';
import type { WorkflowInfo, RunProgress, ProviderAssignmentInfo } from './types.js';
import type { ProviderType, StageType, RunState } from '../types.js';

/**
 * Register Electron IPC handlers
 *
 * Call this function in the Electron main process to register all
 * orchestrator-related IPC handlers.
 *
 * Example:
 * ```ts
 * import { ipcMain } from 'electron';
 * import { registerElectronHandlers } from '@codecafe/orchestrator';
 *
 * registerElectronHandlers(ipcMain, '/path/to/.orch');
 * ```
 */
export function registerElectronHandlers(ipcMain: any, orchDir: string): void {
  // Workflow management
  ipcMain.handle('workflow:list', async () => {
    return listWorkflows(orchDir);
  });

  ipcMain.handle('workflow:get', async (_event: any, id: string) => {
    return getWorkflow(orchDir, id);
  });

  ipcMain.handle('workflow:create', async (_event: any, workflowData: WorkflowInfo) => {
    return createWorkflow(orchDir, workflowData);
  });

  ipcMain.handle('workflow:update', async (_event: any, workflowData: WorkflowInfo) => {
    return updateWorkflow(orchDir, workflowData);
  });

  ipcMain.handle('workflow:delete', async (_event: any, id: string) => {
    return deleteWorkflow(orchDir, id);
  });

  ipcMain.handle(
    'workflow:run',
    async (_event: any, id: string, options?: { mode?: string; interactive?: boolean }) => {
      const result = await runWorkflow(id, {
        orchDir,
        mode: (options?.mode as any) || 'auto',
        interactive: options?.interactive || false,
      });
      return result.runId;
    }
  );

  // Run management
  ipcMain.handle('run:list', async () => {
    return listRuns(orchDir);
  });

  ipcMain.handle('run:status', async (_event: any, runId: string) => {
    return getRunStatus(orchDir, runId);
  });

  ipcMain.handle('run:resume', async (_event: any, runId: string) => {
    await resumeWorkflow(runId, { orchDir });
  });

  ipcMain.handle('run:logs', async (_event: any, runId: string) => {
    return getRunLogs(orchDir, runId);
  });

  // Configuration
  ipcMain.handle('config:assignments:get', async () => {
    return getAssignments(orchDir);
  });

  ipcMain.handle(
    'config:assignments:set',
    async (_event: any, stage: StageType, provider: ProviderType, role: string) => {
      setAssignment(stage, provider, role, orchDir);
    }
  );

  ipcMain.handle('config:profiles:list', async (_event: any, stage: StageType) => {
    return listStageProfiles(orchDir, stage);
  });

  ipcMain.handle('config:profiles:set', async (_event: any, stage: StageType, profile: string) => {
    setProfile(stage, profile, orchDir);
  });

  ipcMain.handle('config:roles:list', async () => {
    return listRoles(orchDir);
  });
}

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

function getRunStatus(orchDir: string, runId: string): RunProgress | null {
  const stateManager = new RunStateManager(orchDir);
  const state = stateManager.loadRun(runId);

  if (!state) {
    return null;
  }

  const stages = getWorkflowStages(orchDir, state.workflow);
  return buildRunProgress(state, stages);
}

function listRuns(orchDir: string): RunProgress[] {
  const stateManager = new RunStateManager(orchDir);
  const runs = stateManager.listRuns();

  return runs.map((state) => {
    const stages = getWorkflowStages(orchDir, state.workflow);
    return buildRunProgress(state, stages);
  });
}

function getRunLogs(
  orchDir: string,
  runId: string
): Array<{ type: string; message: string; timestamp: string; stage?: string; nodeId?: string }> {
  const logger = new EventLogger(orchDir, runId);
  const events = logger.readAll();

  return events.map((event) => ({
    type: event.type,
    message: event.error || (event.data ? JSON.stringify(event.data) : ''),
    timestamp: event.timestamp || new Date().toISOString(),
    stage: event.stage,
    nodeId: event.nodeId,
  }));
}

function getAssignments(orchDir: string): ProviderAssignmentInfo[] {
  const configPath = path.join(orchDir, 'config', 'assignments.yml');

  const defaults = [
    { stage: 'plan', provider: 'claude-code', role: 'planner', profile: 'simple' },
    { stage: 'code', provider: 'claude-code', role: 'coder', profile: 'simple' },
    { stage: 'test', provider: 'claude-code', role: 'tester', profile: 'simple' },
    { stage: 'check', provider: 'claude-code', role: 'checker', profile: 'simple' },
  ];

  if (!fs.existsSync(configPath)) {
    return defaults;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = yaml.load(content) as { assignments: Record<string, any> };
    return Object.entries(config.assignments || {}).map(([stage, assignment]) => ({
      stage,
      provider: assignment.provider,
      role: assignment.role,
      profile: assignment.profile,
    }));
  } catch (error) {
    return defaults;
  }
}

function listRoles(orchDir: string): string[] {
  const rolesDir = path.join(orchDir, 'roles');
  if (!fs.existsSync(rolesDir)) {
    return [];
  }

  return fs
    .readdirSync(rolesDir)
    .filter((file) => file.endsWith('.md'))
    .map((file) => file.replace(/\.md$/, ''));
}

function listStageProfiles(orchDir: string, stage: StageType): string[] {
  const stagesDir = path.join(orchDir, 'workflows', 'stages');
  if (!fs.existsSync(stagesDir)) {
    return [];
  }

  const prefix = `${stage}.`;
  return fs
    .readdirSync(stagesDir)
    .filter((file) => file.startsWith(prefix) && file.endsWith('.yml'))
    .map((file) => file.replace(prefix, '').replace(/\.yml$/, ''));
}

function parseWorkflowInfo(filePath: string, id: string): WorkflowInfo | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const raw = yaml.load(content);
    const parseResult = safeParseWorkflowYaml(raw);

    // Use parsed data or raw data with fallback
    const parsed = parseResult.success ? parseResult.data : (raw as Record<string, unknown>);
    const workflow = (parsed?.workflow as Record<string, unknown>) || parsed;

    const stages = Array.isArray(workflow?.stages)
      ? (workflow.stages as string[])
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

function getWorkflowStages(orchDir: string, workflowId: string): string[] {
  const workflowPath = path.join(orchDir, 'workflows', `${workflowId}.workflow.yml`);
  if (!fs.existsSync(workflowPath)) {
    return ['plan', 'code', 'test', 'check'];
  }

  const info = parseWorkflowInfo(workflowPath, workflowId);
  return info?.stages?.length ? info.stages : ['plan', 'code', 'test', 'check'];
}

function buildRunProgress(state: RunState, stages: string[]): RunProgress {
  const stageIndex = stages.indexOf(state.currentStage);
  const stageStatuses = stages.map((stageName, index) => {
    let status: 'pending' | 'running' | 'completed' | 'failed' = 'pending';

    if (state.status === 'completed') {
      status = 'completed';
    } else if (state.status === 'failed' && stageName === state.currentStage) {
      status = 'failed';
    } else if (index < stageIndex) {
      status = 'completed';
    } else if (stageName === state.currentStage) {
      status = 'running';
    }

    return {
      name: stageName,
      status,
    };
  });

  return {
    runId: state.runId,
    workflowId: state.workflow,
    currentStage: state.currentStage,
    currentIter: state.stageIter,
    status: state.status,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    stages: stageStatuses,
    completedNodes: state.completedNodes.flat ? state.completedNodes.flat() : [],
    lastError: state.lastError,
  };
}

// --- New functions for workflow CRUD ---

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

function updateWorkflow(orchDir: string, workflowData: WorkflowInfo): WorkflowInfo {
  const filePath = path.join(orchDir, 'workflows', `${workflowData.id}.workflow.yml`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Workflow with id "${workflowData.id}" not found.`);
  }

  writeWorkflowToFile(filePath, workflowData);
  return workflowData;
}

function deleteWorkflow(orchDir: string, id: string): { success: boolean } {
  const filePath = path.join(orchDir, 'workflows', `${id}.workflow.yml`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  return { success: true };
}

function writeWorkflowToFile(filePath: string, workflowData: WorkflowInfo): void {
  // Use a default 'simple' profile for each stage if not provided
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
