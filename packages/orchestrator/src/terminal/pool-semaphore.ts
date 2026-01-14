/**
 * Terminal Pool Semaphore Implementation
 * Gap 2 해결: Custom Semaphore with true pool size enforcement and cancellation
 */

import { ProviderType, Terminal } from '@codecafe/core';

export interface LeaseRequest {
  readonly id: string;
  readonly provider: ProviderType;
  readonly resolve: (terminal: Terminal) => void;
  readonly reject: (error: Error) => void;
  readonly terminalSupplier: () => Promise<Terminal>;
  timeoutId?: NodeJS.Timeout;
  aborted: boolean;
}

export class PoolSemaphore {
  private readonly activeLeases = new Set<string>(); // terminal IDs
  private readonly queue: LeaseRequest[] = [];
  private pendingCreations = 0;

  constructor(private readonly maxConcurrent: number) {}

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
        reject,
        terminalSupplier,
        aborted: false,
      };

      // Set timeout
      request.timeoutId = setTimeout(() => {
        this.handleTimeout(request, timeoutMs);
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
    if (this.activeLeases.delete(terminalId)) {
      this.processQueue();
    }
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
    return this.activeLeases.size + this.pendingCreations;
  }

  /**
   * Cancel a pending request
   */
  cancelRequest(requestId: string): boolean {
    const index = this.queue.findIndex(req => req.id === requestId);
    if (index === -1) {
      return false;
    }

    const request = this.queue[index];
    if (request.aborted) {
      return false;
    }

    this.abortRequest(request, new Error('Request cancelled'));
    this.queue.splice(index, 1);
    return true;
  }

  /**
   * Clean up all resources
   */
  dispose(): void {
    // Clear all timeouts
    for (const request of this.queue) {
      if (request.timeoutId) {
        clearTimeout(request.timeoutId);
      }
      if (!request.aborted) {
        request.reject(new Error('Semaphore disposed'));
      }
    }
    this.queue.length = 0;
    this.activeLeases.clear();
    this.pendingCreations = 0;
  }

  private processQueue(): void {
    // Process queue while we have capacity
    // Check both active leases and pending creations to enforce limit
    while (
      this.queue.length > 0 &&
      this.activeLeases.size + this.pendingCreations < this.maxConcurrent
    ) {
      const request = this.queue.shift();
      if (!request || request.aborted) continue;

      this.processRequest(request);
    }
  }

  private async processRequest(request: LeaseRequest): Promise<void> {
    this.pendingCreations++;

    // Clear timeout since we're processing
    if (request.timeoutId) {
      clearTimeout(request.timeoutId);
      request.timeoutId = undefined;
    }

    try {
      // Get terminal from supplier
      const terminal = await request.terminalSupplier();

      // If aborted during creation
      if (request.aborted) {
        this.pendingCreations--;
        return;
      }

      this.activeLeases.add(terminal.id);
      this.pendingCreations--;
      request.resolve(terminal);
    } catch (error) {
      this.pendingCreations--;
      if (!request.aborted) {
        request.reject(error as Error);
      }
      // Try to process next request since this one failed
      this.processQueue();
    }
  }

  private handleTimeout(request: LeaseRequest, timeoutMs: number): void {
    if (request.aborted) return;

    const index = this.queue.indexOf(request);
    if (index !== -1) {
      this.queue.splice(index, 1);
    }

    this.abortRequest(
      request,
      new TerminalLeaseTimeoutError(request.provider, timeoutMs)
    );
  }

  private abortRequest(request: LeaseRequest, error: Error): void {
    request.aborted = true;
    if (request.timeoutId) {
      clearTimeout(request.timeoutId);
      request.timeoutId = undefined;
    }
    request.reject(error);
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
