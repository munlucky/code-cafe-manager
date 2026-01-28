/**
 * Run Registry
 * Manages active workflow runs and provides centralized access
 */

import { WorkflowRun, RunStatus } from '../types';
import { TIMEOUTS } from '@codecafe/core';

/**
 * Run entry in registry
 */
interface RunEntry {
  run: WorkflowRun;
  createdAt: number;
  lastAccessedAt: number;
}

/**
 * Run Registry
 * Singleton registry for tracking active workflow runs
 */
export class RunRegistry {
  private static instance: RunRegistry;
  private runs: Map<string, RunEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly TTL = TIMEOUTS.DAY; // 24 hours

  private constructor() {
    this.startCleanup();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): RunRegistry {
    if (!RunRegistry.instance) {
      RunRegistry.instance = new RunRegistry();
    }
    return RunRegistry.instance;
  }

  /**
   * Register a new run
   */
  register(run: WorkflowRun): void {
    this.runs.set(run.runId, {
      run,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
    });
  }

  /**
   * Unregister a run
   */
  unregister(runId: string): void {
    this.runs.delete(runId);
  }

  /**
   * Get a run by ID
   */
  get(runId: string): WorkflowRun | undefined {
    const entry = this.runs.get(runId);
    if (entry) {
      entry.lastAccessedAt = Date.now();
      return entry.run;
    }
    return undefined;
  }

  /**
   * Update run status
   */
  updateStatus(runId: string, status: RunStatus): boolean {
    const entry = this.runs.get(runId);
    if (entry) {
      entry.run.status = status;
      entry.lastAccessedAt = Date.now();
      if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        entry.run.completedAt = new Date().toISOString();
      }
      return true;
    }
    return false;
  }

  /**
   * List all active runs
   */
  listAll(): WorkflowRun[] {
    return Array.from(this.runs.values()).map(entry => entry.run);
  }

  /**
   * List runs by workflow ID
   */
  listByWorkflow(workflowId: string): WorkflowRun[] {
    return Array.from(this.runs.values())
      .map(entry => entry.run)
      .filter(run => run.workflowId === workflowId);
  }

  /**
   * List runs by status
   */
  listByStatus(status: RunStatus): WorkflowRun[] {
    return Array.from(this.runs.values())
      .map(entry => entry.run)
      .filter(run => run.status === status);
  }

  /**
   * Get active (running or paused) runs
   */
  getActiveRuns(): WorkflowRun[] {
    return Array.from(this.runs.values())
      .map(entry => entry.run)
      .filter(run => run.status === 'running' || run.status === 'paused');
  }

  /**
   * Get count of runs by status
   */
  getCountByStatus(): Record<RunStatus, number> {
    const counts: Record<string, number> = {};
    for (const entry of this.runs.values()) {
      const status = entry.run.status;
      counts[status] = (counts[status] || 0) + 1;
    }
    return counts as Record<RunStatus, number>;
  }

  /**
   * Check if run exists
   */
  has(runId: string): boolean {
    return this.runs.has(runId);
  }

  /**
   * Start periodic cleanup of old runs
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, TIMEOUTS.SESSION_CLEANUP); // Every hour
  }

  /**
   * Clean up completed/failed/cancelled runs older than TTL
   */
  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [runId, entry] of this.runs.entries()) {
      const isTerminal = entry.run.status === 'completed' ||
                        entry.run.status === 'failed' ||
                        entry.run.status === 'cancelled';
      const isOld = (now - entry.lastAccessedAt) > this.TTL;

      if (isTerminal && isOld) {
        toDelete.push(runId);
      }
    }

    for (const runId of toDelete) {
      this.runs.delete(runId);
    }
  }

  /**
   * Clear all runs (for testing)
   */
  clear(): void {
    this.runs.clear();
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    total: number;
    active: number;
    completed: number;
    failed: number;
    cancelled: number;
    paused: number;
  } {
    let active = 0;
    let completed = 0;
    let failed = 0;
    let cancelled = 0;
    let paused = 0;

    for (const entry of this.runs.values()) {
      switch (entry.run.status) {
        case 'running':
          active++;
          break;
        case 'paused':
          paused++;
          break;
        case 'completed':
          completed++;
          break;
        case 'failed':
          failed++;
          break;
        case 'cancelled':
          cancelled++;
          break;
      }
    }

    return {
      total: this.runs.size,
      active,
      completed,
      failed,
      cancelled,
      paused,
    };
  }

  /**
   * Shutdown cleanup interval
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}
