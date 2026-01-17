/**
 * Session Module - Multi-terminal orchestration
 *
 * 구조:
 * - CafeSessionManager: Cafe별 Order 세션들을 관리
 * - OrderSession: Order 실행 라이프사이클 관리
 * - TerminalGroup: Order당 N개의 터미널 관리
 * - SharedContext: 터미널 간 결과 동기화
 */

export { SharedContext, type StageResult, type ContextSnapshot } from './shared-context';
export { TerminalGroup, type ProviderType, type TerminalInfo, type TerminalGroupConfig } from './terminal-group';
export { OrderSession, type StageConfig, type WorkflowConfig, type SessionStatus } from './order-session';
export { CafeSessionManager, type CafeSessionInfo, type SessionManagerConfig } from './cafe-session-manager';
