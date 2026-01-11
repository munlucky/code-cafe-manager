import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { EventLogger } from '../../storage/event-logger';
import { RunStateManager } from '../../storage/run-state';
import { EventLog } from '../../types';

export interface RunLogsOptions {
  orchDir?: string;
  follow?: boolean;
  filter?: string;
}

export async function showRunLogs(runId: string, options: RunLogsOptions = {}): Promise<void> {
  const baseDir = options.orchDir || path.join(process.cwd(), '.orch');
  const stateManager = new RunStateManager(baseDir);
  const state = stateManager.loadRun(runId);

  if (!state) {
    console.error(chalk.red(`Run not found: ${runId}`));
    process.exit(1);
  }

  const logger = new EventLogger(baseDir, runId);
  const eventsPath = logger.getPath();

  if (!fs.existsSync(eventsPath)) {
    if (!options.follow) {
      console.log(chalk.yellow('No events logged for this run yet.'));
      return;
    }

    fs.mkdirSync(path.dirname(eventsPath), { recursive: true });
    fs.writeFileSync(eventsPath, '', 'utf-8');
  }

  const events = logger.readAll();
  events.forEach((event) => printEvent(event, options.filter));

  if (options.follow) {
    console.log(chalk.gray('Following log output... (Press Ctrl+C to stop)'));
    followEvents(eventsPath, options.filter);
  }
}

function followEvents(filePath: string, filter?: string): void {
  let lastSize = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;

  fs.watchFile(filePath, { interval: 500 }, () => {
    const current = fs.readFileSync(filePath);
    if (current.length <= lastSize) {
      lastSize = current.length;
      return;
    }

    const chunk = current.slice(lastSize).toString('utf-8');
    lastSize = current.length;

    const lines = chunk.split('\n').filter((line) => line.trim().length > 0);
    lines.forEach((line) => {
      try {
        const event = JSON.parse(line) as EventLog;
        printEvent(event, filter);
      } catch {
        // ignore malformed lines
      }
    });
  });
}

function printEvent(event: EventLog, filter?: string): void {
  if (filter && event.type !== filter) {
    return;
  }

  const timestamp = event.timestamp ? new Date(event.timestamp).toISOString() : '';
  const stage = event.stage ? ` stage=${event.stage}` : '';
  const node = event.nodeId ? ` node=${event.nodeId}` : '';
  const prefix = `[${timestamp}] ${event.type}${stage}${node}`;

  if (event.error) {
    console.log(chalk.red(`${prefix} error=${event.error}`));
    return;
  }

  if (event.data) {
    console.log(chalk.gray(`${prefix} data=${JSON.stringify(event.data)}`));
    return;
  }

  console.log(chalk.gray(prefix));
}
