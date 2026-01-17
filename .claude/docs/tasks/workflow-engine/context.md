# Workflow Execution System - Implementation Context

> Project rules: `.claude/PROJECT.md`
> Requirements: `.claude/docs/tasks/workflow-engine/requirements.md`

## Metadata

- Created: 2025-01-16
- Branch: main
- Complexity: complex
- Related doc: `.claude/docs/tasks/workflow-engine/requirements.md`

## Task Overview

- Goal: Build a flexible workflow execution system with stage-based execution, configurable providers, parallel/sequential modes, and real-time progress monitoring
- Scope: Workflow CRUD, stage management, execution engine (run/pause/resume/cancel), UI components
- Impact: Core orchestrator enhancement, desktop UI new features

## Requirements Summary

### Functional Requirements (14)

**Workflow Management (FR-001 to FR-004)**
- List/Create/Update/Delete workflows
- YAML persistence: `workflows/{id}.workflow.yml`
- Validation: unique URL-safe IDs, required fields

**Stage Management (FR-005 to FR-009)**
- Configurable stages (plan, code, test, check, or custom)
- Per-stage: provider, role, profile, skills, prompts
- Execution modes: sequential/parallel
- Failure strategies: stop/continue/retry with exponential backoff
- Shared context across stages

**Workflow Execution (FR-010 to FR-014)**
- Start with input variables
- Real-time progress tracking (stage/node level)
- Pause/Resume (state persisted)
- Cancel (graceful termination)
- Execution history with logs

### Data Model

```typescript
// Workflow Definition (YAML)
interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  stages: string[];
  loop: { max_iters: number; fallback_next_stage: string; stop_when: string };
  stageConfigs: Record<string, StageConfig>;
}

interface StageConfig {
  provider: 'claude-code' | 'codex' | 'gemini' | 'grok';
  role: string;
  profile: string;
  mode?: 'sequential' | 'parallel';
  on_failure?: 'stop' | 'continue' | 'retry';
  retries?: number;
  retry_backoff?: number;
  skills?: string[];
  prompt?: string;
}

// Execution Types
interface WorkflowRun {
  runId: string;
  workflowId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentStage: string;
  iteration: number;
  context: ExecutionContext;
  startedAt: Date;
  completedAt?: Date;
}
```

## Current Architecture Analysis

### Existing Components

**Orchestrator (`packages/orchestrator/`)**
- `cli/commands/run.ts`: Workflow execution with FSMEngine, DAGExecutor
- `engine/dag-executor.ts`: Node graph execution
- `engine/fsm.ts`: Stage transition management
- `storage/run-state.ts`: Run state persistence
- `storage/event-logger.ts`: Event logging
- `types.ts`: Core type definitions (Workflow, RunState, StageConfig)

**Desktop IPC (`packages/desktop/src/main/ipc/`)**
- `workflow.ts`: Workflow CRUD handlers (list/get/create/update/delete)
- `orchestrator.ts`: Orchestrator integration (createBarista, createOrder, etc.)
- Uses `IpcResponse<T>` wrapper format

**Renderer Types (`packages/desktop/src/renderer/types/`)**
- `window.d.ts`: WorkflowInfo, StageAssignment, RunProgress, RunLogEntry
- IPC API: `window.codecafe.workflow.*`, `window.codecafe.run.*`

**UI Components**
- `Workflows.tsx`: Basic workflow list with cards
- `WorkflowEditorDialog.tsx`: Simple form (id, name, description, stages)

### Integration Points

1. **Run State Manager**: Already handles run persistence in `.orch/runs/`
2. **Event Logger**: JSONL logging for node/stage events
3. **FSM Engine**: Stage transition logic (existing)
4. **DAG Executor**: Node graph execution (existing)

## Target Files

### New Files

**Orchestrator (`packages/orchestrator/src/`)**
- `workflow/workflow-executor.ts` - High-level workflow executor with pause/resume
- `workflow/run-registry.ts` - Active run tracking and management
- `workflow/types.ts` - Extended execution types

**Desktop Main (`packages/desktop/src/main/ipc/`)**
- `workflow-run.ts` - Run management IPC handlers

**Desktop Renderer (`packages/desktop/src/renderer/`)**
- `components/workflow/WorkflowRunDialog.tsx` - Run configuration dialog
- `components/workflow/RunMonitor.tsx` - Real-time execution monitor
- `components/workflow/RunHistory.tsx` - Past runs list
- `components/workflow/StageTimeline.tsx` - Visual stage progress
- `components/workflow/LogPanel.tsx` - Live log viewer
- `components/workflow/StageConfigEditor.tsx` - Stage configuration form

### Modified Files

