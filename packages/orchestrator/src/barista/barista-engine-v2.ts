/**
 * Barista Engine V2
 * Phase 2: Terminal Pool based execution engine with Role support
 * Phase 3: Session-based multi-terminal orchestration
 */

import { Barista, Order, createLogger, EventListenerManager } from '@codecafe/core';

const logger = createLogger({ context: 'BaristaEngineV2' });
import { TerminalPool } from '../terminal/terminal-pool';
import * as path from 'path';
import {
  OrderSession,
  CafeSessionManager,
  WorkflowConfig,
  SessionStageConfig,
  SessionStatusSummary
} from '../session';
import * as yaml from 'yaml';
import * as fs from 'fs/promises';


import { EventEmitter } from 'events';
import {
  getRoleDescription,
  getRoleInstructions,
  SIGNAL_FORMAT_TEMPLATE,
  CRITICAL_REMINDER,
} from './prompts';

/**
 * Order 인터페이스 확장 (orchestrator 전용 속성)
 * core 패키지의 순환 의존성을 피하기 위해 여기서 확장
 */
interface OrderWithWorkflow extends Order {
  workflowConfig?: WorkflowConfig;
}

// StageConfig 별칭 (내부 사용)
type StageConfig = SessionStageConfig;

interface ActiveExecution {
  baristaId: string;
  session: OrderSession;
}

/**
 * Skill Cache Entry with TTL
 */
interface SkillCacheEntry {
  content: string;
  timestamp: number;
}

/**
 * Skill Cache Statistics
 */
interface SkillCacheStats {
  hits: number;
  misses: number;
}

/**
 * Barista Engine V2 - Session-based multi-terminal orchestration
 */
export class BaristaEngineV2 extends EventEmitter {
  private readonly terminalPool: TerminalPool;
  private readonly sessionManager: CafeSessionManager;
  private readonly activeExecutions = new Map<string, ActiveExecution>();
  private readonly listenerManager = new EventListenerManager();

  // Skill caching (Phase 3 optimization)
  private readonly skillCache = new Map<string, SkillCacheEntry>();
  private readonly skillCacheStats: SkillCacheStats = { hits: 0, misses: 0 };
  private readonly SKILL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly SKILL_CACHE_MAX_SIZE = 100;

  constructor(terminalPool: TerminalPool) {
    super();
    this.terminalPool = terminalPool;

    // Session Manager 초기화
    this.sessionManager = new CafeSessionManager({
      terminalPool: this.terminalPool,
      maxConcurrentOrdersPerCafe: 5,
    });

    // Session Manager 이벤트 전파
    this.listenerManager.attach(this.sessionManager, 'output', (data: { orderId: string; data: unknown }) => {
      this.emit('order:output', { orderId: data.orderId, data: data.data });
    });
    this.listenerManager.attach(this.sessionManager, 'session:started', (data: unknown) => {
      this.emit('order:started', data);
    });
    this.listenerManager.attach(this.sessionManager, 'session:completed', (data: unknown) => {
      this.emit('order:completed', data);
    });
    this.listenerManager.attach(this.sessionManager, 'session:failed', (data: unknown) => {
      this.emit('order:failed', data);
    });
    this.listenerManager.attach(this.sessionManager, 'session:awaiting', (data: unknown) => {
      this.emit('order:awaiting-input', data);
    });
    this.listenerManager.attach(this.sessionManager, 'stage:started', (data: unknown) => {
      this.emit('stage:started', data);
    });
    this.listenerManager.attach(this.sessionManager, 'stage:completed', (data: unknown) => {
      this.emit('stage:completed', data);
    });
    this.listenerManager.attach(this.sessionManager, 'stage:failed', (data: unknown) => {
      this.emit('stage:failed', data);
    });
  }

  /**
   * Execute an order using Session (all orders go through session-based execution)
   */
  async executeOrder(order: Order, barista: Barista): Promise<void> {
    logger.info(`Executing order ${order.id} with barista ${barista.id}`);

    const cwd = order.vars?.['PROJECT_ROOT'] || process.cwd();
    const cafeId = order.cafeId || 'default';

    // Use provided workflow config or load default
    let workflowConfig = (order as OrderWithWorkflow).workflowConfig;
    if (!workflowConfig || workflowConfig.stages.length === 0) {
      workflowConfig = await this.loadDefaultWorkflow(order.prompt || '');
    }

    // Always use session-based execution
    await this.executeWithSession(order, barista, cafeId, cwd, workflowConfig);
  }

