import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { RunStateManager } from '../../storage/run-state';

export async function showRunStatus(runId?: string, orchDir?: string): Promise<void> {
  const baseDir = orchDir || path.join(process.cwd(), '.orch');
  if (!fs.existsSync(baseDir)) {
    console.error(chalk.red(`.orch directory not found at ${baseDir}`));
    process.exit(1);
  }
  const stateManager = new RunStateManager(baseDir);

  if (runId) {
    const run = stateManager.loadRun(runId);
    if (!run) {
      console.error(chalk.red(`Run not found: ${runId}`));
      process.exit(1);
    }

    printRun(run);
    return;
  }

  const runs = stateManager.listRuns();
  if (runs.length === 0) {
    console.log(chalk.yellow('No runs found.'));
    return;
  }

  console.log(chalk.blue(`Found ${runs.length} run(s):\n`));
  runs.forEach((run) => printRun(run));
}

function printRun(run: {
  runId: string;
  workflow: string;
  status: string;
  currentStage: string;
  stageIter: number;
  completedNodes: string[];
  updatedAt: string;
}): void {
  console.log(chalk.green(`Run: ${run.runId}`));
  console.log(chalk.gray(`  Workflow: ${run.workflow}`));
  console.log(chalk.gray(`  Status: ${run.status}`));
  console.log(chalk.gray(`  Stage: ${run.currentStage}`));
  console.log(chalk.gray(`  Iter: ${run.stageIter}`));
  console.log(chalk.gray(`  Completed nodes: ${run.completedNodes.length}`));
  console.log(chalk.gray(`  Updated: ${run.updatedAt}`));
  console.log();
}
