/**
 * Orchestrator Type Definitions
 */

// Stage types
export type StageType = 'analyze' | 'plan' | 'code' | 'review' | 'test' | 'check'

/**
 * Single provider configuration for parallel execution
 */
export interface ProviderConfigItem {
  provider: ProviderType
  role?: string
  weight?: number // For result aggregation (default: 1)
}

/**
 * Stage configuration in workflow
 */
export interface StageConfig {
  /** Single provider (for sequential execution) */
  provider?: ProviderType
  /** Multiple providers (for parallel execution) */
  providers?: ProviderConfigItem[]
  role?: string
  profile?: string
  /** Execution mode: sequential (default) or parallel */
  mode?: 'sequential' | 'parallel'
  /** Parallel execution strategy: 'all' (run all), 'race' (first wins), 'majority' (majority wins) */
  parallel_strategy?: 'all' | 'race' | 'majority'
  /** Failure handling strategy */
  on_failure?: 'stop' | 'continue' | 'retry'
  /** Number of retries when on_failure is 'retry' */
  retries?: number
  /** Backoff multiplier in seconds for retries */
  retry_backoff?: number
  /** Minimum iterations before this stage can be skipped (e.g., review must run at least N times) */
  min_iterations?: number
  /** List of skill names to use */
  skills?: string[]
  /** Custom prompt template for this stage */
  prompt?: string
}

/**
 * Workflow definition
 */
export interface Workflow {
  id: string
  name: string
  description?: string
  stages: StageType[]
  loop: {
    max_iters: number
    fallback_next_stage: StageType
    stop_when: string
  }
  source?: string
  // Stage별 provider 설정 (workflow 내에 정의된 경우)
  stageConfigs?: Record<StageType, StageConfig>
}

// Node types
export type NodeType = 'run' | 'foreach' | 'reduce' | 'branch' | 'export'

// Provider types
export type ProviderType = 'claude-code' | 'codex' | 'gemini' | 'grok'

// Execution mode
export type ExecutionMode = 'assisted' | 'headless' | 'auto'

// Stage execution status
export type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

// Run status for workflow execution
export type RunStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'

/**
 * Stage profile (graph definition)
 */
export interface StageProfile {
  graph: Node[]
}

/**
 * Node definition
 */
export interface Node {
  id: string
  type: NodeType
  provider?: string
  role?: string
  inputs?: string[]
  from?: string
  output_schema?: string
  items?: string
  mode?: 'parallel' | 'sequential'
  concurrency?: number
  run?: Node
  out?: string
  strategy?: string
  when?: Condition[]
}

/**
 * Condition for branch node
 */
export interface Condition {
  condition: string
  then: string
}

/**
 * Role Variable (Phase 2)
 */
export interface RoleVariable {
  name: string
  type: 'string' | 'number' | 'boolean'
  required: boolean
  default?: string | number | boolean
  description?: string
}

/**
 * Role definition (supports both Phase 1 and Phase 2 formats)
 */
export interface Role {
  id: string
  name: string

  // Phase 1 fields
  output_schema?: string
  inputs?: string[]
  guards?: string[]

  // Common field (template in Phase 1, systemPrompt in Phase 2)
  template: string

  // Phase 2 fields
  skills?: string[]
  recommendedProvider?: ProviderType
  variables?: RoleVariable[]
  isDefault?: boolean
  source?: string
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  headless_cmd: string
  assisted_hint: string
  timeout: number
}

/**
 * Assignment configuration
 */
export interface StageAssignment {
  provider: ProviderType
  role: string
  profile: string
}

/**
 * Run state
 */
export interface RunState {
  runId: string
  workflow: string
  currentStage: StageType
  stageIter: number
  completedNodes: string[]
  status: RunStatus
  lastError?: string
  createdAt: string
  updatedAt: string
}

/**
 * Event log entry
 */
export interface EventLog {
  timestamp: string
  type: 'node_start' | 'node_end' | 'validation_fail' | 'retry' | 'fallback' | 'stage_end' | 'error'
  nodeId?: string
  stage?: StageType
  provider?: ProviderType
  data?: any
  error?: string
}

/**
 * Execution context shared across all stages
 */
export interface ExecutionContext {
  /** Input variables provided at workflow start */
  vars: Record<string, any>
  /** Results from previous stages */
  stages: Record<string, any>
  /** Current iteration number */
  iteration: number
  /** Workflow run ID */
  runId: string
}

/**
 * Result from a single provider execution in parallel mode
 */
export interface ProviderResult {
  provider: ProviderType
  role: string
  status: StageStatus
  output?: any
  error?: string
  duration?: number // milliseconds
}

/**
 * Result from a single stage execution
 */
export interface StageResult {
  /** Stage name */
  stage: StageType
  /** Execution status */
  status: StageStatus
  /** Stage output data */
  output?: any
  /** Error message if failed */
  error?: string
  /** Number of retries attempted */
  retries?: number
  /** Stage start timestamp */
  startedAt: string
  /** Stage end timestamp */
  completedAt?: string
  /** Parallel execution results (if mode is parallel) */
  providerResults?: ProviderResult[]
  /** Aggregation method used for parallel results */
  aggregationMethod?: 'first' | 'majority' | 'weighted' | 'all'
}

/**
 * Workflow run details
 */
export interface WorkflowRun {
  /** Unique run identifier */
  runId: string
  /** Workflow ID */
  workflowId: string
  /** Current run status */
  status: RunStatus
  /** Current stage being executed */
  currentStage?: StageType
  /** Current iteration number */
  iteration: number
  /** Shared execution context */
  context: ExecutionContext
  /** Results from completed stages */
  stageResults: Map<StageType, StageResult>
  /** Run start timestamp */
  startedAt: string
  /** Run completion timestamp */
  completedAt?: string
  /** Error message if failed */
  lastError?: string
}
