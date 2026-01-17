# Workflow Execution System - Requirements Document

## 1. Overview

### 1.1 Purpose
Define requirements for a flexible workflow execution system that enables users to create, manage, and execute complex multi-stage workflows with configurable providers, roles (agents), and skills.

### 1.2 Scope
- Workflow CRUD operations (Create, Read, Update, Delete)
- Stage-based execution with configurable providers
- Shared context management across stages
- Parallel and sequential execution modes
- Stage failure handling strategies
- YAML-based workflow definitions

### 1.3 Existing System Context
The system builds upon the existing `code-cafe-manager` infrastructure:
- **Orchestrator**: `packages/orchestrator/` - DAG executor, barista engine, role manager
- **Desktop App**: `packages/desktop/` - Electron-based UI with IPC communication
- **Storage**: YAML files in `workflows/` directory
- **Existing Types**: `WorkflowInfo`, `StageAssignment`, `RunProgress` in window.d.ts

---

## 2. Functional Requirements

### 2.1 Workflow Management (FR-001 to FR-004)

#### FR-001: List Workflows
**Description**: User can view all available workflows.

**Acceptance Criteria**:
- Displays workflow list in grid/card view
- Shows workflow ID, name, description, and stages
- Supports filtering and sorting
- Handles empty state gracefully

#### FR-002: Create Workflow
**Description**: User can create a new workflow definition.

**Acceptance Criteria**:
- Workflow ID must be unique and URL-safe (alphanumeric, hyphens, underscores only)
- Name is required (human-readable)
- Description is optional
- At least one stage must be defined
- Workflow is persisted as YAML file in `workflows/{id}.workflow.yml`

#### FR-003: Update Workflow
**Description**: User can modify an existing workflow.

**Acceptance Criteria**:
- Workflow ID cannot be changed (immutable)
- All other fields are editable
- Updates are persisted immediately to YAML file
- Validation ensures YAML schema compliance

#### FR-004: Delete Workflow
**Description**: User can delete a workflow.

**Acceptance Criteria**:
- Confirmation dialog required before deletion
- YAML file is removed from filesystem
- In-memory references are cleaned up
- Cannot delete workflows currently in use by active runs

### 2.2 Stage Management (FR-005 to FR-009)

#### FR-005: Define Stages
**Description**: Workflow consists of N stages with configurable properties.

**Acceptance Criteria**:
- Each stage has a unique identifier (e.g., "plan", "code", "test", "check")
- Stages are executed in defined order
- Each stage can have:
  - Provider: `claude-code` | `codex` | `gemini` | `grok`
  - Role: Reference to agent role (e.g., "planner", "coder")
  - Profile: Stage execution graph (e.g., "simple", "committee")
  - Skills: Optional list of skill identifiers
  - Prompts: Optional prompt templates

#### FR-006: Parallel Stage Execution
**Description**: Stages can execute providers in parallel within a stage.

**Acceptance Criteria**:
- Stage can define multiple providers
- Providers execute concurrently when configured
- Results are collected and aggregated
- Errors from any provider fail the stage

#### FR-007: Sequential Stage Execution
**Description**: Stages can execute providers sequentially.

**Acceptance Criteria**:
- Stage can define sequential execution mode
- Each provider waits for previous to complete
- Output from previous provider is available to next
- Failure stops the sequence immediately

#### FR-008: Shared Context
**Description**: All stages share a common execution context.

**Acceptance Criteria**:
- Context initialized at workflow start
- Each stage can read and write to context
- Context persists across stage boundaries
- Context includes:
  - Variables passed at workflow start
  - Outputs from each stage
  - Metadata (timestamps, iteration counts)

#### FR-009: Stage Failure Handling
**Description**: User can configure behavior when a stage fails.

**Acceptance Criteria**:
- Failure strategies per stage:
  - `stop`: Halt workflow execution immediately (default)
  - `continue`: Proceed to next stage despite failure
  - `retry`: Retry the stage up to N times with exponential backoff
- Failure is logged with details
- Final workflow status reflects failures

### 2.3 Workflow Execution (FR-010 to FR-014)

#### FR-010: Start Workflow Execution
**Description**: User can initiate a workflow run.

**Acceptance Criteria**:
- Requires workflow ID and optional input variables
- Creates unique run ID
- Initializes execution context
- Returns run ID for tracking

