/**
 * Order Service
 * Business logic for order management, extracted from IPC handlers
 */

import { join } from 'path';
import { existsSync } from 'fs';
import { promises as fs } from 'fs';
import { homedir } from 'os';
import { Orchestrator, Order, createLogger, toCodeCafeError } from '@codecafe/core';
import { WorktreeManager } from '@codecafe/git-worktree';
import type { ExecutionFacade } from '@codecafe/orchestrator';
import { convertAnsiToHtml } from '../../common/output-utils.js';
import { parseOutputType } from '../../common/output-markers.js';

const logger = createLogger({ context: 'OrderService' });

/**
 * Cafe Registry type (simplified)
 */
export interface Cafe {
  id: string;
  name: string;
  path: string;
  settings: {
    baseBranch: string;
    worktreeRoot: string;
  };
}

/**
 * Log chunk type
 */
interface LogChunk {
  timestamp: string;
  message: string;
}

/**
 * Worktree creation result
 */
export interface WorktreeCreationResult {
  path: string;
  branch: string;
  baseBranch: string;
}

/**
 * Order creation with worktree params
 */
export interface CreateOrderWithWorktreeParams {
  cafeId: string;
  workflowId: string;
  workflowName: string;
  provider?: string;
  vars?: Record<string, string>;
  createWorktree: boolean;
  worktreeOptions?: {
    baseBranch?: string;
    branchPrefix?: string;
  };
}

/**
 * Order creation with worktree result
 */
export interface CreateOrderWithWorktreeResult {
  order: Order;
  worktree?: {
    path: string;
    branch: string;
  };
}

/**
 * Simple order creation params
 */
export interface CreateOrderParams {
  workflowId: string;
  workflowName: string;
  counter: string;
  provider?: string;
  vars?: Record<string, string>;
}

/**
 * Worktree cleanup result
 */
export interface CleanupWorktreeResult {
  success: boolean;
  branch: string;
  message: string;
}

/**
 * Merge to main result
 */
export interface MergeToMainResult {
  success: boolean;
  commitHash?: string;
  message?: string;
}

/**
 * Output history entry
 */
export interface OutputHistoryEntry {
  orderId: string;
  timestamp: string;
  type: string;
  content: string;
}

/**
 * OrderService dependencies
 */
export interface OrderServiceDependencies {
  orchestrator: Orchestrator;
  getExecutionManager: () => { getBaristaEngine: () => ExecutionFacade | null } | null;
}

/**
 * Parse log file content into timestamped chunks
 * Handles multi-line messages correctly
 *
 * Format: [YYYY-MM-DDTHH:mm:ss.sssZ] message (can be multi-line)
 */
