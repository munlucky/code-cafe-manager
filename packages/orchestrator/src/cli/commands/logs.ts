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
  timeline?: boolean;
  errorsOnly?: boolean;
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

  let events = logger.readAll();

  if (options.errorsOnly) {
    events = events.filter((e) => e.type === 'error' || e.error);
  }

  if (options.filter) {
    events = events.filter((e) => e.type === options.filter);
  }

  if (options.timeline) {
    printTimeline(events, state);
  } else {
    events.forEach((event) => printEvent(event));
  }

  if (options.follow) {
    console.log(chalk.gray('Following log output... (Press Ctrl+C to stop)'));
    followEvents(eventsPath, options);
  }
}

function followEvents(filePath: string, options: RunLogsOptions): void {
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

        if (options.errorsOnly && event.type !== 'error' && !event.error) {
          return;
        }

        if (options.filter && event.type !== options.filter) {
          return;
        }

        printEvent(event);
      } catch {
        // ignore malformed lines
      }
    });
  });
}

function printEvent(event: EventLog): void {
  const timestamp = event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : '';
  const stage = event.stage ? ` [${event.stage}]` : '';
  const node = event.nodeId ? ` ${event.nodeId}` : '';

  let typeColor: typeof chalk.gray = chalk.gray;
  let typeIcon = '●';

  switch (event.type) {
    case 'node_start':
      typeColor = chalk.blue;
      typeIcon = '▶';
      break;
    case 'node_end':
      typeColor = chalk.green;
      typeIcon = '✓';
      break;
    case 'error':
      typeColor = chalk.red;
      typeIcon = '✗';
      break;
    case 'stage_end':
      typeColor = chalk.cyan;
      typeIcon = '◆';
      break;
    case 'validation_fail':
      typeColor = chalk.yellow;
      typeIcon = '⚠';
      break;
    case 'retry':
      typeColor = chalk.yellow;
      typeIcon = '↻';
      break;
    case 'fallback':
      typeColor = chalk.magenta;
      typeIcon = '⟳';
      break;
  }

  const prefix = `${chalk.dim(timestamp)} ${typeColor(typeIcon)} ${typeColor(event.type)}${chalk.dim(stage)}${chalk.dim(node)}`;

  if (event.error) {
    console.log(`${prefix}\n  ${chalk.red(event.error)}`);
    return;
  }



  if (event.data) {
    console.log(`${prefix}\n  ${chalk.dim(JSON.stringify(event.data, null, 2))}`);
    return;
  }

  console.log(prefix);
}

function printTimeline(events: EventLog[], state: any): void {
  console.log(chalk.cyan.bold(`\n═══ Timeline for Run: ${state.runId} ═══\n`));

  const stageGroups: Record<string, EventLog[]> = {};
  events.forEach((event) => {
    const stage = event.stage || 'unknown';
    if (!stageGroups[stage]) {
      stageGroups[stage] = [];
    }
    stageGroups[stage].push(event);
  });

  Object.entries(stageGroups).forEach(([stage, stageEvents]) => {
    console.log(chalk.cyan(`\n┌─ Stage: ${stage.toUpperCase()}`));

    stageEvents.forEach((event, index) => {
      const isLast = index === stageEvents.length - 1;
      const connector = isLast ? '└─' : '├─';
      const timestamp = event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : '';

      let icon = '●';
      let color: typeof chalk.gray = chalk.gray;

      if (event.type === 'error' || event.error) {
        icon = '✗';
        color = chalk.red;
      } else if (event.type === 'node_end') {
        icon = '✓';
        color = chalk.green;
      } else if (event.type === 'node_start') {
        icon = '▶';
        color = chalk.blue;
      }

      const nodeInfo = event.nodeId ? ` ${event.nodeId}` : '';
      console.log(`${chalk.dim(connector)} ${chalk.dim(timestamp)} ${color(icon)} ${color(event.type)}${nodeInfo}`);

      if (event.error) {
        console.log(`${isLast ? '  ' : '│ '}   ${chalk.red('↳ ' + event.error)}`);
      }
    });
  });

  console.log(chalk.cyan('\n═══ End of Timeline ═══\n'));
}
