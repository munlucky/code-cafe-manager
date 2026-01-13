/**
 * Orchestrator Type Definitions
 */

// Stage types
export type StageType = 'plan' | 'code' | 'test' | 'check'

// Node types
export type NodeType = 'run' | 'foreach' | 'reduce' | 'branch' | 'export'

// Provider types
export type ProviderType = 'claude-code' | 'codex' | 'gemini' | 'grok'

// Execution mode
export type ExecutionMode = 'assisted' | 'headless' | 'auto'

/**
 * Workflow definition
 */
export interface Workflow {
  name: string
  stages: StageType[]
  loop: {
    max_iters: number
    fallback_next_stage: StageType
    stop_when: string
  }
}

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
  status: 'running' | 'paused' | 'completed' | 'failed'
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
  data?: any
  error?: string
}
