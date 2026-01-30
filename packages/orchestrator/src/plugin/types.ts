/**
 * Claude Code Plugin Types
 *
 * Moonbot 통합을 위한 claude_code 도구 타입 정의
 */

/**
 * claude_code 도구 액션 타입
 */
export type ClaudeCodeAction = 'start' | 'write' | 'stop';

/**
 * 세션 상태
 */
export type PluginSessionStatus =
  | 'created'
  | 'running'
  | 'awaiting_input'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * 실행 모드
 */
export type ExecutionMode = 'local' | 'node';

/**
 * start 액션 파라미터
 */
export interface StartActionParams {
  /** Claude CLI를 실행할 경로 (필수) */
  workingDirectory: string;
  /** 초기 프롬프트 문자열 (선택) */
  prompt?: string;
  /** 추가 환경 변수 객체 (선택) */
  env?: Record<string, string>;
  /** 실행 시간 제한(초), 기본값 1800 */
  timeout?: number;
  /** 로컬 노드 화면을 스냅샷으로 전송할지 여부, 기본 false */
  useScreenCapture?: boolean;
}

/**
 * write 액션 파라미터
 */
export interface WriteActionParams {
  /** 실행 중인 세션 ID (필수) */
  sessionId: string;
  /** 터미널에 전달할 명령 문자열 (필수) */
  input: string;
  /** start와 동일한 모드 사용 (선택) */
  useScreenCapture?: boolean;
}

/**
 * stop 액션 파라미터
 */
export interface StopActionParams {
  /** 종료할 세션 ID (필수) */
  sessionId: string;
  /** 세션 생성 시 설정한 모드 (선택) */
  useScreenCapture?: boolean;
}

/**
 * claude_code 도구 입력 파라미터 (유니온)
 */
export type ClaudeCodeParams =
  | ({ action: 'start' } & StartActionParams)
  | ({ action: 'write' } & WriteActionParams)
  | ({ action: 'stop' } & StopActionParams);

/**
 * 세션 생성 결과
 */
export interface SessionCreateResult {
  success: boolean;
  sessionId?: string;
  error?: string;
  /** 노드 기반 실행 시 초기 스크린샷 */
  screenCaptureData?: ScreenCaptureData;
}

/**
 * 입력 전송 결과
 */
export interface WriteResult {
  success: boolean;
  error?: string;
  /** 텍스트 로그 (useScreenCapture=false) */
  output?: string;
  /** 스크린샷 데이터 (useScreenCapture=true) */
  screenCaptureData?: ScreenCaptureData;
}

/**
 * 세션 종료 결과
 */
export interface StopResult {
  success: boolean;
  status: 'success' | 'error';
  error?: string;
  /** 마지막 로그 또는 스냅샷 정보 */
  lastOutput?: string;
  screenCaptureData?: ScreenCaptureData;
}

/**
 * 스크린샷 데이터
 */
