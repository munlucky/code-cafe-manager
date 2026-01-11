import { ExecutionMode, RunState } from '../../types';
import { resumeWorkflow } from './run';

export interface ResumeRunOptions {
  orchDir?: string;
  mode?: ExecutionMode;
}

export async function resumeRun(runId: string, options: ResumeRunOptions = {}): Promise<RunState> {
  return resumeWorkflow(runId, options);
}
