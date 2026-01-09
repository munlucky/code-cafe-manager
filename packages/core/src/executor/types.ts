import { Order, Recipe } from '../types.js';
import { BaristaManager } from '../barista.js';

/**
 * Execution context passed to executors
 */
export interface ExecutionContext {
  order: Order;
  recipe: Recipe;
  baristaManager: BaristaManager;
  providerFactory: ProviderFactory;
  stepOutputs: Map<string, any>; // Store outputs from executed steps
}

/**
 * Provider factory for creating providers
 */
export interface ProviderFactory {
  create(type: string, config?: any): any;
}

/**
 * Result of a single step execution
 */
export interface StepResult {
  stepId: string;
  status: 'success' | 'failed' | 'skipped';
  startedAt: Date;
  endedAt: Date;
  output?: string;
  error?: string;
  retryCount?: number;
  outputs?: Record<string, any>; // Named outputs for data flow
}

/**
 * Result of entire recipe execution
 */
export interface ExecutionResult {
  orderId: string;
  status: 'completed' | 'failed' | 'cancelled';
  steps: StepResult[];
  startedAt: Date;
  endedAt: Date;
  error?: string;
}

/**
 * Group of steps that can be executed in parallel
 */
export interface StepGroup {
  level: number;
  steps: import('../types.js').RecipeStep[];
}
