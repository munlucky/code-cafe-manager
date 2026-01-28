/**
 * Execution Facade
 * Stable public API for Desktop to interact with orchestrator execution
 * Hides internal implementation details (BaristaEngineV2, TerminalPool, SessionManager)
 *
 * Phase C: State Management Integration
 * Provides unified API for both execution and state management, replacing Orchestrator(core)
 */

import { EventEmitter } from 'events';
import type { TerminalPoolConfig, PoolStatus } from '@codecafe/core';
import { TIMEOUTS, ProviderType, OrderStatus, Receipt } from '@codecafe/core';
import { BaristaEngineV2 } from '../barista/barista-engine-v2.js';
import { TerminalPool } from '../terminal/terminal-pool.js';
import type { SessionStatusSummary } from '../session/index.js';
import type { Barista, Order } from '@codecafe/core';
import { Storage } from '@codecafe/core';
import { OrderManager } from '@codecafe/core';
import { BaristaManager } from '@codecafe/core';
import { LogManager } from '@codecafe/core';
import * as path from 'path';

/**
 * Execution Facade Configuration
 */
export interface ExecutionFacadeConfig {
  terminalPoolConfig?: TerminalPoolConfig;
  /**
   * Data directory for persistent storage (orders, baristas, receipts, logs)
   * @default process.cwd()/.codecafe
   */
  dataDir?: string;
  /**
   * Logs directory for order execution logs
   * @default process.cwd()/.codecafe/logs
   */
  logsDir?: string;
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
 * Phase C: Extended with state management capabilities to replace Orchestrator(core)
 */
export class ExecutionFacade extends EventEmitter {
  private readonly engine: BaristaEngineV2;
  private readonly terminalPool: TerminalPool;

  // State Management (Phase C)
  private readonly orderManager: OrderManager;
  private readonly baristaManager: BaristaManager;
  private readonly storage: Storage;
  private readonly logManager: LogManager;
  private readonly dataDir: string;
  private readonly logsDir: string;
  private initialized: boolean = false;

  constructor(config: ExecutionFacadeConfig = {}) {
    super();

    // Data directories
    const cwd = process.cwd();
    this.dataDir = config.dataDir || path.join(cwd, '.codecafe');
    this.logsDir = config.logsDir || path.join(this.dataDir, 'logs');

    // Initialize state management components
    this.orderManager = new OrderManager();
    this.baristaManager = new BaristaManager(4); // Default max baristas
    this.storage = new Storage(this.dataDir);
    this.logManager = new LogManager(this.logsDir);

    // Create Terminal Pool with default config if not provided
    const poolConfig: TerminalPoolConfig = config.terminalPoolConfig || {
      perProvider: {
        'claude-code': { size: 4, timeout: TIMEOUTS.COMMAND_EXECUTION, maxRetries: 3 },
        'codex': { size: 4, timeout: TIMEOUTS.COMMAND_EXECUTION, maxRetries: 3 },
      },
    };
    this.terminalPool = new TerminalPool(poolConfig);

    // Create Barista Engine
    this.engine = new BaristaEngineV2(this.terminalPool);

    // Forward engine events to facade
    this.forwardEngineEvents();
  }

