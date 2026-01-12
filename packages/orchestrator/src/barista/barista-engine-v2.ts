/**
 * Barista Engine V2
 * Phase 2: Terminal Pool based execution engine with Role support
 */

import { Barista, Order, BaristaStatus } from '@codecafe/core';
import { Step } from '@codecafe/core';
import { TerminalPool, TerminalLease } from '../terminal/terminal-pool';
import { ProviderAdapterFactory } from '../terminal/provider-adapter';
import { RoleManager } from '../role/role-manager';
import { Role } from '../types';

/**
 * Barista Engine V2 - Terminal Pool based execution
 */
export class BaristaEngineV2 {
  private terminalPool: TerminalPool;
  private roleManager: RoleManager;
  private activeExecutions: Map<string, { baristaId: string; lease: TerminalLease }> = new Map();

  constructor(terminalPool: TerminalPool, roleManager?: RoleManager) {
    this.terminalPool = terminalPool;
    this.roleManager = roleManager || new RoleManager();
  }

  /**
   * Execute an order using Terminal Pool
   */
  async executeOrder(order: Order, barista: Barista): Promise<void> {
    console.log(`BaristaEngineV2: Executing order ${order.id} with barista ${barista.id}`);

    // Get role configuration
    const role = barista.role ? this.roleManager.loadRole(barista.role) : null;
    if (!role && barista.role) {
      throw new Error(`Role '${barista.role}' not found for barista ${barista.id}`);
    }

    // Acquire terminal lease
    const provider = barista.provider;
    const lease = await this.terminalPool.acquireLease(provider, barista.id);

    try {
      // Store active execution
      this.activeExecutions.set(order.id, { baristaId: barista.id, lease });

      // Execute each step if available
      if (order.steps && order.steps.length > 0) {
        for (const step of order.steps) {
          await this.executeStep(step, barista, lease, role);
        }
      } else {
        // Legacy mode: execute order directly
        await this.executeLegacyOrder(order, barista, lease, role);
      }

      console.log(`BaristaEngineV2: Order ${order.id} completed successfully`);
    } catch (error) {
      console.error(`BaristaEngineV2: Order ${order.id} failed:`, error);
      throw error;
    } finally {
      // Release lease
      await lease.release();
      this.activeExecutions.delete(order.id);
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
      // Prepare execution context
      const context = this.prepareExecutionContext(step, role);

      // Execute via adapter
      const result = await adapter.execute(lease.terminal.process, context);

      // Handle result
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
  private prepareExecutionContext(step: Step, role: Role | null): any {
    const context: any = {
      stepId: step.id,
      task: step.task,
      parameters: step.parameters || {},
    };

    // Add role-specific context if available
    if (role) {
      context.role = {
        id: role.id,
        name: role.name,
        template: role.template,
        skills: role.inputs || [],
      };

      // Apply role template variables
      if (role.template && step.parameters) {
        // Simple template variable replacement
        let template = role.template;
        for (const [key, value] of Object.entries(step.parameters)) {
          template = template.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
        }
        context.systemPrompt = template;
      }
    }

    return context;
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

    const context: any = {
      orderId: order.id,
      workflowId: order.workflowId,
      workflowName: order.workflowName,
      vars: order.vars || {},
    };

    // Add role context if available
    if (role) {
      context.role = {
        id: role.id,
        name: role.name,
        template: role.template,
        skills: role.inputs || [],
      };
    }

    const adapter = ProviderAdapterFactory.get(barista.provider);
    const result = await adapter.execute(lease.terminal.process, context);

    if (!result.success) {
      throw new Error(`Legacy order execution failed: ${result.error}`);
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
      // Kill terminal process
      const adapter = ProviderAdapterFactory.get(execution.lease.terminal.provider);
      await adapter.kill(execution.lease.terminal.process);

      // Release lease
      await execution.lease.release();
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
  getActiveExecutions(): Map<string, { baristaId: string; lease: TerminalLease }> {
    return new Map(this.activeExecutions);
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    // Cancel all active executions
    for (const [orderId] of this.activeExecutions) {
      await this.cancelOrder(orderId);
    }

    this.activeExecutions.clear();
  }
}