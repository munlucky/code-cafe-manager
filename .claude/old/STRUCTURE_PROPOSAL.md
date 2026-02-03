# Structure Improvement Proposal

## 1. Analysis of Current Structure
The current structure is well-organized as a monorepo (`pnpm workspace`).
- `packages/core`: Core logic/types?
- `packages/orchestrator`: Main engine.
- `packages/cli`: CLI interface.
- `packages/desktop`: Electron UI.

## 2. Issues & Improvements

### (1) Clarify `@codecafe/core` vs `@codecafe/orchestrator`
**Issue**: It's unclear what belongs in `core` versus `orchestrator`.
**Proposal**:
- **Strict Layering (Recommended)**: Keep `core` as a "Shared Contracts" library.
    - `core`: Shared Interfaces, Types (WorkflowDefinition, RunState, NodeResult), and pure utility functions.
    - `orchestrator`: Current implementation of the Engine, State Machine, File I/O, etc.
- **Merge Option**: If `core` is too thin, merge it into `orchestrator`.

### (2) Merge `packages/schema` into `packages/core`
**Issue**: Having a separate `schema` package for JSON Schemas might be overkill if they are tightly coupled with the Types in `core`.
**Proposal**: Move `packages/schema` into `packages/core/src/schema`. This ensures that TypeScript types and their runtime JSON Schema validations are versioned and maintained together.

### (3) Standardize Provider Interface
**Issue**: `packages/providers` seems to hold adapters loosely.
**Proposal**:
- Create a clear `Provider` interface in `packages/core`.
- Ensure each provider implements:
    - `generatePrompt(role, input)`
    - `parseOutput(rawOutput)`
    - `getCommand(mode: 'assisted'|'headless')`

### (4) Atomic UI Components
**Issue**: Desktop UI logic might get bloated.
**Proposal**: Consider a `packages/ui` (or `design-system`) package if you plan to share UI components between the Electron App and potentially a Web View or future Web App.
> **Note**: Refer to `docs/UI_IMPROVEMENT_PLAN.md` for detailed UI plans.

## 3. Proposed Directory Structure

```
packages/
├── core/                  # [Types & Contracts]
│   ├── src/
│   │   ├── types/         # Workflow, Run, Node types
│   │   ├── schema/        # Zod or JSON Schemas (Merged from packages/schema)
│   │   └── interfaces/    # Provider Interface
├── orchestrator/          # [Main Engine]
│   ├── src/
│   │   ├── engine/        # DAG Execution Logic
│   │   ├── agent/         # [NEW] Barista (Logical Agent) State & Logic
│   │   ├── session/       # [NEW] Terminal (Provider Process) Session Pool
│   │   ├── state/         # State Persistence (.orch management)
│   │   └── runner/        # (Legacy) -> Replacing with session
├── providers/             # [Adapters]
│   ├── claude-code/
│   ├── codex/
│   └── common/            # Shared provider logic
├── cli/                   # [Interface: CLI]
│   └── src/commands/      # run, init, doctor
├── desktop/               # [Interface: GUI]
│   ├── src/
│   │   ├── main/          # Electron Main Process
│   │   └── renderer/      # React UI
├── roles/                 # [Role Registry (Defaults)]
│   ├── planner.md
│   ├── coder.md
│   └── reviewer.md
└── git-worktree/          # [Utility]
```

## 4. Additional Considerations (Roles & Context)
-   **Context StoreImpl**: Logic to treat `.codecafe/context/` within a Worktree as a file-based DB should be included in `orchestrator`.
-   **Role Management**: Basic agent templates (Plan/Code/Test/Review) should be included in `packages/roles` (or `core/roles`), with a structure allowing user overrides.
