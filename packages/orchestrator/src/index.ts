// Export CLI commands
export { initOrchestrator } from './cli/commands/init';
export * from './cli/commands/role';
export { runWorkflow, resumeWorkflow } from './cli/commands/run';
export { resumeRun } from './cli/commands/resume';
export { showRunStatus } from './cli/commands/status';
export { showRunLogs } from './cli/commands/logs';
export { setProfile, getProfile, listProfiles } from './cli/commands/profile';
export { setAssignment, getAssignment, listRoles } from './cli/commands/assign';

// Export role management
export { RoleManager } from './role/role-manager';
export { TemplateEngine, templateEngine } from './role/template';

// Export terminal management (Phase 2)
export * from './terminal';
export type { TerminalPoolConfig, ProviderTerminalConfig, PoolStatus, PoolMetrics, Terminal, LeaseToken } from '@codecafe/core';

// Export barista engine
export { BaristaEngineV2 } from './barista/barista-engine-v2.js';

// Export facades (Public API for external consumers)
export * from './facades';

// Export session management (Phase 3 - Multi-terminal orchestration)
export * from './session';

// Export schema validation
export * from './schema/validator';

// Export engine
export { FSMEngine } from './engine/fsm';
export { DAGExecutor } from './engine/dag-executor';
export type {
  NodeContext,
  NodeExecutionResult,
  DAGExecutorOptions,
} from './engine/dag-executor';

// Export provider
export { ProviderAdapter } from './provider/adapter';
export { AssistedExecutor } from './provider/assisted';
export type {
  AssistedExecutionOptions,
  AssistedExecutionResult,
  AssistedSchemaExecutionOptions,
} from './provider/assisted';
export { HeadlessExecutor } from './provider/headless';
export type {
  HeadlessExecutionOptions,
  HeadlessExecutionResult,
  HeadlessSchemaExecutionOptions,
} from './provider/headless';
export { ProviderExecutor } from './provider/executor';
export type {
  ExecutionMode,
  ExecutionOptions,
  ExecutionResult,
  SchemaExecutionOptions,
} from './provider/executor';

// Export storage
export { RunStateManager } from './storage/run-state';
export { EventLogger } from './storage/event-logger';

// Export workflow execution
export { WorkflowExecutor } from './workflow/workflow-executor';
export { RunRegistry } from './workflow/run-registry';
export type {
  WorkflowExecutionOptions,
  RunControlOptions,
  StageExecutionOptions,
} from './workflow/workflow-executor';

// Export UI integration
// export { renderInteractiveRunner } from './ui/InteractiveRunner';
export { registerElectronHandlers } from './ui/electron-api';
export type {
  WorkflowInfo,
  RunProgress,
  RunLogEntry,
  ProviderAssignmentInfo,
  ElectronIPCMessages,
  ElectronEventEmitters,
} from './ui/types';

// Export plugin (Claude Code Plugin for Moonbot integration)
export * from './plugin';

// Export types
export * from './types';