  /**
   * Handle session execution with common logic for status checking and cleanup
   */
  private async _handleSessionExecution(
    order: Order,
    session: OrderSession,
    executionFn: () => Promise<void>
  ): Promise<void> {
    try {
      await executionFn();

      const sessionStatus = session.getStatus().status;

      if (sessionStatus === 'awaiting_input') {
        logger.debug(`Order ${order.id} awaiting user input`);
        return; // Keep in activeExecutions
      }

      logger.info(`Order ${order.id} completed via Session`);
    } catch (error) {
      logger.error(`Order ${order.id} failed via Session`, { error });
      throw error;
    } finally {
      // Clean up only if the session is not waiting for input
      if (session.getStatus().status !== 'awaiting_input') {
        this.activeExecutions.delete(order.id);
      }
    }
  }

  /**
   * Execute order using Session (multi-terminal support)
   */
  private async executeWithSession(
    order: Order,
    barista: Barista,
    cafeId: string,
    cwd: string,
    workflowConfig: WorkflowConfig
  ): Promise<void> {
    logger.info(`Executing order ${order.id} with Session (workflow mode)`);

    // Session 생성
    const session = this.sessionManager.createSessionWithWorkflow(
      order,
      barista,
      cafeId,
      cwd,
      workflowConfig
    );

    // Active execution 등록
    this.activeExecutions.set(order.id, { baristaId: barista.id, session });

    await this._handleSessionExecution(order, session, () => session.execute(cwd));
  }

  /**
   * Execute order with simple prompt using Session
   */
  async executeOrderWithSession(
    order: Order,
    barista: Barista,
    cafeId: string,
    prompt: string
  ): Promise<void> {
    const cwd = order.vars?.['PROJECT_ROOT'] || process.cwd();

    logger.info(`Executing order ${order.id} with Session (prompt mode)`);

    // Session 생성
    const session = this.sessionManager.createSession(order, barista, cafeId, cwd);

    // Active execution 등록
    this.activeExecutions.set(order.id, { baristaId: barista.id, session });

    await this._handleSessionExecution(order, session, () => session.executePrompt(prompt, cwd));
  }

  /**
   * Load skill content from desktop/skills/*.json (instructions field)
   * Uses TTL-based caching to avoid repeated file reads
   */
  private async loadSkillContent(skillName: string, projectRoot: string): Promise<string | null> {
    const cacheKey = `${skillName}:${projectRoot}`;
    const now = Date.now();

    // Check cache
    const cached = this.skillCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < this.SKILL_CACHE_TTL) {
      this.skillCacheStats.hits++;
      logger.debug(`Skill cache hit: ${skillName}`, { cacheKey });
      return cached.content;
    }

    this.skillCacheStats.misses++;

    // Map workflow skill names to JSON file names
    const skillNameMap: Record<string, string> = {
      'classify-task': 'classify-task',
      'evaluate-complexity': 'evaluate-complexity',
      'detect-uncertainty': 'detect-uncertainty',
      'decide-sequence': 'decide-sequence',
      'pre-flight-check': 'pre-flight-check',
      'implementation-runner': 'implementation-runner',
      'codex-review-code': 'codex-review-code',
      'codex-test-integration': 'codex-test-integration',
      'requirements-analyzer': 'requirements-analyzer',
      'context-builder': 'context-builder',
    };

    const jsonFileName = skillNameMap[skillName] || skillName;

    // Load from desktop/skills/*.json (bundled with app)
    const possiblePaths = [
      path.join(projectRoot, `desktop/skills/${jsonFileName}.json`),
      path.join(projectRoot, `packages/desktop/skills/${jsonFileName}.json`),
    ];

    for (const skillPath of possiblePaths) {
      try {
        const content = await fs.readFile(skillPath, 'utf-8');
        const skillData = JSON.parse(content) as { instructions?: string };
        if (skillData.instructions) {
          // Cache the result
          this.cacheSkillContent(cacheKey, skillData.instructions);
          logger.debug(`Loaded and cached skill instructions: ${skillName}`, { skillPath });
          return skillData.instructions;
        }
      } catch (error: unknown) {
        // Log errors other than file not found to aid in debugging
        const err = error as { code?: string };
        if (err.code !== 'ENOENT') {
          logger.warn(`Error loading skill "${skillName}"`, { skillPath, error });
        }
        // Try next path
      }
    }

