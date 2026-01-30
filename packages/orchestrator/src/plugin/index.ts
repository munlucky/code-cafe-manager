/**
 * Claude Code Plugin Module
 *
 * Moonbot 통합을 위한 claude_code 도구 플러그인을 제공합니다.
 *
 * 주요 컴포넌트:
 * - ClaudeCodePlugin: 메인 플러그인 클래스 (start/write/stop 액션)
 * - PluginSessionManager: 세션 관리
 * - NodeExecutionManager: 노드 기반 실행
 * - ScreenCaptureService: 화면 캡처 서비스
 */

// Main plugin
export { ClaudeCodePlugin, ClaudeCodePluginOptions } from './claude-code-plugin';

// Session management
export {
  PluginSessionManager,
  CreateSessionOptions,
} from './plugin-session-manager';

// Node execution
export { NodeExecutionManager } from './node-execution-manager';

// Screen capture
export {
  ScreenCaptureService,
  NodeRpcClient,
  CaptureOptions,
} from './screen-capture-service';

// Types
export {
  // Action types
  ClaudeCodeAction,
  ClaudeCodeParams,
  StartActionParams,
  WriteActionParams,
  StopActionParams,
  // Result types
  SessionCreateResult,
  WriteResult,
  StopResult,
  PollResult,
  // Session types
  PluginSession,
  PluginSessionStatus,
  ExecutionMode,
  // Screen capture types
  ScreenCaptureData,
  // Node types
  NodeStatus,
  NodeExecutionOptions,
  NodeExecutionResult,
  // Event types
  PluginEvent,
  PluginEventType,
  // Config types
  PluginConfig,
  // Tool schema
  claudeCodeToolSchema,
} from './types';
