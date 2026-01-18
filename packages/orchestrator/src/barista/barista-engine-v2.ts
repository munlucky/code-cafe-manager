/**
 * Barista Engine V2
 * Phase 2: Terminal Pool based execution engine with Role support
 * Phase 3: Session-based multi-terminal orchestration
 */

import { Barista, Order } from '@codecafe/core';
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
 * Barista Engine V2 - Session-based multi-terminal orchestration
 */
export class BaristaEngineV2 extends EventEmitter {
  private readonly terminalPool: TerminalPool;
  private readonly sessionManager: CafeSessionManager;
  private readonly activeExecutions = new Map<string, ActiveExecution>();

  constructor(terminalPool: TerminalPool) {
    super();
    this.terminalPool = terminalPool;

    // Session Manager 초기화
    this.sessionManager = new CafeSessionManager({
      terminalPool: this.terminalPool,
      maxConcurrentOrdersPerCafe: 5,
    });

    // Session Manager 이벤트 전파
    this.sessionManager.on('output', (data) => {
      this.emit('order:output', { orderId: data.orderId, data: data.data });
    });
    this.sessionManager.on('session:started', (data) => {
      this.emit('order:started', data);
    });
    this.sessionManager.on('session:completed', (data) => {
      this.emit('order:completed', data);
    });
    this.sessionManager.on('session:failed', (data) => {
      this.emit('order:failed', data);
    });
    this.sessionManager.on('stage:started', (data) => {
      this.emit('stage:started', data);
    });
    this.sessionManager.on('stage:completed', (data) => {
      this.emit('stage:completed', data);
    });
    this.sessionManager.on('stage:failed', (data) => {
      this.emit('stage:failed', data);
    });
  }

  /**
   * Execute an order using Session (all orders go through session-based execution)
   */
  async executeOrder(order: Order, barista: Barista): Promise<void> {
    console.log(`BaristaEngineV2: Executing order ${order.id} with barista ${barista.id}`);

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
   * Execute order using Session (multi-terminal support)
   */
  private async executeWithSession(
    order: Order,
    barista: Barista,
    cafeId: string,
    cwd: string,
    workflowConfig: WorkflowConfig
  ): Promise<void> {
    console.log(`BaristaEngineV2: Executing order ${order.id} with Session (workflow mode)`);

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

    try {
      // 워크플로우 실행
      await session.execute(cwd);
      console.log(`BaristaEngineV2: Order ${order.id} completed via Session`);
    } catch (error) {
      console.error(`BaristaEngineV2: Order ${order.id} failed via Session:`, error);
      throw error;
    } finally {
      this.activeExecutions.delete(order.id);
    }
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

    console.log(`BaristaEngineV2: Executing order ${order.id} with Session (prompt mode)`);

    // Session 생성
    const session = this.sessionManager.createSession(order, barista, cafeId, cwd);

    // Active execution 등록
    this.activeExecutions.set(order.id, { baristaId: barista.id, session });

    try {
      // 프롬프트 실행
      await session.executePrompt(prompt, cwd);
      console.log(`BaristaEngineV2: Order ${order.id} completed via Session`);
    } catch (error) {
      console.error(`BaristaEngineV2: Order ${order.id} failed via Session:`, error);
      throw error;
    } finally {
      this.activeExecutions.delete(order.id);
    }
  }

  /**
   * Load default workflow from moon.workflow.yml
   */
  private async loadDefaultWorkflow(orderPrompt: string): Promise<WorkflowConfig> {
    // Get path relative to this file (works in both dev and built environments)
    // In dev: packages/orchestrator/src/barista/ -> need ../../../desktop/workflows
    // In prod: packages/orchestrator/dist/barista/ -> need ../../../../desktop/workflows
    // Use project root by going up from dist/src
    const projectRoot = path.join(__dirname, '../../..');
    const workflowPath = path.join(
      projectRoot,
      'desktop/workflows/moon.workflow.yml'
    );

    try {
      const content = await fs.readFile(workflowPath, 'utf-8');
      const parsed = yaml.parse(content) as {
        workflow: { stages: string[] };
      } & Record<string, { provider?: string; role?: string; mode?: string; on_failure?: string; skills?: string[] }>;

      // Convert YAML structure to WorkflowConfig
      const stages: StageConfig[] = parsed.workflow.stages.map((stageId: string) => {
        const stageConfig = parsed[stageId] as { provider?: string; role?: string; mode?: string };
        return {
          id: stageId,
          name: stageConfig.role || stageId,
          provider: (stageConfig.provider || 'claude-code') as 'claude-code' | 'codex' | 'gemini' | 'grok',
          prompt: orderPrompt, // Use order prompt for all stages
          role: stageConfig.role,
          mode: (stageConfig.mode || 'sequential') as 'sequential' | 'parallel',
          dependsOn: [],
        };
      });

      return { stages, vars: {} };
    } catch (error) {
      console.warn('[BaristaEngineV2] Failed to load default workflow:', error);
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
      console.log(`BaristaEngineV2: Order ${orderId} cancelled`);
      return true;
    } catch (error) {
      console.error(`BaristaEngineV2: Failed to cancel order ${orderId}:`, error);
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
      console.warn(`[BaristaEngineV2] No active session for order: ${orderId}`);
      return;
    }

    try {
      await execution.session.sendInput(message);
    } catch (error) {
      console.error(`[BaristaEngineV2] Failed to send input to order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    // Active executions 취소
    const cancellations = Array.from(this.activeExecutions.keys()).map(id => this.cancelOrder(id));
    await Promise.all(cancellations);
    this.activeExecutions.clear();

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
}