function parseLogChunks(content: string): LogChunk[] {
  const chunks: LogChunk[] = [];
  const timestampPattern = /^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]\s*/;

  const lines = content.split('\n');
  let currentChunk: LogChunk | null = null;

  for (const line of lines) {
    const match = line.match(timestampPattern);

    if (match) {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      currentChunk = {
        timestamp: match[1],
        message: line.slice(match[0].length),
      };
    } else if (currentChunk) {
      currentChunk.message += '\n' + line;
    } else if (line.trim()) {
      chunks.push({
        timestamp: new Date().toISOString(),
        message: line,
      });
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * OrderService - Business logic for order management
 */
export class OrderService {
  private readonly orchestrator: Orchestrator;
  private readonly getExecutionManager: () => { getBaristaEngine: () => ExecutionFacade | null } | null;

  constructor(deps: OrderServiceDependencies) {
    this.orchestrator = deps.orchestrator;
    this.getExecutionManager = deps.getExecutionManager;
  }

  // ============================================
  // Cafe Registry Operations
  // ============================================

  /**
   * Load cafe registry from disk
   */
  async loadCafeRegistry(): Promise<Cafe[]> {
    const registryPath = join(homedir(), '.codecafe', 'cafes.json');
    if (!existsSync(registryPath)) {
      return [];
    }

    try {
      const content = await fs.readFile(registryPath, 'utf-8');
      const data = JSON.parse(content);
      return data.cafes || [];
    } catch (error) {
      logger.error('Failed to load cafe registry', { error: String(error) });
      return [];
    }
  }

  /**
   * Get cafe by ID
   */
  async getCafe(cafeId: string): Promise<Cafe | null> {
    const cafes = await this.loadCafeRegistry();
    return cafes.find((c) => c.id === cafeId) || null;
  }

  // ============================================
  // Worktree Operations
  // ============================================

  /**
   * Create worktree and update order
   */
  async createWorktreeAndUpdateOrder(
    order: Order,
    cafe: Cafe,
    worktreeOptions?: { baseBranch?: string; branchPrefix?: string }
  ): Promise<WorktreeCreationResult> {
    const baseBranch = worktreeOptions?.baseBranch || cafe.settings.baseBranch;
    const branchPrefix = worktreeOptions?.branchPrefix || 'order';
    const branchName = `${branchPrefix}-${order.id}`;

    const worktreeRoot = cafe.settings.worktreeRoot.startsWith('/')
      ? cafe.settings.worktreeRoot
      : join(cafe.path, cafe.settings.worktreeRoot);

    const worktreePath = join(worktreeRoot, branchName);

    logger.info('Creating worktree', { orderId: order.id, worktreePath, baseBranch });

    await WorktreeManager.createWorktree({
      repoPath: cafe.path,
      baseBranch,
      newBranch: branchName,
      worktreePath,
    });

    // Update order object
    order.worktreeInfo = {
      path: worktreePath,
      branch: branchName,
      baseBranch,
      repoPath: cafe.path,
    };
    order.vars = { ...order.vars, PROJECT_ROOT: worktreePath };

    logger.info('Worktree created and order updated', { worktreePath });

    return { path: worktreePath, branch: branchName, baseBranch };
  }

  /**
   * Remove worktree for order
   */
  async removeWorktree(order: Order): Promise<void> {
    if (!order.worktreeInfo?.path || !existsSync(order.worktreeInfo.path)) {
      return;
    }

    logger.info('Removing worktree', { orderId: order.id, path: order.worktreeInfo.path });

    // Cancel any running process first
    await this.orchestrator.cancelOrder(order.id).catch(() => {});

    // WorktreeManager.removeWorktree has built-in retry logic for file lock issues
    await WorktreeManager.removeWorktree({
      worktreePath: order.worktreeInfo.path,
      repoPath: order.worktreeInfo?.repoPath || order.counter,
      force: true,
    });

    logger.info('Worktree removed', { path: order.worktreeInfo.path });
  }

  // ============================================
  // Order CRUD Operations
  // ============================================

  /**
   * Create order with optional worktree
   */
  async createOrderWithWorktree(
    params: CreateOrderWithWorktreeParams
  ): Promise<CreateOrderWithWorktreeResult> {
    const cafe = await this.getCafe(params.cafeId);
    if (!cafe) {
      throw new Error(`Cafe not found: ${params.cafeId}`);
    }

    const order = await this.orchestrator.createOrder(
      params.workflowId,
      params.workflowName,
      cafe.path,
      params.provider as any,
      params.vars ? { ...params.vars, PROJECT_ROOT: cafe.path } : { PROJECT_ROOT: cafe.path },
      params.cafeId
    );

    let worktreeInfo: { path: string; branch: string } | undefined;

    if (params.createWorktree) {
      try {
        const result = await this.createWorktreeAndUpdateOrder(order, cafe, params.worktreeOptions);
        worktreeInfo = { path: result.path, branch: result.branch };
      } catch (wtError: any) {
        logger.error('Failed to create worktree', { error: wtError.message });

        // Rollback order on worktree failure
        try {
          await this.orchestrator.cancelOrder(order.id);
          await this.orchestrator.deleteOrder(order.id);
          logger.info('Order rolled back due to worktree failure', { orderId: order.id });
        } catch (deleteError: any) {
          logger.error('Failed to rollback order', { orderId: order.id, error: deleteError.message });
        }

        const error = new Error(`Failed to create worktree: ${wtError.message || 'Unknown error'}`);
        (error as any).code = 'WORKTREE_CREATION_FAILED';
        throw error;
      }
    }

    return { order, worktree: worktreeInfo };
  }

  /**
   * Create simple order
   */
  createOrder(params: CreateOrderParams): Order {
    return this.orchestrator.createOrder(
      params.workflowId,
      params.workflowName,
      params.counter,
      params.provider as any,
      params.vars ? { ...params.vars, PROJECT_ROOT: params.counter } : { PROJECT_ROOT: params.counter }
    );
  }

  /**
   * Get order by ID
   */
  getOrder(orderId: string): Order | undefined {
    return this.orchestrator.getOrder(orderId);
  }

  /**
   * Get all orders
   */
  getAllOrders(): Order[] {
    return this.orchestrator.getAllOrders();
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string): Promise<void> {
    await this.orchestrator.cancelOrder(orderId);
  }

  /**
   * Delete order with worktree cleanup
   */
  async deleteOrder(orderId: string): Promise<boolean> {
    const order = this.orchestrator.getOrder(orderId);

    if (order) {
      try {
        await this.removeWorktree(order);
      } catch (wtError: any) {
        logger.error('Failed to remove worktree', { error: wtError.message });
        // Continue with order deletion even if worktree removal fails
      }
    }

    return await this.orchestrator.deleteOrder(orderId);
  }

  /**
   * Delete multiple orders with worktree cleanup
   */
  async deleteOrders(orderIds: string[]): Promise<{ deleted: string[]; failed: string[] }> {
    // Remove worktrees in parallel
    const worktreeRemovals = orderIds.map(async (orderId) => {
      const order = this.orchestrator.getOrder(orderId);
      if (order) {
        try {
          await this.removeWorktree(order);
        } catch (wtError: unknown) {
          const errorMsg = wtError instanceof Error ? wtError.message : String(wtError);
          logger.error('Failed to remove worktree', { orderId, error: errorMsg });
        }
      }
    });

    await Promise.allSettled(worktreeRemovals);

    return await this.orchestrator.deleteOrders(orderIds);
  }

  // ============================================
  // Order Execution Operations
  // ============================================

  /**
   * Execute order
   */
  async executeOrder(orderId: string, prompt: string, vars?: Record<string, string>): Promise<void> {
    logger.info('Executing order', { orderId, prompt });
    await this.orchestrator.executeOrder(orderId, prompt, vars || {});
  }

  /**
   * Send input to running order
   */
  async sendInput(orderId: string, message: string): Promise<void> {
    logger.info('Sending input to order', { orderId });
    await this.orchestrator.sendInput(orderId, message);
  }

  /**
   * Get order log
   */
  async getOrderLog(orderId: string): Promise<string> {
    return await this.orchestrator.getOrderLog(orderId);
  }

  /**
   * Get all receipts
   */
  async getReceipts(): Promise<any[]> {
    return await this.orchestrator.getReceipts();
  }

  // ============================================
  // Output Subscription Operations
  // ============================================

  /**
   * Get output history for order
   * Reads from log file and parses into history entries
   */
  async getOutputHistory(orderId: string): Promise<OutputHistoryEntry[]> {
    const logsDir = join(homedir(), '.codecafe', 'logs');
    const logPath = join(logsDir, `${orderId}.log`);

    logger.info('Getting output history', { orderId, logPath });

    const history: OutputHistoryEntry[] = [];

    if (!existsSync(logPath)) {
      return history;
    }

    try {
      const content = await fs.readFile(logPath, 'utf-8');
      if (!content.trim()) {
        return history;
      }

      const chunks = parseLogChunks(content);

      for (const chunk of chunks) {
        const parsed = parseOutputType(chunk.message);
        const outputType = parsed.type === 'user_prompt' ? 'user-input' : parsed.type;

        history.push({
          orderId,
          timestamp: chunk.timestamp,
          type: outputType,
          content: convertAnsiToHtml(parsed.content),
        });
      }

      logger.info('Prepared history entries', { orderId, count: chunks.length });
    } catch (error) {
      logger.error('Failed to read history log file', { error: String(error) });
    }

    return history;
  }

  // ============================================
  // Retry Operations
  // ============================================

  /**
   * Get BaristaEngine from ExecutionManager
   */
  private getBaristaEngine(): ExecutionFacade {
    const executionManager = this.getExecutionManager();
    if (!executionManager) {
      throw new Error('ExecutionManager not initialized');
    }

    const baristaEngine = executionManager.getBaristaEngine();
    if (!baristaEngine) {
      throw new Error('BaristaEngine not initialized');
    }

    return baristaEngine;
  }

  /**
   * Retry worktree creation for existing order
   */
  async retryWorktree(
    orderId: string,
    cafeId: string,
    worktreeOptions?: { baseBranch?: string; branchPrefix?: string }
  ): Promise<{ worktree: { path: string; branch: string }; message: string }> {
    const order = this.orchestrator.getOrder(orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    const cafe = await this.getCafe(cafeId);
    if (!cafe) {
      throw new Error(`Cafe not found: ${cafeId}`);
    }

    if (order.worktreeInfo?.path && existsSync(order.worktreeInfo.path)) {
      logger.info('Worktree already exists', { path: order.worktreeInfo.path });
      return {
        worktree: {
          path: order.worktreeInfo.path,
          branch: order.worktreeInfo.branch,
        },
        message: 'Worktree already exists',
      };
    }

    const result = await this.createWorktreeAndUpdateOrder(order, cafe, worktreeOptions);

    return {
      worktree: {
        path: result.path,
        branch: result.branch,
      },
      message: 'Worktree created successfully',
    };
  }

  /**
   * Retry from specific stage
   */
  async retryFromStage(orderId: string, fromStageId?: string): Promise<void> {
    logger.info('Retrying order from stage', { orderId, fromStageId });

    await this.orchestrator.startOrder(orderId);

    const baristaEngine = this.getBaristaEngine();
    await baristaEngine.retryFromStage(orderId, fromStageId);
  }

  /**
   * Get retry options for failed order
   */
  getRetryOptions(orderId: string): any {
    logger.info('Getting retry options', { orderId });

    try {
      const baristaEngine = this.getBaristaEngine();
      return baristaEngine.getRetryOptions(orderId);
    } catch {
      return null;
    }
  }

  /**
   * Retry from beginning with optional context preservation
   */
  async retryFromBeginning(orderId: string, preserveContext: boolean = true): Promise<void> {
    logger.info('Retrying order from beginning', { orderId, preserveContext });

    await this.orchestrator.startOrder(orderId);

    const baristaEngine = this.getBaristaEngine();
    await baristaEngine.retryFromBeginning(orderId, preserveContext);
  }

  // ============================================
  // Followup Operations
  // ============================================

  /**
   * Ensure session exists for followup (restore if needed)
   */
  async ensureSessionForFollowup(orderId: string): Promise<boolean> {
    const order = this.orchestrator.getOrder(orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    const baristaEngine = this.getBaristaEngine();

    const sessionExists = baristaEngine.canFollowup(orderId);
    const isCompleted = order.status === 'COMPLETED';
    const hasWorktree = order.worktreeInfo?.path &&
      order.worktreeInfo.path.length > 0 &&
      !order.worktreeInfo.removed;

    if (!sessionExists && isCompleted && hasWorktree) {
      logger.info('Session not found, attempting to restore for followup');

      try {
        let barista = this.orchestrator.getAllBaristas().find(b => b.provider === order.provider);
        if (!barista) {
          barista = this.orchestrator.createBarista(order.provider);
          logger.info('Created barista for followup restore', { provider: order.provider });
        }

        const cwd = order.worktreeInfo!.path;
        const cafeId = order.cafeId || order.counter;
        await baristaEngine.restoreSessionForFollowup(order, barista, cafeId, cwd);
        logger.info('Session restored for order', { orderId });
        return true;
      } catch (restoreError: unknown) {
        const cafeError = toCodeCafeError(restoreError);
        logger.error('Failed to restore session', { orderId, error: cafeError.message });
        throw new Error(`Failed to restore session: ${cafeError.message}`);
      }
    }

    return false;
  }

  /**
   * Enter followup mode
   */
  async enterFollowup(orderId: string): Promise<void> {
    logger.info('Entering followup mode', { orderId });

    await this.ensureSessionForFollowup(orderId);

    const baristaEngine = this.getBaristaEngine();
    await baristaEngine.enterFollowup(orderId);
  }

  /**
   * Execute followup prompt
   */
  async executeFollowup(orderId: string, prompt: string): Promise<void> {
    logger.info('Executing followup', { orderId, prompt });

    await this.ensureSessionForFollowup(orderId);

    const baristaEngine = this.getBaristaEngine();
    await baristaEngine.executeFollowup(orderId, prompt);
  }

  /**
   * Finish followup mode
   */
  async finishFollowup(orderId: string): Promise<void> {
    logger.info('Finishing followup mode', { orderId });

    const baristaEngine = this.getBaristaEngine();
    await baristaEngine.finishFollowup(orderId);
  }

  /**
   * Check if followup is possible
   */
  canFollowup(orderId: string): boolean {
    const baristaEngine = this.getBaristaEngine();
    return baristaEngine.canFollowup(orderId);
  }

  // ============================================
  // Worktree Management Operations
  // ============================================

  /**
   * Cleanup worktree only (preserve order history)
   */
  async cleanupWorktreeOnly(orderId: string): Promise<CleanupWorktreeResult> {
    logger.info('Cleaning up worktree only', { orderId });

    const order = this.orchestrator.getOrder(orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }
    if (!order.worktreeInfo?.path) {
      throw new Error(`No worktree info for order: ${orderId}`);
    }

    const repoPath = order.worktreeInfo.repoPath || order.counter;

    await WorktreeManager.removeWorktreeOnly(
      order.worktreeInfo.path,
      repoPath
    );

    const worktreeBranch = order.worktreeInfo.branch;
    order.worktreeInfo = {
      ...order.worktreeInfo,
      path: '',
      removed: true,
    };

    await this.orchestrator.persistState();

    logger.info('Worktree removed, order preserved', { branch: worktreeBranch });

    return {
      success: true,
      branch: worktreeBranch,
      message: 'Worktree removed. Branch and commit history preserved.'
    };
  }

  /**
   * Merge worktree to target branch
   */
  async mergeWorktreeToMain(
    orderId: string,
    targetBranch: string = 'main',
    deleteAfterMerge: boolean = true,
    squash: boolean = false
  ): Promise<MergeToMainResult> {
    logger.info('Merging worktree to main', { orderId, targetBranch });

    const order = this.orchestrator.getOrder(orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }
    if (!order.worktreeInfo?.path) {
      throw new Error(`No worktree info for order: ${orderId}`);
    }

    const repoPath = order.worktreeInfo.repoPath || order.counter;

    const result = await WorktreeManager.mergeToTarget({
      worktreePath: order.worktreeInfo.path,
      repoPath,
      targetBranch,
      deleteAfterMerge,
      squash,
    });

    if (result.success && deleteAfterMerge) {
      order.worktreeInfo = {
        ...order.worktreeInfo,
        path: '',
        removed: true,
        merged: true,
        mergedTo: targetBranch,
        mergeCommit: result.commitHash,
      };

      await this.orchestrator.persistState();
    }

    return result;
  }
}
