/**
 * Session State Machine - 상태 전이 및 생명주기 관리
 */

import { createLogger } from '@codecafe/core';
import { SessionState, canTransition, SESSION_TRANSITIONS } from './session-state';

const logger = createLogger({ context: 'SessionStateMachine' });

/**
 * 유효하지 않은 상태 전이 에러
 */
export class InvalidStateTransitionError extends Error {
  constructor(
    public readonly from: SessionState,
    public readonly to: SessionState
  ) {
    super(`Invalid state transition: ${from} -> ${to}`);
    this.name = 'InvalidStateTransitionError';
  }
}

/**
 * 세션 상태 정보
 */
export interface SessionStateMachineState {
  status: SessionState;
  startedAt: Date | null;
  completedAt: Date | null;
  error: string | null;
}

/**
 * 세션 상태 머신
 *
 * 상태 전이 규칙:
 * - created → running, cancelled
 * - running → awaiting_input, completed, failed, cancelled
 * - awaiting_input → running, cancelled
 * - completed → followup
 * - failed → running (retry only, cancelled 허용하지 않음)
 * - cancelled → (종료 상태)
 * - followup → completed, failed
 */
export class SessionStateMachine {
  private state: SessionState;
  private startedAt: Date | null = null;
  private completedAt: Date | null = null;
  private error: string | null = null;

  constructor(initialState: SessionState = 'created') {
    this.state = initialState;
    logger.debug(`SessionStateMachine initialized with state: ${initialState}`);
  }

  /**
   * 상태 전이 수행
   */
  transition(to: SessionState): void {
    if (!canTransition(this.state, to)) {
      throw new InvalidStateTransitionError(this.state, to);
    }

    const from = this.state;
    this.state = to;
    logger.debug(`State transition: ${from} -> ${to}`);

    // 상태 진입 시 부수 효과 처리
    this.handleStateEntry(to);
  }

  /**
   * 대상 상태로의 전이 가능 여부 확인
   */
  canTransitionTo(target: SessionState): boolean {
    return canTransition(this.state, target);
  }

  /**
   * 현재 상태 조회 (타입 호환용 별칭)
   */
  getState(): SessionState {
    return this.state;
  }

  /**
   * 현재 상태 조회 (호환용)
   */
  getStatus(): SessionState {
    return this.state;
  }

  /**
   * 전체 상태 정보 조회
   */
  getFullState(): SessionStateMachineState {
    return {
      status: this.state,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      error: this.error,
    };
  }

  /**
   * 상태 직접 설정 (복원용)
   */
  setState(status: SessionState): void {
    this.state = status;
    logger.debug(`State restored to: ${status}`);
  }

  /**
   * 상태 직접 설정 (호환용 별칭)
   */
  setStatus(status: SessionState): void {
    this.setState(status);
  }

  /**
   * 에러 설정
   */
  setError(error: string | null): void {
    this.error = error;
  }

  /**
   * 에러 조회
   */
  getError(): string | null {
    return this.error;
  }

  /**
   * 시작 시간 조회
   */
  getStartedAt(): Date | null {
    return this.startedAt;
  }

  /**
   * 시작 시간 설정
   */
  setStartedAt(date: Date | null): void {
    this.startedAt = date;
  }

  /**
   * 완료 시간 조회
   */
  getCompletedAt(): Date | null {
    return this.completedAt;
  }

  /**
   * 완료 시간 설정
   */
  setCompletedAt(date: Date | null): void {
    this.completedAt = date;
  }

  /**
   * 세션 실행 시간 계산
   */
  getDuration(): number | null {
    if (!this.startedAt || !this.completedAt) {
      return null;
    }
    return this.completedAt.getTime() - this.startedAt.getTime();
  }

  /**
   * 편의 메서드: 세션 시작 (created → running)
   */
  start(): void {
    this.transition('running');
  }

  /**
   * 편의 메서드: 세션 완료
   */
  complete(): void {
    this.transition('completed');
  }

  /**
   * 편의 메서드: 세션 실패
   */
  fail(error: string): void {
    this.error = error;
    this.transition('failed');
  }

  /**
   * 편의 메서드: 세션 취소
   */
  cancel(): void {
    this.transition('cancelled');
  }

  /**
   * 편의 메서드: 대기 상태로 전환 (running → awaiting_input)
   */
  setAwaiting(): void {
    this.transition('awaiting_input');
  }

  /**
   * 편의 메서드: 재개 (awaiting_input/failed → running)
   */
  resume(): void {
    if (this.state !== 'awaiting_input' && this.state !== 'failed') {
      throw new InvalidStateTransitionError(this.state, 'running');
    }
    this.transition('running');
  }

  /**
   * 편의 메서드: Followup 모드 진입 (completed → followup)
   */
  enterFollowup(): void {
    this.transition('followup');
  }

  /**
   * 상태 진입 시 부수 효과 처리
   */
  private handleStateEntry(state: SessionState): void {
    switch (state) {
      case 'running':
        this.startedAt = this.startedAt || new Date();
        this.error = null;
        this.completedAt = null;
        break;

      case 'completed':
        if (!this.completedAt) {
          this.completedAt = new Date();
        }
        break;

      case 'failed':
        if (!this.error) {
          this.error = 'Stage execution failed';
        }
        break;

      case 'cancelled':
        this.error = this.error || 'Cancelled by user';
        this.completedAt = this.completedAt || new Date();
        break;
    }
  }

  /**
   * 유효한 전이 목록 조회 (디버깅용)
   */
  getValidTransitions(from?: SessionState): SessionState[] {
    const key = from ?? this.state;
    return SESSION_TRANSITIONS[key] ?? [];
  }
}

/**
 * 싱글톤 팩토리
 */
export function createSessionStateMachine(initialState?: SessionState): SessionStateMachine {
  return new SessionStateMachine(initialState);
}
