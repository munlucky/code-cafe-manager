/**
 * Stage Event Handler
 * Handles stage-level events from ExecutionFacade
 */

import { BrowserWindow } from 'electron';
import { ExecutionFacade } from '@codecafe/orchestrator';
import { createLogger } from '@codecafe/core';

const logger = createLogger({ context: 'StageEventHandler' });

interface StageStartedData {
  orderId: string;
  stageId: string;
  stageName: string;
  provider: string;
  skills: string[];
}

interface StageCompletedData {
  orderId: string;
  stageId: string;
  stageName: string;
  duration?: number;
}

interface StageFailedData {
  orderId: string;
  stageId: string;
  error: string;
}

/**
 * Stage Event Handler
 * Manages stage lifecycle events and forwards them to renderer
 */
export class StageEventHandler {
  constructor(
    private readonly facade: ExecutionFacade,
    private readonly mainWindow: BrowserWindow | null,
  ) {}

  /**
   * Register all stage event listeners
   */
  setup(): void {
    this.facade.on('stage:started', (data: StageStartedData) => {
      this.handleStageStarted(data);
    });

    this.facade.on('stage:completed', (data: StageCompletedData) => {
      this.handleStageCompleted(data);
    });

    this.facade.on('stage:failed', (data: StageFailedData) => {
      this.handleStageFailed(data);
    });
  }

  /**
   * Remove all stage event listeners
   */
  cleanup(): void {
    this.facade.removeAllListeners('stage:started');
    this.facade.removeAllListeners('stage:completed');
    this.facade.removeAllListeners('stage:failed');
  }

  private handleStageStarted(data: StageStartedData): void {
    logger.info(`Stage STARTED: ${data.stageId} (${data.stageName || data.stageId})`, {
      orderId: data.orderId,
      provider: data.provider
    });
    logger.debug('Stage skills', { skills: data.skills });

    this.sendToRenderer('order:stage-started', {
      orderId: data.orderId,
      stageId: data.stageId,
      stageName: data.stageName,
      provider: data.provider,
      skills: data.skills,
    });
  }

  private handleStageCompleted(data: StageCompletedData): void {
    const duration = data.duration || 0;
    logger.info(`Stage COMPLETED: ${data.stageId}`, {
      orderId: data.orderId,
      duration: `${duration}ms`
    });

    // Note: IPC transmission removed - stage completion info is sent via Output stream ([STAGE_END] marker)
    // This ensures a single unified path for stage completion data
  }

  private handleStageFailed(data: StageFailedData): void {
    logger.error(`Stage FAILED: ${data.stageId}`, {
      orderId: data.orderId,
      error: data.error || 'Unknown'
    });

    // Note: IPC transmission removed - stage failure info is sent via Output stream ([STAGE_END] marker)
    // This ensures a single unified path for stage failure data
  }

  private sendToRenderer(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
}
