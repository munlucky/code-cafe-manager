/**
 * Terminal Pool Semaphore Implementation
 * Gap 2 해결: Custom Semaphore with true pool size enforcement and cancellation
 */

import { ProviderType } from '@codecafe/core';
import { Terminal, LeaseToken } from '@codecafe/core';

export interface LeaseRequest {
  id: string;
  provider: ProviderType;
  resolve: (terminal: Terminal) => void;
  terminalSupplier: () => Promise<Terminal>;
  reject: (error: Error) => void;
  timeoutId?: NodeJS.Timeout;
  aborted: boolean;
}

export class PoolSemaphore {
  private activeLeases: Set<string> = new Set(); // terminal IDs
  private queue: LeaseRequest[] = [];
  private maxConcurrent: number;

  constructor(maxConcurrent: number) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Request a lease slot
   * @returns Promise that resolves when slot is available
   * @throws TerminalLeaseTimeoutError if timeout expires
   */
  async acquire(
    provider: ProviderType,
    timeoutMs: number,
    terminalSupplier: () => Promise<Terminal>
  ): Promise<Terminal> {
    return new Promise((resolve, reject) => {
      const request: LeaseRequest = {
        id: `req-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        provider,
        resolve,
        terminalSupplier,
        reject,
        aborted: false,
      };

      // Set timeout
      request.timeoutId = setTimeout(() => {
        request.aborted = true;
        this.removeFromQueue(request.id);
        reject(new TerminalLeaseTimeoutError(provider, timeoutMs));
      }, timeoutMs);

      // Add to queue
      this.queue.push(request);
      this.processQueue();
    });
  }

  /**
   * Release a lease slot
   */
  release(terminalId: string): void {
    this.activeLeases.delete(terminalId);
    this.processQueue();
  }

  /**
   * Get current queue length
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Get active lease count
   */
  getActiveLeaseCount(): number {
    return this.activeLeases.size;
  }

  /**
   * Cancel a pending request
   */
  cancelRequest(requestId: string): boolean {
    const request = this.queue.find(req => req.id === requestId);
    if (request && !request.aborted) {
      request.aborted = true;
      this.removeFromQueue(requestId);
      request.reject(new Error('Request cancelled'));
      return true;
    }
    return false;
  }

  /**
   * Clean up all resources
   */
  dispose(): void {
    // Clear all timeouts
    this.queue.forEach(request => {
      if (request.timeoutId) {
        clearTimeout(request.timeoutId);
      }
      if (!request.aborted) {
        request.reject(new Error('Semaphore disposed'));
      }
    });
    this.queue = [];
    this.activeLeases.clear();
  }

  private async processQueue(): Promise<void> {
    // Remove aborted requests
    this.queue = this.queue.filter(req => !req.aborted);

    // Process queue while we have capacity
    while (this.queue.length > 0 && this.activeLeases.size < this.maxConcurrent) {
      const request = this.queue.shift();
      if (!request || request.aborted) continue;

      try {
        // Clear timeout since we're processing
        if (request.timeoutId) {
          clearTimeout(request.timeoutId);
        }

        // Get terminal from supplier
        const terminal = await request.terminalSupplier();
        this.activeLeases.add(terminal.id);
        request.resolve(terminal);
      } catch (error) {
        request.reject(error as Error);
      }
    }
  }

  private removeFromQueue(requestId: string): void {
    const index = this.queue.findIndex(req => req.id === requestId);
    if (index !== -1) {
      const request = this.queue[index];
      if (request.timeoutId) {
        clearTimeout(request.timeoutId);
      }
      this.queue.splice(index, 1);
    }
  }
}

/**
 * Custom error for lease timeout
 */
export class TerminalLeaseTimeoutError extends Error {
  constructor(
    public readonly provider: ProviderType,
    public readonly timeoutMs: number
  ) {
    super(`Terminal lease timeout for ${provider} after ${timeoutMs}ms`);
    this.name = 'TerminalLeaseTimeoutError';
  }
}