#### FR-011: Track Execution Progress
**Description**: User can monitor workflow execution in real-time.

**Acceptance Criteria**:
- Shows current stage and status
- Displays per-node progress within stages
- Provides real-time log streaming
- Shows elapsed time and estimated completion

#### FR-012: Pause/Resume Execution
**Description**: User can pause and resume running workflows.

**Acceptance Criteria**:
- Pause stops after current node completes
- State is persisted for resumption
- Resume continues from last completed node
- Context is preserved across pause/resume

#### FR-013: Cancel Execution
**Description**: User can cancel a running workflow.

**Acceptance Criteria**:
- Gracefully stops current execution
- Terminates any active provider processes
- Records cancellation in logs
- Context up to cancellation is preserved

#### FR-014: View Execution History
**Description**: User can review past workflow executions.

**Acceptance Criteria**:
- List all completed/failed/cancelled runs
- Filter by workflow, status, date range
- View detailed logs for each run
- Download execution report

---

## 3. Data Models

### 3.1 Workflow YAML Schema

```yaml
# File: workflows/{workflow-id}.workflow.yml

workflow:
  # Required: Unique workflow identifier (derived from filename)
  id: string              # e.g., "my-workflow"

  # Required: Human-readable name
  name: string            # e.g., "My Custom Workflow"

  # Optional: Workflow description
  description?: string    # e.g., "A workflow for..."

  # Required: List of stages in execution order
  stages: string[]        # e.g., ["plan", "code", "test", "check"]

  # Required: Loop configuration for iteration control
  loop:
    max_iters: number     # Maximum iterations (1-20)
    fallback_next_stage: string  # Stage to return to on failure
    stop_when: string     # JSONPath condition (e.g., "$.done")

# Stage-specific configuration (one section per stage)
{stage-name}:
  # Provider to use for this stage
  provider: "claude-code" | "codex" | "gemini" | "grok"

  # Role (agent) to use
  role: string            # e.g., "planner", "coder"

  # Stage profile (graph definition)
  profile: string         # e.g., "simple", "committee"

  # Execution mode for multiple providers
  mode?: "sequential" | "parallel"  # default: "sequential"

  # Failure handling strategy
  on_failure?: "stop" | "continue" | "retry"  # default: "stop"

  # Retry configuration (when on_failure is "retry")
  retries?: number        # Max retry attempts (default: 3)
  retry_backoff?: number  # Seconds between retries (default: 5)

  # Skills to invoke (optional)
  skills?: string[]       # e.g., ["feature-dev", "code-review"]

  # Custom prompt template (optional, overrides role template)
  prompt?: string         # Custom prompt template
```

### 3.2 Example: Complete Workflow File

```yaml
# File: workflows/feature-development.workflow.yml

workflow:
  name: Feature Development
  description: End-to-end feature development workflow
  stages:
    - plan
    - code
    - test
    - check
  loop:
    max_iters: 5
    fallback_next_stage: plan
    stop_when: "$.done == true"

plan:
  provider: claude-code
  role: planner
  profile: simple
  skills:
    - moonshot-classify-task
    - moonshot-detect-uncertainty
  on_failure: stop

code:
  provider: claude-code
  role: coder
  profile: simple
  mode: sequential
  on_failure: retry
  retries: 2

test:
  provider: claude-code
  role: tester
  profile: simple
  on_failure: continue

check:
  provider: claude-code
  role: checker
  profile: gate
  on_failure: stop
```

### 3.3 TypeScript Types

```typescript
// Core workflow types
export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  stages: string[];
  loop: LoopConfig;
  stageConfigs: Record<string, StageConfig>;
}

export interface LoopConfig {
  max_iters: number;
  fallback_next_stage: string;
  stop_when: string;
}

export interface StageConfig {
  provider: ProviderType;
  role: string;
  profile: string;
  mode?: 'sequential' | 'parallel';
  on_failure?: FailureStrategy;
  retries?: number;
  retry_backoff?: number;
  skills?: string[];
  prompt?: string;
}

export type ProviderType = 'claude-code' | 'codex' | 'gemini' | 'grok';
export type FailureStrategy = 'stop' | 'continue' | 'retry';

// Execution types
export interface WorkflowRun {
  runId: string;
  workflowId: string;
  status: RunStatus;
  currentStage: string;
  iteration: number;
  context: ExecutionContext;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export type RunStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface ExecutionContext {
  vars: Record<string, any>;
  stageOutputs: Record<string, any>;
  metadata: {
    startedAt: string;
    currentIteration: number;
    completedStages: string[];
  };
}

export interface StageResult {
  stage: string;
  status: 'completed' | 'failed' | 'skipped';
  outputs: Record<string, any>;
  error?: string;
  duration: number;
}
```