    logger.warn(`Skill not found or no instructions: ${skillName}`);
    return null;
  }

  /**
   * Cache skill content with LRU eviction
   */
  private cacheSkillContent(cacheKey: string, content: string): void {
    // Evict oldest entries if cache is full
    if (this.skillCache.size >= this.SKILL_CACHE_MAX_SIZE) {
      const oldestKey = this.findOldestCacheEntry();
      if (oldestKey) {
        this.skillCache.delete(oldestKey);
      }
    }

    this.skillCache.set(cacheKey, {
      content,
      timestamp: Date.now(),
    });
  }

  /**
   * Find oldest cache entry for eviction
   */
  private findOldestCacheEntry(): string | null {
    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [key, entry] of this.skillCache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  /**
   * Get skill cache statistics
   */
  get skillCacheStatistics(): { hits: number; misses: number; hitRate: string; size: number } {
    const total = this.skillCacheStats.hits + this.skillCacheStats.misses;
    const hitRate = total > 0
      ? ((this.skillCacheStats.hits / total) * 100).toFixed(1) + '%'
      : '0%';

    return {
      hits: this.skillCacheStats.hits,
      misses: this.skillCacheStats.misses,
      hitRate,
      size: this.skillCache.size,
    };
  }

  /**
   * Clear skill cache (useful for testing or manual refresh)
   */
  clearSkillCache(): void {
    this.skillCache.clear();
    this.skillCacheStats.hits = 0;
    this.skillCacheStats.misses = 0;
    logger.debug('Skill cache cleared');
  }

  /**
   * Build stage prompt with skill instructions
   * Refactored to use extracted constants from ./prompts
   */
  private buildStagePrompt(
    stageId: string,
    orderPrompt: string,
    skillContents: string[]
  ): string {
    const parts: string[] = [
      `# Stage: ${stageId.toUpperCase()}`,
      '',
      getRoleDescription(stageId),
      '',
      '## Role Instructions',
      getRoleInstructions(stageId),
      '',
    ];

    // Add skill instructions if available
    if (skillContents.length > 0) {
      parts.push('## Skills to Execute', '');
      parts.push('Follow these skill instructions in order:', '');
      for (const skillContent of skillContents) {
        parts.push(`---\n${skillContent}\n---`, '');
      }
    }

    parts.push('## User Request', '', orderPrompt, '');
    parts.push(SIGNAL_FORMAT_TEMPLATE, '');
    parts.push(CRITICAL_REMINDER);

    return parts.join('\n');
  }

  /**
   * Load default workflow from moonshot-lite.workflow.yml
   */
  private async loadDefaultWorkflow(orderPrompt: string): Promise<WorkflowConfig> {
    // Get path relative to this file (works in both dev and built environments)
    // In dev: packages/orchestrator/src/barista/ -> need ../../../desktop/workflows
    // In prod: packages/orchestrator/dist/barista/ -> need ../../../../desktop/workflows
    // Use project root by going up from dist/src
    const projectRoot = path.join(__dirname, '../../..');
    const workflowPath = path.join(
      projectRoot,
      'desktop/workflows/moonshot-lite.workflow.yml'
    );

    logger.debug('Loading workflow', { workflowPath });

    try {
      const content = await fs.readFile(workflowPath, 'utf-8');
      const parsed = yaml.parse(content) as {
        workflow: { stages: string[] };
      } & Record<string, { provider?: string; role?: string; mode?: string; on_failure?: string; skills?: string[] }>;

      logger.debug('Parsed workflow stages', { stages: parsed.workflow.stages });

      // Convert YAML structure to WorkflowConfig with skill loading
      const stages: StageConfig[] = await Promise.all(
        parsed.workflow.stages.map(async (stageId: string) => {
          const stageConfig = parsed[stageId] as {
            provider?: string;
            role?: string;
            mode?: string;
            skills?: string[];
          };

          logger.debug('Stage config', { stageId, skills: stageConfig.skills, provider: stageConfig.provider, role: stageConfig.role });

          // Load skill contents for this stage (parallel)
          let skillContents: string[] = [];
          if (stageConfig.skills && stageConfig.skills.length > 0) {
            const skillPromises = stageConfig.skills.map(skillName =>
              this.loadSkillContent(skillName, projectRoot)
            );
            const loadedSkills = await Promise.all(skillPromises);
            skillContents = loadedSkills.filter((content): content is string => content !== null);
          }

          // Build stage prompt with role instructions and skill contents
          const stagePrompt = this.buildStagePrompt(
            stageId,
            orderPrompt,
            skillContents
          );

          return {
            id: stageId,
            name: stageConfig.role || stageId,
            provider: (stageConfig.provider || 'claude-code') as 'claude-code' | 'codex' | 'gemini' | 'grok',
            prompt: stagePrompt,
            role: stageConfig.role,
            mode: (stageConfig.mode || 'sequential') as 'sequential' | 'parallel',
            dependsOn: [],
            skills: stageConfig.skills,  // 스킬 목록 추가
          };
        })
      );

      logger.info(`Loaded workflow with ${stages.length} stages`, { stages: stages.map(s => ({ id: s.id, name: s.name, skills: s.skills })) });
      return { stages, vars: {} };
    } catch (error) {
      logger.warn('Failed to load default workflow', { error });
      // Fallback to single-stage workflow with order prompt
      return {
        stages: [{
          id: 'main',
          name: 'Main',
          provider: 'claude-code',
          prompt: orderPrompt,
          mode: 'sequential',
          dependsOn: [],
        }],
        vars: {},
      };
    }
  }

  /**
   * Cancel order execution
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(orderId);
    if (!execution?.session) {
      return false;
    }

    try {
      await execution.session.cancel();
      this.activeExecutions.delete(orderId);
      logger.info(`Order ${orderId} cancelled`);
      return true;
    } catch (error) {
      logger.error(`Failed to cancel order ${orderId}`, { error });
      return false;
    }
  }

  /**
   * Get active executions
   */
  getActiveExecutions(): Map<string, ActiveExecution> {
    return new Map(this.activeExecutions);
  }

  /**
   * Send input to an active order's terminal
   */
  public async sendInput(orderId: string, message: string): Promise<void> {
    const execution = this.activeExecutions.get(orderId);
    if (!execution?.session) {
      logger.warn(`No active session for order: ${orderId}`);
      return;
    }

    try {
      await execution.session.sendInput(message);
    } catch (error) {
      logger.error(`Failed to send input to order ${orderId}`, { error });
      throw error;
    }
  }

  /**
   * Retry order from a specific stage
   * @param orderId Order ID to retry
   * @param fromStageId Stage ID to start from (optional, defaults to failed stage)
   */
  public async retryFromStage(orderId: string, fromStageId?: string): Promise<void> {
    const execution = this.activeExecutions.get(orderId);
    if (!execution?.session) {
      logger.warn(`No session found for order: ${orderId}`);
      throw new Error(`No session found for order: ${orderId}`);
    }

    logger.info(`Retrying order ${orderId} from stage ${fromStageId || 'failed stage'}`);

    try {
      await execution.session.retryFromStage(fromStageId);
      logger.info(`Order ${orderId} retry completed`);
    } catch (error) {
      logger.error(`Failed to retry order ${orderId}`, { error });
      throw error;
    }
  }

  /**
   * Get retry options for a failed order
   */
  public getRetryOptions(orderId: string): Array<{ stageId: string; stageName: string; batchIndex: number }> | null {
    const execution = this.activeExecutions.get(orderId);
    if (!execution?.session) {
      return null;
    }

    const failedState = execution.session.getFailedState();
    return failedState?.retryOptions || null;
  }

  /**
   * Retry order from the beginning with previous attempt context
   * @param orderId Order ID to retry
   * @param preserveContext Whether to preserve previous attempt context (default: true)
   */
  public async retryFromBeginning(orderId: string, preserveContext: boolean = true): Promise<void> {
    const execution = this.activeExecutions.get(orderId);
    if (!execution?.session) {
      logger.warn(`No session found for order: ${orderId}`);
      throw new Error(`No session found for order: ${orderId}`);
    }

    logger.info(`Retrying order ${orderId} from beginning`, { preserveContext });

    try {
      await execution.session.retryFromBeginning(preserveContext);
      logger.info(`Order ${orderId} retry from beginning completed`);
    } catch (error) {
      logger.error(`Failed to retry order ${orderId} from beginning`, { error });
      throw error;
    }
  }

  /**
   * Get current attempt number for an order
   */
  public getAttemptNumber(orderId: string): number {
    const execution = this.activeExecutions.get(orderId);
    if (!execution?.session) {
      return 1;
    }

    return execution.session.getContext().getCurrentAttemptNumber();
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    // Active executions 취소
    const cancellations = Array.from(this.activeExecutions.keys()).map(id => this.cancelOrder(id));
    await Promise.all(cancellations);
    this.activeExecutions.clear();

    // 이벤트 리스너 정리
    this.listenerManager.detachAll();

    // Session Manager 정리
    await this.sessionManager.dispose();
  }

  /**
   * Get Session Manager for external access
   */
  getSessionManager(): CafeSessionManager {
    return this.sessionManager;
  }

  /**
   * Get session status summary
   */
  getSessionStatus(): SessionStatusSummary {
    return this.sessionManager.getStatusSummary();
  }

  /**
   * Get session for an order (throws if not found)
   */
  private _getSession(orderId: string): OrderSession {
    const execution = this.activeExecutions.get(orderId);
    if (!execution?.session) {
      throw new Error(`No session found for order: ${orderId}`);
    }
    return execution.session;
  }

  /**
   * Get session for an order (returns null if not found)
   */
  private _getSessionOptional(orderId: string): OrderSession | null {
    return this.activeExecutions.get(orderId)?.session ?? null;
  }

  /**
   * Enter followup mode for a completed order
   * Allows user to send additional commands to the AI
   */
  public async enterFollowup(orderId: string): Promise<void> {
    const session = this._getSession(orderId);
    await session.enterFollowup();
    this.emit('order:followup', { orderId });
  }

  /**
   * Execute a followup prompt on a completed/followup order
   */
  public async executeFollowup(orderId: string, prompt: string): Promise<void> {
    const session = this._getSession(orderId);

    logger.info(`Executing followup for order ${orderId}`);

    // Forward session events
    session.once('session:followup-started', (data) => {
      this.emit('order:followup-started', data);
    });
    session.once('session:followup-completed', (data) => {
      this.emit('order:followup-completed', data);
    });
    session.once('session:followup-failed', (data) => {
      this.emit('order:followup-failed', data);
    });

    await session.executeFollowup(prompt);
  }

  /**
   * Finish followup mode and fully complete the session
   */
  public async finishFollowup(orderId: string): Promise<void> {
    const session = this._getSession(orderId);
    await session.finishFollowup();
    this.emit('order:followup-finished', { orderId });
  }

  /**
   * Check if an order is in followup or completed state (can receive followup commands)
   */
  public canFollowup(orderId: string): boolean {
    const session = this._getSessionOptional(orderId);
    if (!session) {
      return false;
    }
    const status = session.getStatus().status;
    return status === 'completed' || status === 'followup';
  }

  /**
   * Get order session status
   */
  public getOrderSessionStatus(orderId: string): string | null {
    const session = this._getSessionOptional(orderId);
    return session?.getStatus().status ?? null;
  }

  /**
   * Restore session for followup mode (app restart recovery)
   * Creates a new session in followup/completed state for an existing order
   * @param order The order to restore session for
   * @param barista The barista to use
   * @param cafeId The cafe ID
   * @param cwd The working directory (usually worktree path)
   */
  public async restoreSessionForFollowup(
    order: Order,
    barista: Barista,
    cafeId: string,
    cwd: string
  ): Promise<void> {
    logger.info(`Restoring session for order ${order.id} in followup mode`);

    // Check if session already exists
    if (this.activeExecutions.has(order.id)) {
      logger.debug(`Session already exists for order ${order.id}, skipping restore`);
      return;
    }

    // Create new session
    const session = this.sessionManager.createSession(order, barista, cafeId, cwd);

    // Restore session to completed state with terminalGroup initialized
    session.restoreForFollowup(cwd);

    // Register in active executions
    this.activeExecutions.set(order.id, { baristaId: barista.id, session });

    // Note: output, stage:started, stage:completed, stage:failed events are already forwarded
    // via CafeSessionManager, so we don't need to set up duplicate listeners here.

    // Forward followup events (these are NOT forwarded by CafeSessionManager)
    session.on('session:followup', (data) => {
      this.emit('order:followup', data);
    });
    session.on('session:followup-started', (data) => {
      this.emit('order:followup-started', data);
    });
    session.on('session:followup-completed', (data) => {
      this.emit('order:followup-completed', data);
    });
    session.on('session:followup-failed', (data) => {
      this.emit('order:followup-failed', data);
    });

    logger.info(`Session restored for order ${order.id} with terminalGroup initialized`);
  }
}
