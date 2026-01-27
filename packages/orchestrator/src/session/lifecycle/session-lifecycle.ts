/**
 * SessionLifecycle - 세션 상태 전이 및 생명주기 관리
 */

import { createLogger } from '@codecafe/core';

const logger = createLogger({ context: 'SessionLifecycle' });

export type SessionStatus =
  | 'created'
  | 'running'
  | 'awaiting_input'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'followup';

export interface SessionLifecycleState {
  status: SessionStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  error: string | null;
}

/**
 * 유효한 상태 전이 정의
 */
const VALID_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  created: ['running'],
  running: ['awaiting_input', 'completed', 'failed', 'cancelled'],
  awaiting_input: ['running', 'cancelled'],
  completed: ['followup'],
  failed: ['running'], // retry시 running으로 전이
  cancelled: [],
  followup: ['completed', 'failed'],
};

/**
 * 세션 생명주기 관리 클래스
 */
export class SessionLifecycle {
  private status: SessionStatus;
  private startedAt: Date | null = null;
  private completedAt: Date | null = null;
  private error: string | null = null;

  constructor(initialStatus: SessionStatus = 'created') {
    this.status = initialStatus;
  }

  /**
   * 세션 시작
   */
  start(): void {
    this.validateTransition('running');
    this.status = 'running';
    this.startedAt = new Date();
    this.error = null;
    this.completedAt = null;
    logger.debug('Session started');
  }

  /**
   * 세션 완료
   */
  complete(): void {
    this.validateTransition('completed');
    this.status = 'completed';
    if (!this.completedAt) {
      this.completedAt = new Date();
    }
    logger.debug('Session completed');
  }

  /**
   * 세션 실패
   */
  fail(error: string): void {
    this.validateTransition('failed');
    this.status = 'failed';
    this.error = error;
    logger.debug('Session failed', { error });
  }

  /**
   * 세션 취소
   */
  cancel(): void {
    if (this.status !== 'running' && this.status !== 'awaiting_input') {
      logger.debug('Cannot cancel session in current state', { status: this.status });
      return;
    }
    this.status = 'cancelled';
    this.error = 'Cancelled by user';
    this.completedAt = new Date();
    logger.debug('Session cancelled');
  }

  /**
   * 대기 상태로 전환
   */
  setAwaiting(): void {
    this.validateTransition('awaiting_input');
    this.status = 'awaiting_input';
    logger.debug('Session awaiting input');
  }

  /**
   * 대기 상태에서 재개
   */
  resume(): void {
    if (this.status !== 'awaiting_input' && this.status !== 'failed') {
      throw new Error(`Cannot resume from ${this.status} state`);
    }
    this.status = 'running';
    this.error = null;
    this.completedAt = null;
    logger.debug('Session resumed');
  }

  /**
   * Followup 모드 진입
   */
  enterFollowup(): void {
    this.validateTransition('followup');
    this.status = 'followup';
    logger.debug('Session entered followup mode');
  }

  /**
   * 현재 상태 조회
   */
  getState(): SessionLifecycleState {
    return {
      status: this.status,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      error: this.error,
    };
  }

  /**
   * 현재 상태 반환
   */
  getStatus(): SessionStatus {
    return this.status;
  }

  /**
   * 상태 직접 설정 (복원용)
   */
  setStatus(status: SessionStatus): void {
    this.status = status;
  }

  /**
   * 에러 직접 설정
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
   * 대상 상태로 전이 가능 여부 확인
   */
  canTransitionTo(target: SessionStatus): boolean {
    return VALID_TRANSITIONS[this.status]?.includes(target) ?? false;
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
   * 상태 전이 검증
   */
  private validateTransition(target: SessionStatus): void {
    if (!this.canTransitionTo(target)) {
      throw new Error(`Invalid state transition: ${this.status} -> ${target}`);
    }
  }
}
