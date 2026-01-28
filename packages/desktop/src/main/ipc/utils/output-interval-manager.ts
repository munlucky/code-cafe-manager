/**
 * Output subscription interval management
 */

import { createLogger } from '@codecafe/core';

const logger = createLogger({ context: 'OutputIntervalManager' });

/**
 * Manages intervals for order output subscriptions
 */
export class OutputIntervalManager {
  private static intervals = new Map<string, NodeJS.Timeout>();

  static clear(orderId: string): void {
    const key = `order:output:${orderId}`;
    const interval = this.intervals.get(key);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(key);
    }
  }

  static clearAll(): void {
    for (const [key, interval] of this.intervals) {
      clearInterval(interval);
      logger.info('Cleared interval', { key });
    }
    this.intervals.clear();
  }
}
