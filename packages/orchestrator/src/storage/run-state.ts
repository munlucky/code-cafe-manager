import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '@codecafe/core';
import { RunState, StageType } from '../types';

const logger = createLogger({ context: 'RunStateManager' });

export interface CreateRunOptions {
  workflow: string;
  initialStage: StageType;
  runId?: string;
}

export class RunStateManager {
  private runsDir: string;

  constructor(orchDir: string = path.join(process.cwd(), '.orch')) {
    this.runsDir = path.join(orchDir, 'runs');
  }

  async createRun(options: CreateRunOptions): Promise<RunState> {
    this.ensureRunsDir();

    let runId = options.runId;
    if (!runId) {
      const { nanoid } = await import('nanoid');
      runId = nanoid();
    }
    
    const now = new Date().toISOString();

    const state: RunState = {
      runId,
      workflow: options.workflow,
      currentStage: options.initialStage,
      stageIter: 0,
      completedNodes: [],
      status: 'running',
      createdAt: now,
      updatedAt: now,
    };

    const runDir = this.getRunDir(runId);
    fs.mkdirSync(runDir, { recursive: true });
    this.saveRun(state);

    return state;
  }

  loadRun(runId: string): RunState | null {
    const statePath = this.getStatePath(runId);
    if (!fs.existsSync(statePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(statePath, 'utf-8');
      return JSON.parse(content) as RunState;
    } catch (error) {
      logger.error(`Failed to load run state: ${statePath}`, { error });
      return null;
    }
  }

  saveRun(state: RunState): void {
    const runDir = this.getRunDir(state.runId);
    if (!fs.existsSync(runDir)) {
      fs.mkdirSync(runDir, { recursive: true });
    }

    const statePath = this.getStatePath(state.runId);
    const updated: RunState = {
      ...state,
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(statePath, JSON.stringify(updated, null, 2), 'utf-8');
  }

  updateRun(runId: string, updates: Partial<RunState>): RunState {
    const current = this.loadRun(runId);
    if (!current) {
      throw new Error(`Run not found: ${runId}`);
    }

    const updated: RunState = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.saveRun(updated);
    return updated;
  }

  listRuns(): RunState[] {
    this.ensureRunsDir();
    const runs: RunState[] = [];

    const entries = fs.readdirSync(this.runsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const state = this.loadRun(entry.name);
      if (state) {
        runs.push(state);
      }
    }

    return runs;
  }

  getRunDir(runId: string): string {
    return path.join(this.runsDir, runId);
  }

  getStatePath(runId: string): string {
    return path.join(this.getRunDir(runId), 'state.json');
  }

  private ensureRunsDir(): void {
    if (!fs.existsSync(this.runsDir)) {
      fs.mkdirSync(this.runsDir, { recursive: true });
    }
  }
}
