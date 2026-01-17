/**
 * Barista Engine V2
 * Phase 2: Terminal Pool based execution engine with Role support
 * Phase 3: Session-based multi-terminal orchestration
 */

import { Barista, Order, Step } from '@codecafe/core';
import { TerminalPool, TerminalLease } from '../terminal/terminal-pool';
import { ProviderAdapterFactory } from '../terminal/provider-adapter';
import { RoleManager } from '../role/role-manager';
import { Role } from '../types';
import {
  OrderSession,
  CafeSessionManager,
  WorkflowConfig,
  SessionStageConfig,
  SessionStatusSummary
} from '../session';

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
  lease?: TerminalLease;
  session?: OrderSession;
}

/**
 * Barista Engine V2 - Terminal Pool based execution with Session support
 */
export class BaristaEngineV2 extends EventEmitter {
  private readonly terminalPool: TerminalPool;
  private readonly roleManager: RoleManager;
  private readonly sessionManager: CafeSessionManager;
  private readonly activeExecutions = new Map<string, ActiveExecution>();

  constructor(terminalPool: TerminalPool, roleManager?: RoleManager) {
    super();
    this.terminalPool = terminalPool;
    this.roleManager = roleManager || new RoleManager();

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
   * Execute an order using Terminal Pool or Session (for workflows)
   */
  async executeOrder(order: Order, barista: Barista): Promise<void> {
    console.log(`BaristaEngineV2: Executing order ${order.id} with barista ${barista.id}`);

    // Extract CWD from order variables if available
    const cwd = order.vars?.['PROJECT_ROOT'] || process.cwd();
    const cafeId = order.cafeId || 'default';

    // 워크플로우 설정이 있는 경우 Session 사용
    const workflowConfig = (order as OrderWithWorkflow).workflowConfig;
    if (workflowConfig && workflowConfig.stages && workflowConfig.stages.length > 0) {
      await this.executeWithSession(order, barista, cafeId, cwd, workflowConfig);
      return;
    }

    // 기존 방식 (Legacy 또는 Steps)
    const role = this.getRoleForBarista(barista);

    if (cwd) {
      console.log(`[BaristaEngineV2] Using requested CWD for order ${order.id}: ${cwd}`);
    }

    const lease = await this.terminalPool.acquireLease(barista.provider, barista.id, cwd);

    try {
      this.activeExecutions.set(order.id, { baristaId: barista.id, lease });

      if (this.hasSteps(order)) {
        await this.executeSteps(order.id, order.steps, barista, lease, role);
      } else {
        await this.executeLegacyOrder(order, barista, lease, role);
      }

      console.log(`BaristaEngineV2: Order ${order.id} completed successfully`);
    } catch (error) {
      console.error(`BaristaEngineV2: Order ${order.id} failed:`, error);
      throw error;
    } finally {
      await this.releaseLease(order.id, lease);
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
   * Cancel order execution
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(orderId);
    if (!execution) {
      return false;
    }

    try {
      // Session 기반 실행인 경우
      if (execution.session) {
        await execution.session.cancel();
        this.activeExecutions.delete(orderId);
        console.log(`BaristaEngineV2: Order ${orderId} cancelled (session)`);
        return true;
      }

      // Legacy 실행인 경우
      if (execution.lease) {
        const adapter = ProviderAdapterFactory.get(execution.lease.terminal.provider);
        await adapter.kill(execution.lease.terminal.process);
        await this.releaseLease(orderId, execution.lease);
        console.log(`BaristaEngineV2: Order ${orderId} cancelled (legacy)`);
        return true;
      }

      return false;
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
    if (!execution) {
      console.warn(`[BaristaEngineV2] No active execution for order to send input: ${orderId}`);
      return;
    }

    try {
      // Session 기반 실행인 경우
      if (execution.session) {
        await execution.session.sendInput(message);
        return;
      }

      // Legacy 실행인 경우
      if (execution.lease) {
        execution.lease.terminal.process.write(message + '\n');
        return;
      }

      console.warn(`[BaristaEngineV2] No active terminal for order: ${orderId}`);
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

  private getRoleForBarista(barista: Barista): Role | null {
    if (!barista.role) {
      return null;
    }

    const role = this.roleManager.loadRole(barista.role);
    if (!role) {
      throw new Error(`Role '${barista.role}' not found for barista ${barista.id}`);
    }

    return role;
  }

  private hasSteps(order: Order): order is Order & { steps: Step[] } {
    return Array.isArray(order.steps) && order.steps.length > 0;
  }

  private async executeSteps(
    orderId: string,
    steps: Step[],
    barista: Barista,
    lease: TerminalLease,
    role: Role | null
  ): Promise<void> {
    for (const step of steps) {
      await this.executeStep(orderId, step, barista, lease, role);
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    orderId: string,
    step: Step,
    barista: Barista,
    lease: TerminalLease,
    role: Role | null
  ): Promise<void> {
    console.log(`BaristaEngineV2: Executing step ${step.id}`);

    const adapter = ProviderAdapterFactory.get(barista.provider);

    try {
      const context = this.prepareExecutionContext(step, role);
      const result = await adapter.execute(lease.terminal.process, context, (data) => {
        this.emit('order:output', { orderId, data });
      });

      if (result.success) {
        console.log(`BaristaEngineV2: Step ${step.id} completed`);
        // TODO: Store step result in order history
      } else {
        throw new Error(`Step ${step.id} failed: ${result.error}`);
      }
    } catch (error) {
      console.error(`BaristaEngineV2: Step ${step.id} failed:`, error);
      throw error;
    }
  }

  /**
   * Prepare execution context from step and role
   */
  private prepareExecutionContext(step: Step, role: Role | null): Record<string, unknown> {
    const context: Record<string, unknown> = {
      stepId: step.id,
      task: step.task,
      parameters: step.parameters || {},
    };

    this.addRoleContextToRecord(context, role);

    if (role?.template && step.parameters) {
      context.systemPrompt = this.interpolateTemplate(role.template, step.parameters);
    }

    return context;
  }

  private buildRoleContext(role: Role) {
    return {
      id: role.id,
      name: role.name,
      template: role.template,
      skills: role.inputs || [],
    };
  }

  private addRoleContextToRecord(context: Record<string, unknown>, role: Role | null): void {
    if (role) {
      Object.assign(context, { role: this.buildRoleContext(role) });
    }
  }

  private interpolateTemplate(template: string, parameters: Record<string, unknown>): string {
    let result = template;
    for (const [key, value] of Object.entries(parameters)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }
    return result;
  }

  /**
   * Legacy order execution (for backward compatibility)
   */
  private async executeLegacyOrder(
    order: Order,
    barista: Barista,
    lease: TerminalLease,
    role: Role | null
  ): Promise<void> {
    console.log(`BaristaEngineV2: Executing legacy order ${order.id}`);

    // order.prompt는 ExecutionManager에서 추가됨 (Order 인터페이스에 이미 정의됨)
    const prompt = order.prompt;
    if (!prompt) {
      throw new Error(`No prompt found for legacy order ${order.id}`);
    }

    console.log(`BaristaEngineV2: Sending prompt to terminal: ${prompt.substring(0, 100)}...`);

    const adapter = ProviderAdapterFactory.get(barista.provider);
    // 프롬프트를 직접 문자열로 전달 (JSON.stringify 방지)
    const result = await adapter.execute(lease.terminal.process, prompt, (data) => {
      this.emit('order:output', { orderId: order.id, data });
    });

    if (!result.success) {
      throw new Error(`Legacy order execution failed: ${result.error}`);
    }
  }

  private async releaseLease(orderId: string, lease: TerminalLease): Promise<void> {
    await lease.release();
    this.activeExecutions.delete(orderId);
  }
}
