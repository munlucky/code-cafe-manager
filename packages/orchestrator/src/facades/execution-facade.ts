/**
 * Execution Facade
 * Stable public API for Desktop to interact with orchestrator execution
 * Hides internal implementation details (BaristaEngineV2, TerminalPool, SessionManager)
 */

import { EventEmitter } from 'events';
import type { TerminalPoolConfig, PoolStatus } from '@codecafe/core';
import { BaristaEngineV2 } from '../barista/barista-engine-v2.js';
import { TerminalPool } from '../terminal/terminal-pool.js';
import type { SessionStatusSummary } from '../session/index.js';
import type { Barista } from '@codecafe/core';
import type { Order } from '@codecafe/core';

/**
 * Execution Facade Configuration
 */
export interface ExecutionFacadeConfig {
  terminalPoolConfig?: TerminalPoolConfig;
}

/**
 * Session Status type
 */
export type OrderSessionStatus = 'active' | 'completed' | 'followup' | 'awaiting_input' | null;

/**
 * Retry Option
 */
export interface RetryOption {
  stageId: string;
  stageName: string;
  batchIndex: number;
}

/**
 * Execution Facade
 * Public API for order execution in Desktop
 */
export class ExecutionFacade extends EventEmitter {
  private readonly engine: BaristaEngineV2;
  private readonly terminalPool: TerminalPool;

  constructor(config: ExecutionFacadeConfig = {}) {
    super();

    // Create Terminal Pool with default config if not provided
    const poolConfig: TerminalPoolConfig = config.terminalPoolConfig || {
      perProvider: {
        'claude-code': { size: 4, timeout: 30000, maxRetries: 3 },
        'codex': { size: 4, timeout: 30000, maxRetries: 3 },
      },
    };
    this.terminalPool = new TerminalPool(poolConfig);

    // Create Barista Engine
    this.engine = new BaristaEngineV2(this.terminalPool);

    // Forward engine events to facade
    this.forwardEngineEvents();
  }

  /**
   * Forward events from BaristaEngineV2 to Facade
   */
  private forwardEngineEvents(): void {
    this.engine.on('order:output', (data) => this.emit('order:output', data));
    this.engine.on('order:started', (data) => this.emit('order:started', data));
    this.engine.on('order:completed', (data) => this.emit('order:completed', data));
    this.engine.on('order:failed', (data) => this.emit('order:failed', data));
    this.engine.on('order:awaiting-input', (data) => this.emit('order:awaiting-input', data));
    this.engine.on('stage:started', (data) => this.emit('stage:started', data));
    this.engine.on('stage:completed', (data) => this.emit('stage:completed', data));
    this.engine.on('stage:failed', (data) => this.emit('stage:failed', data));
    this.engine.on('order:followup', (data) => this.emit('order:followup', data));
    this.engine.on('order:followup-started', (data) => this.emit('order:followup-started', data));
    this.engine.on('order:followup-completed', (data) => this.emit('order:followup-completed', data));
    this.engine.on('order:followup-failed', (data) => this.emit('order:followup-failed', data));
    this.engine.on('order:followup-finished', (data) => this.emit('order:followup-finished', data));
  }

  // ========================================
  // Order Execution
  // ========================================

  /**
   * Execute an order with a barista
   */
  async executeOrder(order: Order, barista: Barista): Promise<void> {
    return this.engine.executeOrder(order, barista);
  }

  /**
   * Cancel an active order
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    return this.engine.cancelOrder(orderId);
  }

  /**
   * Send input to an awaiting order
   */
  async sendInput(orderId: string, message: string): Promise<void> {
    return this.engine.sendInput(orderId, message);
  }

  // ========================================
  // Retry Operations
  // ========================================

  /**
   * Retry execution from a specific stage
   */
  async retryFromStage(orderId: string, fromStageId?: string): Promise<void> {
    return this.engine.retryFromStage(orderId, fromStageId);
  }

  /**
   * Get retry options for an order
   */
  getRetryOptions(orderId: string): RetryOption[] | null {
    return this.engine.getRetryOptions(orderId);
  }

  /**
   * Retry from the beginning
   */
  async retryFromBeginning(orderId: string, preserveContext?: boolean): Promise<void> {
    return this.engine.retryFromBeginning(orderId, preserveContext);
  }

  /**
   * Get attempt number for an order
   */
  getAttemptNumber(orderId: string): number {
    return this.engine.getAttemptNumber(orderId);
  }

  // ========================================
  // Followup Mode
  // ========================================

  /**
   * Enter followup mode for an order
   */
  async enterFollowup(orderId: string): Promise<void> {
    return this.engine.enterFollowup(orderId);
  }

  /**
   * Execute a followup prompt
   */
  async executeFollowup(orderId: string, prompt: string): Promise<void> {
    return this.engine.executeFollowup(orderId, prompt);
  }

  /**
   * Finish followup mode
   */
  async finishFollowup(orderId: string): Promise<void> {
    return this.engine.finishFollowup(orderId);
  }

  /**
   * Check if order can followup
   */
  canFollowup(orderId: string): boolean {
    return this.engine.canFollowup(orderId);
  }

  // ========================================
  // Terminal Pool
  // ========================================

  /**
   * Get terminal pool status
   */
  getPoolStatus(): PoolStatus {
    return this.terminalPool.getStatus();
  }

  // ========================================
  // Lifecycle
  // ========================================

  /**
   * Dispose resources
   */
  async dispose(): Promise<void> {
    await this.engine.dispose();
    await this.terminalPool.dispose();
  }

  // ========================================
  // Session Management (Internal API)
  // ========================================

  /**
   * Get session status for all orders
   * @internal Used by Desktop for session state tracking
   */
  getSessionStatus(): SessionStatusSummary | { error: string } {
    return this.engine.getSessionStatus();
  }

  /**
   * Get session status for a specific order
   * @internal Used by Desktop for followup state detection
   */
  getOrderSessionStatus(orderId: string): OrderSessionStatus {
    const status = this.engine.getOrderSessionStatus(orderId);
    // Type assertion: we trust the engine to return valid values
    return status as OrderSessionStatus;
  }

  /**
   * Restore session for followup mode
   * @internal Used by Desktop to restore sessions for completed orders with worktrees
   */
  async restoreSessionForFollowup(
    order: Order,
    barista: Barista,
    cafeId: string,
    cwd: string
  ): Promise<void> {
    return this.engine.restoreSessionForFollowup(order, barista, cafeId, cwd);
  }
}
