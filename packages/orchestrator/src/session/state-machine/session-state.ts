/**
 * Session State Types & Transitions
 */

/**
 * 세션 상태 타입
 */
export type SessionState =
  | 'created'
  | 'running'
  | 'awaiting_input'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'followup';

/**
 * 유효한 상태 전이 정의
 * - failed → cancelled는 허용하지 않음 (retry만 가능)
 */
export const SESSION_TRANSITIONS: Record<SessionState, SessionState[]> = {
  created: ['running', 'cancelled'],
  running: ['awaiting_input', 'completed', 'failed', 'cancelled'],
  awaiting_input: ['running', 'cancelled'],
  completed: ['followup'],
  failed: ['running'], // retry시 running으로 전이 (cancelled 불허)
  cancelled: [],
  followup: ['completed', 'failed'],
};

/**
 * 상태 전이 검증 함수
 */
export function canTransition(from: SessionState, to: SessionState): boolean {
  return SESSION_TRANSITIONS[from]?.includes(to) ?? false;
}