  /**
   * Initialize state management (storage, logs)
   * Call this before using state management features
   */
  async initState(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.storage.init();
    await this.logManager.init();

    // Restore saved state
    const savedOrders = await this.storage.loadOrders();
    if (savedOrders.length > 0) {
      this.orderManager.restoreOrders(savedOrders);
    }

    const savedBaristas = await this.storage.loadBaristas();
    // Note: Baristas are not restored (process connections needed)
    if (savedBaristas.length > 0) {
      // Log but don't restore (baristas need fresh process connections)
      console.log(`[ExecutionFacade] Found ${savedBaristas.length} saved baristas (not restoring)`);
    }

    this.initialized = true;
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

  // ========================================
  // State Management (Phase C)
  // Replaces Orchestrator(core) state API
  // ========================================

  /**
   * Create a new barista
   */
  async createBarista(provider: ProviderType): Promise<Barista> {
    const barista = this.baristaManager.createBarista(provider);
    await this.persistState();
    return barista;
  }

  /**
   * Create a new order
   */
  async createOrder(
    workflowId: string,
    workflowName: string,
    counter: string,
    provider?: ProviderType,
    vars: Record<string, string> = {},
    cafeId?: string
  ): Promise<Order> {
    const defaultProvider: ProviderType = provider || 'claude-code';
    const order = this.orderManager.createOrder(workflowId, workflowName, counter, defaultProvider, vars, cafeId);

    // Auto-create barista if none available for the provider
    const idleBarista = this.baristaManager.findIdleBarista(defaultProvider);
    if (!idleBarista) {
      try {
        this.baristaManager.createBarista(defaultProvider);
      } catch (error) {
        console.error('Failed to auto-create barista:', error);
      }
    }

    await this.persistState();
    return order;
  }

  /**
   * Get all orders
   */
  getAllOrders(): Order[] {
    return this.orderManager.getAllOrders();
  }

  /**
   * Get all baristas
   */
  getAllBaristas(): Barista[] {
    return this.baristaManager.getAllBaristas();
  }

  /**
   * Get order by ID
   */
  getOrder(orderId: string): Order | undefined {
    return this.orderManager.getOrder(orderId);
  }

  /**
   * Get barista by ID
   */
  getBarista(baristaId: string): Barista | undefined {
    return this.baristaManager.getBarista(baristaId);
  }

  /**
   * Get order log
   */
  async getOrderLog(orderId: string): Promise<string> {
    return await this.logManager.readLog(orderId);
  }

  /**
   * Append to order log
   */
  async appendOrderLog(orderId: string, message: string): Promise<void> {
    await this.logManager.appendLog(orderId, message);
  }

  /**
   * Get all receipts
   */
  async getReceipts(): Promise<Receipt[]> {
    return await this.storage.loadReceipts();
  }

  /**
   * Delete an order
   */
  async deleteOrder(orderId: string): Promise<boolean> {
    const deleted = this.orderManager.deleteOrder(orderId);
    if (deleted) {
      await this.saveState();
    }
    return deleted;
  }

  /**
   * Delete multiple orders
   */
  async deleteOrders(orderIds: string[]): Promise<{ deleted: string[]; failed: string[] }> {
    const result = this.orderManager.deleteOrders(orderIds);
    await this.saveState();
    return result;
  }

  /**
   * Update order status (internal use)
   */
  updateOrderStatus(orderId: string, status: OrderStatus): void {
    const order = this.orderManager.getOrder(orderId);
    if (order) {
      order.status = status;
      if (status === OrderStatus.RUNNING && !order.startedAt) {
        order.startedAt = new Date();
      }
      if (status === OrderStatus.COMPLETED || status === OrderStatus.FAILED) {
        order.endedAt = new Date();
      }
    }
  }

  /**
   * Start an order (marks as RUNNING)
   * Called when execution begins
   */
  async startOrder(orderId: string): Promise<void> {
    this.orderManager.startOrder(orderId);
    await this.logManager.appendLog(orderId, 'Order started');
    await this.saveState();
  }

  /**
   * Complete an order (marks as COMPLETED or FAILED)
   * Called when execution finishes
   */
  async completeOrder(orderId: string, success: boolean, error?: string): Promise<void> {
    const order = this.orderManager.getOrder(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    this.orderManager.completeOrder(orderId, success, error);
    await this.logManager.appendLog(orderId, success ? 'Order completed' : `Order failed: ${error}`);

    // Receipt 생성
    const receipt: Receipt = {
      orderId: order.id,
      status: order.status,
      startedAt: order.startedAt!,
      endedAt: order.endedAt!,
      provider: order.provider,
      counter: order.counter,
    };
    await this.storage.addReceipt(receipt);

    await this.saveState();
  }

  /**
   * Persist state to storage immediately (synchronous save)
   */
  async persistState(): Promise<void> {
    await Promise.all([
      this.storage.saveOrders(this.orderManager.getAllOrders()),
      this.storage.saveBaristas(this.baristaManager.getAllBaristas()),
    ]);
  }

  /**
   * Save state to storage (async, fire and forget)
   */
  private async saveState(): Promise<void> {
    // Don't wait, save in background
    this.storage.saveOrders(this.orderManager.getAllOrders()).catch((err: unknown) => {
      console.error('[ExecutionFacade] Failed to save orders:', err);
    });
    this.storage.saveBaristas(this.baristaManager.getAllBaristas()).catch((err: unknown) => {
      console.error('[ExecutionFacade] Failed to save baristas:', err);
    });
  }
}
