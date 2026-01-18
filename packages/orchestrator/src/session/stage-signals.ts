/**
 * Stage Signals - Stage 실행 결과에서 추출되는 시그널 정의
 *
 * 각 Stage는 실행 완료 후 signals 블록을 출력하여
 * 오케스트레이터가 다음 행동을 결정할 수 있게 함
 */

/**
 * Stage 실행 후 다음 행동을 결정하는 액션 타입
 */
export type NextAction =
  | 'proceed'      // 다음 stage로 진행
  | 'await_user'   // 사용자 입력 대기
  | 'skip_next'    // 다음 stage(s) 스킵
  | 'retry';       // 현재 stage 재시도

/**
 * 작업 복잡도 레벨
 */
export type ComplexityLevel = 'simple' | 'medium' | 'complex';

/**
 * Stage 실행 결과에서 추출되는 시그널
 */
export interface StageSignals {
  /** 다음 행동 결정 */
  nextAction: NextAction;

  /** 사용자 입력이 필요한지 여부 */
  needsUserInput: boolean;

  /** 불확실한 사항 목록 (사용자에게 질문할 내용) */
  uncertainties?: string[];

  /** 작업 복잡도 */
  complexity?: ComplexityLevel;

  /** 스킵할 stage ID 목록 (nextAction이 'skip_next'일 때) */
  skipStages?: string[];

  /** 재시도 이유 (nextAction이 'retry'일 때) */
  retryReason?: string;

  /** 최대 재시도 횟수 */
  maxRetries?: number;

  /** 추가 메타데이터 */
  metadata?: Record<string, unknown>;
}

/**
 * 오케스트레이터의 판단 결과
 */
export interface OrchestratorDecision {
  /** 결정된 액션 */
  action: NextAction;

  /** 액션 이유 */
  reason: string;

  /** 스킵할 stage 목록 */
  skipStages?: string[];

  /** 사용자에게 표시할 메시지 */
  userMessage?: string;

  /** 사용자에게 할 질문 목록 */
  questions?: string[];

  /** AI 판단 사용 여부 */
  usedAI?: boolean;
}

/**
 * 기본 시그널 값
 */
export const DEFAULT_SIGNALS: StageSignals = {
  nextAction: 'proceed',
  needsUserInput: false,
  uncertainties: [],
  complexity: 'medium',
};

/**
 * 시그널 검증
 */
export function isValidSignals(obj: unknown): obj is StageSignals {
  if (!obj || typeof obj !== 'object') return false;

  const signals = obj as Record<string, unknown>;

  // nextAction 필수
  if (!signals.nextAction) return false;
  if (!['proceed', 'await_user', 'skip_next', 'retry'].includes(signals.nextAction as string)) {
    return false;
  }

  // needsUserInput은 boolean이어야 함
  if (typeof signals.needsUserInput !== 'boolean' && signals.needsUserInput !== undefined) {
    return false;
  }

  return true;
}