**Orchestrator**
- `cli/commands/run.ts` - Extract reusable execution logic for WorkflowExecutor
- `types.ts` - Add StageConfig fields (mode, on_failure, retries, skills)
- `schema/workflow.schema.json` - Add new stage config properties

**Desktop Main**
- `index.ts` - Register workflow-run IPC handlers

**Desktop Renderer**
- `types/window.d.ts` - Extend workflow/run API interfaces
- `components/views/Workflows.tsx` - Add Run button and run history link
- `components/workflow/WorkflowEditorDialog.tsx` - Add loop config, stage configs

## Implementation Plan

### Phase 1: Core Types & Schema (Priority: High)

1. **Update types** (`packages/orchestrator/src/types.ts`)
   - Add `mode`, `on_failure`, `retries`, `retry_backoff`, `skills`, `prompt` to StageConfig
   - Add ExecutionContext, StageResult types

2. **Update schema** (`packages/orchestrator/src/schema/workflow.schema.json`)
   - Add new stage config properties
   - Add validation rules

3. **Extend renderer types** (`packages/desktop/src/renderer/types/window.d.ts`)
   - Add WorkflowRun, StageResult interfaces
   - Extend workflow API with execution methods

### Phase 2: Execution Engine (Priority: High)

1. **Create WorkflowExecutor** (`packages/orchestrator/src/workflow/workflow-executor.ts`)
   - Extract from `run.ts` for reusable execution logic
   - Implement pause/resume/cancel
   - Add failure strategy handling (stop/continue/retry)
   - Integrate with existing DAGExecutor, FSMEngine

2. **Create RunRegistry** (`packages/orchestrator/src/workflow/run-registry.ts`)
   - Track active runs in memory
   - Map runId to execution context
   - Handle run lifecycle

3. **Create workflow-run IPC** (`packages/desktop/src/main/ipc/workflow-run.ts`)
   - Handlers: list, get, cancel, pause, resume, logs
   - Event subscriptions for real-time updates
   - Bridge to WorkflowExecutor

### Phase 3: UI Components (Priority: Medium)

1. **Extend WorkflowEditorDialog**
   - Add loop configuration form
   - Add per-stage configuration editor (StageConfigEditor)
   - Validation for new fields

2. **Create WorkflowRunDialog**
   - Input variables form
   - Execution options (interactive mode, failure override)

3. **Create RunMonitor**
   - Real-time status display
   - Stage timeline visualization
   - Live log panel with streaming

4. **Create RunHistory**
   - List view with filters
   - Run detail drill-down

5. **Update Workflows view**
   - Add Run button to workflow cards
   - Add navigation to run history

### Phase 4: Advanced Features (Priority: Low)

1. Parallel execution mode (multi-provider stages)
2. Custom skill integration
3. Workflow export/import
4. Workflow templates

## Dependencies

### Internal

- `@codecafe/orchestrator` - DAGExecutor, FSMEngine, RunStateManager, EventLogger
- `@codecafe/core` - Shared types (Cafe, Role, TerminalPoolConfig)
- Workflow YAML files - `.orch/workflows/`

### External

- `js-yaml` - YAML parsing/serialization
- `ajv` - JSON schema validation
- `nanoid` - Unique run ID generation (dynamic import required)
- `electron` - IPC communication

## Risks and Alternatives

| Risk | Impact | Mitigation |
|------|--------|------------|
| Pause/resume state complexity | High | Reuse existing RunStateManager; serialize context after each stage |
| Real-time log streaming performance | Medium | Batch log events; throttle UI updates |
| Parallel execution coordination | Medium | Defer to Phase 4; sequential only initially |
| IPC event subscription complexity | Medium | Use existing event patterns from order IPC |

## Checkpoints

- [ ] Phase 1: Types and schema updated
- [ ] Phase 2: WorkflowExecutor with pause/resume/cancel
- [ ] Phase 2: IPC handlers for run management
- [ ] Phase 3: WorkflowRunDialog and RunMonitor
- [ ] Phase 3: Extended WorkflowEditorDialog
- [ ] Phase 3: RunHistory view
- [ ] Verification: Type check, build, lint

## Open Questions

1. **Q**: Should run events use existing `order:event` pattern or new namespace?
   - **A**: Use new `workflow-run:event` namespace for clarity

2. **Q**: How to handle workflow variable interpolation in prompts?
   - **A**: Use `${vars.varName}` syntax; resolve at execution time

3. **Q**: Should workflow runs share terminal pool with orders?
   - **A**: Yes, use existing TerminalPool from orchestrator

## Verification

```bash
# Type check
pnpm typecheck

# Build
pnpm build

# Run tests
pnpm test

# Desktop dev
cd packages/desktop && pnpm dev
```
