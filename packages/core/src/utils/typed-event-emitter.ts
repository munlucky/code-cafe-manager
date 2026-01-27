/**
 * TypedEventEmitter - 타입 안전한 이벤트 이미터
 *
 * 기존 EventEmitter를 상속하여 타입 안전성을 제공합니다.
 * 이벤트 이름과 핸들러 시그니처를 컴파일 타임에 검증할 수 있습니다.
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
 * 이벤트 맵 타입 - 이벤트 이름과 핸들러 함수 시그니처의 매핑
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventMap = Record<string, (...args: any[]) => void>;

/**
 * 타입 안전한 EventEmitter 클래스
 *
 * @template T - 이벤트 맵 타입 (이벤트 이름 -> 핸들러 시그니처)
 */
export class TypedEventEmitter<T extends EventMap> extends EventEmitter {
  /**
   * 이벤트 발생
   * @param event - 이벤트 이름
   * @param args - 이벤트 핸들러에 전달할 인자들
   * @returns 리스너가 있으면 true, 없으면 false
   */
  emit<K extends keyof T & string>(event: K, ...args: Parameters<T[K]>): boolean {
    return super.emit(event, ...args);
  }

  /**
   * 이벤트 리스너 등록
   * @param event - 이벤트 이름
   * @param listener - 이벤트 핸들러 함수
   * @returns this (체이닝 지원)
   */
  on<K extends keyof T & string>(event: K, listener: T[K]): this {
    return super.on(event, listener);
  }

  /**
   * 일회성 이벤트 리스너 등록
   * @param event - 이벤트 이름
   * @param listener - 이벤트 핸들러 함수
   * @returns this (체이닝 지원)
   */
  once<K extends keyof T & string>(event: K, listener: T[K]): this {
    return super.once(event, listener);
  }

  /**
   * 이벤트 리스너 제거
   * @param event - 이벤트 이름
   * @param listener - 제거할 이벤트 핸들러 함수
   * @returns this (체이닝 지원)
   */
  off<K extends keyof T & string>(event: K, listener: T[K]): this {
    return super.off(event, listener);
  }

  /**
   * 이벤트 리스너 제거 (off의 alias)
   * @param event - 이벤트 이름
   * @param listener - 제거할 이벤트 핸들러 함수
   * @returns this (체이닝 지원)
   */
  removeListener<K extends keyof T & string>(event: K, listener: T[K]): this {
    return super.removeListener(event, listener);
  }

  /**
   * 특정 이벤트의 모든 리스너 또는 모든 이벤트의 리스너 제거
   * @param event - 이벤트 이름 (생략시 모든 이벤트)
   * @returns this (체이닝 지원)
   */
  removeAllListeners<K extends keyof T & string>(event?: K): this {
    return super.removeAllListeners(event);
  }

  /**
   * 특정 이벤트에 등록된 모든 리스너 반환
   * @param event - 이벤트 이름
   * @returns 리스너 함수 배열
   */
  listeners<K extends keyof T & string>(event: K): T[K][] {
    return super.listeners(event) as T[K][];
  }

  /**
   * 특정 이벤트에 등록된 리스너 수 반환
   * @param event - 이벤트 이름
   * @returns 리스너 수
   */
  listenerCount<K extends keyof T & string>(event: K): number {
    return super.listenerCount(event);
  }

  /**
   * 리스너 배열의 앞에 리스너 추가
   * @param event - 이벤트 이름
   * @param listener - 이벤트 핸들러 함수
   * @returns this (체이닝 지원)
   */
  prependListener<K extends keyof T & string>(event: K, listener: T[K]): this {
    return super.prependListener(event, listener);
  }

  /**
   * 리스너 배열의 앞에 일회성 리스너 추가
   * @param event - 이벤트 이름
   * @param listener - 이벤트 핸들러 함수
   * @returns this (체이닝 지원)
   */
  prependOnceListener<K extends keyof T & string>(event: K, listener: T[K]): this {
    return super.prependOnceListener(event, listener);
  }
}
