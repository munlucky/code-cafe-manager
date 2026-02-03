/**
 * Event Forwarder Utility
 *
 * Reduces boilerplate for forwarding events between EventEmitters
 * Extracted from cafe-session-manager.ts, order-session.ts, terminal-pool.ts
 */

import { EventEmitter } from 'events';
import { EventListenerManager } from '@codecafe/core';

/**
 * Options for event forwarding
 */
export interface EventForwardOptions {
  /** Transform event data before forwarding */
  transform?: (data: unknown) => unknown;
  /** Filter events (return false to skip forwarding) */
  filter?: (data: unknown) => boolean;
}

/**
 * Event Forwarder - simplifies forwarding events between emitters
 */
export class EventForwarder {
  /**
   * Relay events from source to target
   *
   * @param source Source EventEmitter
   * @param target Target EventEmitter
   * @param events Array of event names to forward
   * @param listenerManager Optional manager for cleanup (recommended)
   * @returns Cleanup function (only if listenerManager not provided)
   *
   * @example
   * // With EventListenerManager (recommended)
   * EventForwarder.relay(engine, this, [
   *   'order:started',
   *   'order:output',
   *   'order:completed',
   * ], this.listenerManager);
   *
   * // Without EventListenerManager
   * const cleanup = EventForwarder.relay(engine, this, ['order:started']);
   * // Later: cleanup();
   */
  static relay(
    source: EventEmitter,
    target: EventEmitter,
    events: string[],
    listenerManager?: EventListenerManager
  ): (() => void) | undefined {
    const cleanups: Array<() => void> = [];

    for (const event of events) {
      const handler = (data: unknown) => target.emit(event, data);

      if (listenerManager) {
        listenerManager.attach(source, event, handler);
      } else {
        source.on(event, handler);
        cleanups.push(() => source.off(event, handler));
      }
    }

    // Only return cleanup function if listenerManager not provided
    return listenerManager ? undefined : () => cleanups.forEach((fn) => fn());
  }

  /**
   * Relay events with transformation or filtering
   *
   * @param source Source EventEmitter
   * @param target Target EventEmitter
   * @param eventMap Map of source event to target event with options
   * @param listenerManager Optional manager for cleanup
   *
   * @example
   * EventForwarder.relayWithMap(session, engine, {
   *   'session:started': { targetEvent: 'order:started' },
   *   'session:output': {
   *     targetEvent: 'order:output',
   *     transform: (data) => ({ ...data, processed: true }),
   *   },
   * }, listenerManager);
   */
  static relayWithMap(
    source: EventEmitter,
    target: EventEmitter,
    eventMap: Record<string, { targetEvent: string } & EventForwardOptions>,
    listenerManager?: EventListenerManager
  ): (() => void) | undefined {
    const cleanups: Array<() => void> = [];

    for (const [sourceEvent, config] of Object.entries(eventMap)) {
      const handler = (data: unknown) => {
        // Apply filter if provided
        if (config.filter && !config.filter(data)) {
          return;
        }

        // Apply transform if provided
        const transformedData = config.transform ? config.transform(data) : data;

        target.emit(config.targetEvent, transformedData);
      };

      if (listenerManager) {
        listenerManager.attach(source, sourceEvent, handler);
      } else {
        source.on(sourceEvent, handler);
        cleanups.push(() => source.off(sourceEvent, handler));
      }
    }

    return listenerManager ? undefined : () => cleanups.forEach((fn) => fn());
  }

  /**
   * Forward a single event once (auto-removes after first fire)
   *
   * @param source Source EventEmitter
   * @param target Target EventEmitter
   * @param event Event name
   * @param options Optional transform/filter
   */
  static relayOnce(
    source: EventEmitter,
    target: EventEmitter,
    event: string,
    options?: EventForwardOptions
  ): void {
    source.once(event, (data: unknown) => {
      if (options?.filter && !options.filter(data)) {
        return;
      }
      const transformedData = options?.transform ? options.transform(data) : data;
      target.emit(event, transformedData);
    });
  }
}