### 3.4 Stage Profile YAML Schema

Stage profiles define the execution graph for each stage type:

```yaml
# File: workflows/stages/{stage}.{profile}.yml

graph:
  # Node 1: Run provider with role
  - id: planner
    type: run
    provider: ${stage.provider}  # Variable interpolation
    role: ${stage.role}
    inputs: [${vars.input_file}]

  # Node 2: Export with schema validation
  - id: plan_out
    type: export
    from: planner
    output_schema: schemas/plan.schema.json
```

---

## 4. API Requirements

### 4.1 IPC Handler Extensions

Extend existing `window.codecafe.workflow` namespace:

```typescript
interface WorkflowAPI {
  // Existing (already implemented)
  list: () => Promise<IpcResponse<WorkflowInfo[]>>;
  get: (id: string) => Promise<IpcResponse<WorkflowInfo>>;
  create: (data: WorkflowInfo) => Promise<IpcResponse<WorkflowInfo>>;
  update: (data: WorkflowInfo) => Promise<IpcResponse<WorkflowInfo>>;
  delete: (id: string) => Promise<IpcResponse<void>>;
  run: (id: string, options?: RunOptions) => Promise<IpcResponse<string>>;

  // New: Execution management
  getRuns: (workflowId?: string) => Promise<IpcResponse<WorkflowRun[]>>;
  getRunStatus: (runId: string) => Promise<IpcResponse<WorkflowRun>>;
  cancelRun: (runId: string) => Promise<IpcResponse<void>>;
  pauseRun: (runId: string) => Promise<IpcResponse<void>>;
  resumeRun: (runId: string) => Promise<IpcResponse<void>>;

  // New: Stage management
  getStageProfiles: (stage: string) => Promise<IpcResponse<string[]>>;
  validateWorkflow: (data: WorkflowDefinition) => Promise<IpcResponse<ValidationResult>>;

  // New: Export/Import
  exportWorkflow: (id: string) => Promise<IpcResponse<string>>;  // Returns YAML content
  importWorkflow: (yaml: string) => Promise<IpcResponse<WorkflowInfo>>;
}

interface RunOptions {
  vars?: Record<string, any>;
  interactive?: boolean;
  onFailure?: FailureStrategy;
}

interface ValidationResult {
  valid: boolean;
  errors?: Array<{ path: string; message: string }>;
}
```

### 4.2 New IPC Handlers

```typescript
// packages/desktop/src/main/ipc/workflow-run.ts

export function registerWorkflowRunHandlers(orchestrator: Orchestrator): void {
  // List all runs (optionally filtered by workflow)
  ipcMain.handle('workflow:runs:list', async (_, workflowId?: string) => {...});

  // Get run status
  ipcMain.handle('workflow:runs:get', async (_, runId: string) => {...});

  // Cancel a run
  ipcMain.handle('workflow:runs:cancel', async (_, runId: string) => {...});

  // Pause a run
  ipcMain.handle('workflow:runs:pause', async (_, runId: string) => {...});

  // Resume a run
  ipcMain.handle('workflow:runs:resume', async (_, runId: string) => {...});

  // Get run logs
  ipcMain.handle('workflow:runs:logs', async (_, runId: string) => {...});

  // Subscribe to run events
  ipcMain.on('workflow:runs:subscribe', (event, runId: string) => {...});
  ipcMain.on('workflow:runs:unsubscribe', (event, runId: string) => {...});
}
```

### 4.3 Orchestrator Integration

Extend orchestrator to support new workflow execution model:

