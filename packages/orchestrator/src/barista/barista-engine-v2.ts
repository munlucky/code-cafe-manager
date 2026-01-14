/**
 * Barista Engine V2
 * Phase 2: Terminal Pool based execution engine with Role support
 */

import { Barista, Order, Step } from '@codecafe/core';
import { TerminalPool, TerminalLease } from '../terminal/terminal-pool';
import { ProviderAdapterFactory } from '../terminal/provider-adapter';
import { RoleManager } from '../role/role-manager';
import { Role } from '../types';

interface ActiveExecution {
  baristaId: string;
  lease: TerminalLease;
}

/**
 * Barista Engine V2 - Terminal Pool based execution
 */
export class BaristaEngineV2 {
  private readonly terminalPool: TerminalPool;
  private readonly roleManager: RoleManager;
  private readonly activeExecutions = new Map<string, ActiveExecution>();

  constructor(terminalPool: TerminalPool, roleManager?: RoleManager) {
    this.terminalPool = terminalPool;
    this.roleManager = roleManager || new RoleManager();
  }

  /**
   * Execute an order using Terminal Pool
   */
  async executeOrder(order: Order, barista: Barista): Promise<void> {
    console.log(`BaristaEngineV2: Executing order ${order.id} with barista ${barista.id}`);

    const role = this.getRoleForBarista(barista);
    const lease = await this.terminalPool.acquireLease(barista.provider, barista.id);

    try {
      this.activeExecutions.set(order.id, { baristaId: barista.id, lease });

      if (this.hasSteps(order)) {
        await this.executeSteps(order.steps, barista, lease, role);
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
   * Cancel order execution
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(orderId);
    if (!execution) {
      return false;
    }

    try {
      const { lease } = execution;
      const adapter = ProviderAdapterFactory.get(lease.terminal.provider);

      await adapter.kill(lease.terminal.process);
      await this.releaseLease(orderId, lease);

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
   * Clean up resources
   */
  async dispose(): Promise<void> {
    const cancellations = Array.from(this.activeExecutions.keys()).map(id => this.cancelOrder(id));
    await Promise.all(cancellations);
    this.activeExecutions.clear();
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
    steps: Step[],
    barista: Barista,
    lease: TerminalLease,
    role: Role | null
  ): Promise<void> {
    for (const step of steps) {
      await this.executeStep(step, barista, lease, role);
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    step: Step,
    barista: Barista,
    lease: TerminalLease,
    role: Role | null
  ): Promise<void> {
    console.log(`BaristaEngineV2: Executing step ${step.id}`);

    const adapter = ProviderAdapterFactory.get(barista.provider);

    try {
      const context = this.prepareExecutionContext(step, role);
      const result = await adapter.execute(lease.terminal.process, context);

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

    const context: Record<string, unknown> = {
      orderId: order.id,
      workflowId: order.workflowId,
      workflowName: order.workflowName,
      vars: order.vars || {},
    };

    this.addRoleContextToRecord(context, role);

    const adapter = ProviderAdapterFactory.get(barista.provider);
    const result = await adapter.execute(lease.terminal.process, context);

    if (!result.success) {
      throw new Error(`Legacy order execution failed: ${result.error}`);
    }
  }

  private async releaseLease(orderId: string, lease: TerminalLease): Promise<void> {
    await lease.release();
    this.activeExecutions.delete(orderId);
  }
}
