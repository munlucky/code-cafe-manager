/**
 * TypedEventEmitter - Type-safe event emitter
 *
 * Extends EventEmitter to provide type safety.
 * Validates event names and handler signatures at compile time.
 *
 * @example
 * interface MyEvents {
 *   'data': (payload: string) => void;
 *   'error': (error: Error) => void;
 * }
 *
 * class MyClass extends TypedEventEmitter<MyEvents> {
 *   process() {
 *     this.emit('data', 'hello');  // OK
 *     this.emit('data', 123);       // Compile error: number is not assignable to string
 *     this.emit('unknown', 'test'); // Compile error: 'unknown' is not a valid event
 *   }
 * }
 */

import { EventEmitter } from 'events';

/**
 * Event map type - Mapping of event names to handler function signatures
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventMap = Record<string, (...args: any[]) => void>;

/**
 * Type-safe EventEmitter class
 *
 * @template T - Event map type (event name -> handler signature)
 */
export class TypedEventEmitter<T extends EventMap> extends EventEmitter {
  /**
   * Emit an event
   * @param event - Event name
   * @param args - Arguments to pass to event handlers
   * @returns true if listeners exist, false otherwise
   */
  emit<K extends keyof T & string>(event: K, ...args: Parameters<T[K]>): boolean {
    return super.emit(event, ...args);
  }

  /**
   * Register an event listener
   * @param event - Event name
   * @param listener - Event handler function
   * @returns this (supports chaining)
   */
  on<K extends keyof T & string>(event: K, listener: T[K]): this {
    return super.on(event, listener);
  }

  /**
   * Register a one-time event listener
   * @param event - Event name
   * @param listener - Event handler function
   * @returns this (supports chaining)
   */
  once<K extends keyof T & string>(event: K, listener: T[K]): this {
    return super.once(event, listener);
  }

  /**
   * Remove an event listener
   * @param event - Event name
   * @param listener - Event handler function to remove
   * @returns this (supports chaining)
   */
  off<K extends keyof T & string>(event: K, listener: T[K]): this {
    return super.off(event, listener);
  }

  /**
   * Remove an event listener (alias for off)
   * @param event - Event name
   * @param listener - Event handler function to remove
   * @returns this (supports chaining)
   */
  removeListener<K extends keyof T & string>(event: K, listener: T[K]): this {
    return super.removeListener(event, listener);
  }

  /**
   * Remove all listeners for a specific event or all events
   * @param event - Event name (if omitted, removes listeners for all events)
   * @returns this (supports chaining)
   */
  removeAllListeners<K extends keyof T & string>(event?: K): this {
    return super.removeAllListeners(event);
  }

  /**
   * Return all listeners registered for a specific event
   * @param event - Event name
   * @returns Array of listener functions
   */
  listeners<K extends keyof T & string>(event: K): T[K][] {
    return super.listeners(event) as T[K][];
  }

  /**
   * Return the number of listeners registered for a specific event
   * @param event - Event name
   * @returns Number of listeners
   */
  listenerCount<K extends keyof T & string>(event: K): number {
    return super.listenerCount(event);
  }

  /**
   * Add a listener to the beginning of the listener array
   * @param event - Event name
   * @param listener - Event handler function
   * @returns this (supports chaining)
   */
  prependListener<K extends keyof T & string>(event: K, listener: T[K]): this {
    return super.prependListener(event, listener);
  }

  /**
   * Add a one-time listener to the beginning of the listener array
   * @param event - Event name
   * @param listener - Event handler function
   * @returns this (supports chaining)
   */
  prependOnceListener<K extends keyof T & string>(event: K, listener: T[K]): this {
    return super.prependOnceListener(event, listener);
  }
}