```typescript
// packages/orchestrator/src/workflow/workflow-executor.ts

export class WorkflowExecutor {
  constructor(
    private roleManager: RoleManager,
    private terminalPool: TerminalPool,
    private dagExecutor: DAGExecutor
  ) {}

  async execute(workflow: WorkflowDefinition, options: RunOptions): Promise<string>;

  async getRunStatus(runId: string): Promise<WorkflowRun>;

  async cancelRun(runId: string): Promise<void>;

  async pauseRun(runId: string): Promise<void>;

  async resumeRun(runId: string): Promise<void>;

  private async executeStage(
    stage: string,
    config: StageConfig,
    context: ExecutionContext
  ): Promise<StageResult>;

  private async executeStageSequential(
    config: StageConfig,
    context: ExecutionContext
  ): Promise<StageResult>;

  private async executeStageParallel(
    config: StageConfig,
    context: ExecutionContext
  ): Promise<StageResult>;
}
```

---

## 5. UI Requirements

### 5.1 Workflow List View

**Location**: `/workflows`

**Components**:
- Header with "New Workflow" button
- Grid/list view toggle
- Search and filter controls
- Workflow cards showing:
  - Name and description
  - Stage badges
  - Last run status
  - Action menu (Edit, Delete, Run, Duplicate)

### 5.2 Workflow Editor Dialog

**Trigger**: New Workflow / Edit Workflow

**Form Fields**:
1. **Workflow ID** (text input, required for new, readonly for edit)
2. **Name** (text input, required)
3. **Description** (textarea, optional)
4. **Stages** (dynamic list with add/remove)
   - Stage name (dropdown: plan, code, test, check, or custom)
   - Reorder controls
5. **Loop Configuration**
   - Max iterations (number input, 1-20)
   - Fallback stage (dropdown)
   - Stop condition (text input, JSONPath expression)
6. **Stage Configuration** (expandable per stage)
   - Provider (dropdown)
   - Role (dropdown, from available roles)
   - Profile (dropdown, from available profiles)
   - Execution mode (radio: sequential/parallel)
   - On failure (dropdown: stop/continue/retry)
   - Retry count (number, shown when retry selected)
   - Skills (multi-select, optional)
   - Custom prompt (textarea, optional)

**Actions**:
- Cancel
- Save & Close
- Save & Run

### 5.3 Workflow Run Dialog

**Trigger**: "Run" action on workflow card

**Form Fields**:
1. **Workflow Info** (readonly display)
2. **Input Variables** (dynamic key-value pairs)
   - Add variable button
   - Key (text)
   - Value (text/textarea based on type)
3. **Execution Options**
   - Interactive mode (checkbox)
   - Override failure strategy (optional)

**Actions**:
- Cancel
- Start Run

### 5.4 Run Monitor View

**Location**: `/runs/{runId}` or modal overlay

**Display**:
- Run status badge (pending/running/paused/completed/failed/cancelled)
- Progress bar showing stage completion
- Current stage indicator
- Stage timeline (horizontal or vertical)
  - Each stage shows: icon, name, status, duration
  - Click to view stage details
- Control buttons:
  - Pause (when running)
  - Resume (when paused)
  - Cancel (when running/paused)
- Live log panel
  - Auto-scroll toggle
  - Filter by severity
  - Copy/download buttons

### 5.5 Run History View

**Location**: `/runs` or tab within workflow detail

**Display**:
- Table or list of past runs
- Columns: Run ID, Workflow, Status, Started At, Duration, Actions
- Filter controls:
  - Workflow dropdown
  - Status checkboxes
  - Date range picker
- Actions per run:
  - View details
  - View logs
  - Rerun
  - Delete

### 5.6 Component Structure

```
src/renderer/components/workflow/
├── WorkflowList.tsx              # Main workflow list view
├── WorkflowCard.tsx              # Single workflow card
├── WorkflowEditorDialog.tsx      # Create/edit dialog (extend existing)
├── WorkflowRunDialog.tsx         # Run configuration dialog
├── RunMonitor.tsx                # Real-time execution monitor
├── RunHistory.tsx                # Past runs list
├── StageConfigEditor.tsx         # Stage configuration form
├── StageTimeline.tsx             # Visual stage progress
└── LogPanel.tsx                  # Live log viewer
```

---

## 6. Non-Functional Requirements

### 6.1 Performance
- **NFR-001**: Workflow list must load within 500ms for up to 100 workflows
- **NFR-002**: UI updates for run progress must reflect within 1 second of actual state change
- **NFR-003**: Log streaming must handle at least 100 lines/second without UI lag

### 6.2 Reliability
- **NFR-004**: Workflow state must be persisted after each stage completion
- **NFR-005**: System must recover from crashes and resume paused workflows
- **NFR-006**: Concurrent workflow executions must not interfere with each other

