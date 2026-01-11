import * as fs from 'fs';
import * as path from 'path';
import { EventLog } from '../types';

export class EventLogger {
  private eventsPath: string;

  constructor(orchDir: string, runId: string) {
    const runDir = path.join(orchDir, 'runs', runId);
    fs.mkdirSync(runDir, { recursive: true });
    this.eventsPath = path.join(runDir, 'events.jsonl');
  }

  log(event: Omit<EventLog, 'timestamp'> & { timestamp?: string }): void {
    const payload: EventLog = {
      timestamp: event.timestamp || new Date().toISOString(),
      type: event.type,
      nodeId: event.nodeId,
      stage: event.stage,
      data: event.data,
      error: event.error,
    };

    const line = `${JSON.stringify(payload)}\n`;
    fs.appendFileSync(this.eventsPath, line, 'utf-8');
  }

  readAll(): EventLog[] {
    if (!fs.existsSync(this.eventsPath)) {
      return [];
    }

    const content = fs.readFileSync(this.eventsPath, 'utf-8');
    return content
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        try {
          return JSON.parse(line) as EventLog;
        } catch {
          return null;
        }
      })
      .filter((event): event is EventLog => event !== null);
  }

  getPath(): string {
    return this.eventsPath;
  }
}