export interface ScreenCaptureData {
  /** Base64 인코딩된 이미지 데이터 */
  imageData: string;
  /** 이미지 포맷 (png, jpeg) */
  format: 'png' | 'jpeg';
  /** 캡처 타임스탬프 */
  timestamp: number;
  /** 캡처 영역 (전체 화면 또는 특정 창) */
  region?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * 플러그인 세션 정보
 */
export interface PluginSession {
  /** 세션 ID */
  sessionId: string;
  /** 사용자 ID (Discord 등) */
  userId: string;
  /** 채널 ID (Discord 채널/쓰레드) */
  channelId?: string;
  /** 작업 디렉토리 */
  workingDirectory: string;
  /** 실행 모드 */
  executionMode: ExecutionMode;
  /** 세션 상태 */
  status: PluginSessionStatus;
  /** 생성 시간 */
  createdAt: Date;
  /** 마지막 활동 시간 */
  lastActivityAt: Date;
  /** 타임아웃 (초) */
  timeout: number;
  /** 환경 변수 */
  env?: Record<string, string>;
  /** 노드 ID (useScreenCapture=true 시) */
  nodeId?: string;
  /** 프로세스 세션 ID (내부용) */
  internalSessionId?: string;
}

/**
 * 노드 상태 정보
 */
export interface NodeStatus {
  /** 노드 ID */
  nodeId: string;
  /** 연결 상태 */
  connected: boolean;
  /** 노드 이름 */
  name?: string;
  /** 플랫폼 (win32, darwin, linux) */
  platform?: string;
  /** 마지막 활동 시간 */
  lastSeen?: Date;
}

/**
 * 폴링 결과
 */
export interface PollResult {
  /** 새 출력이 있는지 여부 */
  hasNewOutput: boolean;
  /** 출력 데이터 */
  output?: string;
  /** 세션 상태 */
  status: PluginSessionStatus;
  /** 마지막 폴링 시간 */
  timestamp: number;
}

/**
 * 플러그인 이벤트 타입
 */
export type PluginEventType =
  | 'session:created'
  | 'session:output'
  | 'session:completed'
  | 'session:failed'
  | 'session:cancelled'
  | 'screen:captured';

/**
 * 플러그인 이벤트 데이터
 */
export interface PluginEvent {
  type: PluginEventType;
  sessionId: string;
  timestamp: number;
  data?: unknown;
}

/**
 * 플러그인 설정
 */
export interface PluginConfig {
  /** 기본 타임아웃 (초) */
  defaultTimeout?: number;
  /** 최대 동시 세션 수 */
  maxConcurrentSessions?: number;
  /** 폴링 간격 (ms) */
  pollInterval?: number;
  /** 스크린샷 포맷 */
  screenshotFormat?: 'png' | 'jpeg';
  /** 스크린샷 품질 (jpeg only, 0-100) */
  screenshotQuality?: number;
}

/**
 * 노드 실행 옵션
 */
export interface NodeExecutionOptions {
  /** 노드 ID */
  nodeId: string;
  /** 실행할 명령 */
  command: string;
  /** 작업 디렉토리 */
  workingDirectory: string;
  /** 환경 변수 */
  env?: Record<string, string>;
  /** 스크린샷 자동 캡처 여부 */
  captureScreen?: boolean;
}

/**
 * 노드 실행 결과
 */
export interface NodeExecutionResult {
  success: boolean;
  /** 프로세스 ID */
  pid?: number;
  /** 에러 메시지 */
  error?: string;
  /** 초기 스크린샷 */
  screenCaptureData?: ScreenCaptureData;
}

/**
 * claude_code 도구 스키마 (JSON Schema)
 */
export const claudeCodeToolSchema = {
  name: 'claude_code',
  description:
    'Claude Code CLI를 실행하고 관리합니다. 세션을 시작(start), 입력 전송(write), 종료(stop)할 수 있습니다.',
  input_schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['start', 'write', 'stop'],
        description: '실행할 액션',
      },
      workingDirectory: {
        type: 'string',
        description: 'Claude CLI를 실행할 경로 (start 액션에서 필수)',
      },
      prompt: {
        type: 'string',
        description: '초기 프롬프트 문자열 (start 액션에서 선택)',
      },
      env: {
        type: 'object',
        additionalProperties: { type: 'string' },
        description: '추가 환경 변수 객체 (start 액션에서 선택)',
      },
      timeout: {
        type: 'number',
        description: '실행 시간 제한(초), 기본값 1800 (start 액션에서 선택)',
      },
      useScreenCapture: {
        type: 'boolean',
        description: '로컬 노드 화면을 스냅샷으로 전송할지 여부, 기본 false',
      },
      sessionId: {
        type: 'string',
        description: '세션 ID (write, stop 액션에서 필수)',
      },
      input: {
        type: 'string',
        description: '터미널에 전달할 명령 (write 액션에서 필수)',
      },
    },
    required: ['action'],
  },
} as const;