### 6.3 Usability
- **NFR-007**: All user actions must provide clear feedback (loading states, success/error messages)
- **NFR-008**: Form validation must provide specific, actionable error messages
- **NFR-009**: Keyboard shortcuts must be available for common actions (Ctrl+N for new, etc.)

### 6.4 Security
- **NFR-010**: Workflow YAML files must be validated before parsing to prevent injection attacks
- **NFR-011**: User-provided variables must be sanitized before interpolation into prompts
- **NFR-012**: File access must be restricted to designated directories

### 6.5 Compatibility
- **NFR-013**: Must maintain backward compatibility with existing workflow YAML format
- **NFR-014**: Must work with existing role system (`.orch/roles/`)
- **NFR-015**: Must support existing providers (claude-code, codex, gemini, grok)

---

## 7. Implementation Phases

### Phase 1: Core Workflow CRUD (Priority: High)
- Extend workflow YAML schema with new fields
- Update workflow IPC handlers
- Extend WorkflowEditorDialog with new fields
- Add workflow validation

### Phase 2: Execution Engine (Priority: High)
- Implement WorkflowExecutor class
- Integrate with existing DAGExecutor
- Add run state persistence
- Implement pause/resume/cancel

### Phase 3: UI Enhancements (Priority: Medium)
- Build RunMonitor component
- Build RunHistory component
- Add real-time log streaming
- Add stage timeline visualization

### Phase 4: Advanced Features (Priority: Low)
- Parallel execution mode
- Custom skill integration
- Workflow export/import
- Workflow templates

---

## 8. Dependencies

### Internal
- `@codecafe/orchestrator` - DAG executor, role manager, terminal pool
- `@codecafe/core` - Shared types and interfaces
- `packages/desktop` - Electron main process and IPC

### External
- `electron` - IPC communication
- `js-yaml` - YAML parsing and serialization
- `ajv` - JSON schema validation
- `gray-matter` - Frontmatter parsing for roles

---

## 9. Open Questions

1. **Q1**: Should workflows support custom stage types beyond the predefined (plan, code, test, check)?
   - **A1**: Yes, allow custom stage names but require profile definition

2. **Q2**: How should workflow variables be passed to stage profiles?
   - **A2**: Variable interpolation using `${vars.varName}` syntax

3. **Q3**: Should there be workflow-level permissions?
   - **A3**: Out of scope for v1, consider for future

4. **Q4**: How to handle workflow versioning?
   - **A4**: Use Git for workflow YAML files; future versions may add in-app versioning

---

## 10. Appendix

### 10.1 File Structure

```
packages/
├── desktop/
│   ├── src/
│   │   ├── main/ipc/
│   │   │   ├── workflow.ts           # Existing: CRUD handlers
│   │   │   └── workflow-run.ts       # New: Execution handlers
│   │   └── renderer/components/
│   │       └── workflow/
│   │           ├── WorkflowList.tsx
│   │           ├── WorkflowEditorDialog.tsx  # Extend existing
│   │           ├── WorkflowRunDialog.tsx     # New
│   │           ├── RunMonitor.tsx            # New
│   │           └── RunHistory.tsx            # New
│   └── workflows/                        # YAML files
│       ├── moon.workflow.yml            # Existing example
│       └── ...
└── orchestrator/
    ├── src/
    │   ├── workflow/                    # New package
    │   │   ├── workflow-executor.ts
    │   │   ├── run-state.ts
    │   │   └── types.ts
    │   └── schema/
    │       ├── workflow.schema.json     # Update needed
    │       └── stage-profile.schema.json
    └── templates/
        └── workflows/
            └── stages/                  # Stage profile templates
```

### 10.2 Validation Rules

| Field | Rules |
|-------|-------|
| workflow.id | Required, alphanumeric + hyphens/underscores, unique |
| workflow.name | Required, 3-100 characters |
| workflow.stages | Required, at least 1 stage |
| loop.max_iters | Required, 1-20 |
| stage.provider | Required, valid ProviderType |
| stage.role | Required, existing role |
| stage.profile | Required, existing profile |
| stage.retries | Optional, 0-10 |

---

**Document Version**: 1.0
**Last Updated**: 2025-01-16
**Status**: Draft - Ready for review
