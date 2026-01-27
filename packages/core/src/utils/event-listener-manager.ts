/**
 * EventListenerManager - Memory leak 방지를 위한 이벤트 리스너 추적 유틸리티
 *
 * Usage:
 *   const manager = new EventListenerManager();
 *   manager.attach(emitter, 'event', handler);
 *   // ... later
 *   manager.detachAll(); // Removes all registered listeners
 */

import { EventEmitter } from 'events';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEventHandler = (...args: any[]) => void;

interface TrackedListener {
  emitter: EventEmitter;
  event: string;
  handler: AnyEventHandler;
}

export interface IEventListenerManager {
  attach<T extends EventEmitter>(emitter: T, event: string, handler: AnyEventHandler): void;
  attachOnce<T extends EventEmitter>(emitter: T, event: string, handler: AnyEventHandler): void;
  detachAll(): void;
  getListenerCount(): number;
}

/**
 * EventListenerManager tracks event listeners and provides centralized cleanup.
 * Helps prevent memory leaks by ensuring all listeners are properly removed.
 */
export class EventListenerManager implements IEventListenerManager {
  private readonly listeners: TrackedListener[] = [];

  /**
   * Attach a listener to an EventEmitter and track it for later cleanup.
   * @param emitter - The EventEmitter to attach the listener to
   * @param event - The event name
   * @param handler - The event handler function
   */
  attach<T extends EventEmitter>(emitter: T, event: string, handler: AnyEventHandler): void {
    emitter.on(event, handler);
    this.listeners.push({ emitter, event, handler });
  }

  /**
   * Attach a one-time listener to an EventEmitter and track it for cleanup.
   * The listener will be automatically removed after being called once.
   * @param emitter - The EventEmitter to attach the listener to
   * @param event - The event name
   * @param handler - The event handler function
   */
  attachOnce<T extends EventEmitter>(emitter: T, event: string, handler: AnyEventHandler): void {
    // Wrap handler to remove from tracking after first call
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wrappedHandler: AnyEventHandler = (...args: any[]) => {
      handler(...args);
      this.removeFromTracking(emitter, event, wrappedHandler);
    };

    emitter.once(event, wrappedHandler);
    this.listeners.push({ emitter, event, handler: wrappedHandler });
  }

  /**
   * Remove a specific listener from tracking (internal use).
   */
  private removeFromTracking(emitter: EventEmitter, event: string, handler: AnyEventHandler): void {
    const index = this.listeners.findIndex(
      (l) => l.emitter === emitter && l.event === event && l.handler === handler
    );
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Detach all tracked listeners from their emitters.
   * Call this in dispose() methods to prevent memory leaks.
   */
  detachAll(): void {
    for (const { emitter, event, handler } of this.listeners) {
      emitter.off(event, handler);
    }
    this.listeners.length = 0;
  }

  /**
   * Get the number of currently tracked listeners.
   * Useful for debugging and testing.
   */
  getListenerCount(): number {
    return this.listeners.length;
  }
}
