# PROJECT.md

## Project Overview

- **Name**: CodeCafe (code-cafe-manager)
- **Version**: 0.1.0
- **Description**: AI CLI Orchestrator - A cross-platform orchestrator that manages multiple AI CLI instances (baristas) in parallel
- **Stack**: TypeScript, Node.js (>=18), pnpm (>=8)
- **Primary Language**: TypeScript (ESM)
- **License**: MIT

## Architecture Concept

CodeCafe manages AI CLI workflows using a "café" metaphor:

- **Manager**: CodeCafe Manager (Electron UI)
- **Barista**: Independent execution unit (1 CLI engine)
- **Menu**: List of workflow templates
- **Recipe**: YAML workflow definition
- **Order**: Single instance of recipe execution
- **Beans**: Provider (claude-code, codex, etc.)
- **Counter**: Target project for execution
- **Receipt**: Execution result summary

## Directory Structure

```
codecafe/
├── .claude/            # Claude Code configuration and skills
├── .codex/             # Codex configuration
├── .gemini/            # Gemini configuration
├── .orch/              # Orchestrator runtime data (gitignored)
│   ├── orders/             # Order execution logs
│   ├── runs/               # Workflow run data
│   └── skills/             # Skill definitions (JSON)
├── packages/
│   ├── core/           # Domain models, recipe engine, types
│   ├── cli/            # codecafe CLI commands
│   ├── desktop/        # Electron UI (Manager)
│   │   ├── src/main/       # Electron main process
│   │   │   └── ipc/        # IPC handlers (cafe, order, workflow, skill, role, etc.)
│   │   ├── src/preload/    # Preload scripts (CommonJS)
│   │   └── src/renderer/   # React UI
│   ├── orchestrator/   # Integrated orchestrator engine
│   │   ├── src/            # Source code
│   │   └── test/           # Vitest tests
│   ├── providers/
│   │   ├── common/         # Shared provider interfaces
│   │   ├── claude-code/    # Claude Code Provider (PTY)
│   │   └── codex/          # Codex Provider
│   ├── git-worktree/   # Git worktree management
│   └── schema/         # YAML/JSON schema and validation
├── agents/             # Agent configuration (optional)
├── recipes/
│   └── house-blend/    # Default recipe templates
└── docs/
    ├── old/            # Archived documentation
    ├── desktop-architecture.md
    ├── terminal-execution-flow.md
    └── IMPLEMENTATION_SUMMARY.md
```

## Core Rules and Conventions

### 1. TypeScript & Module System
- **All packages are ESM modules** (`"type": "module"`)
- **Strict type checking**: Extends `tsconfig.base.json`
  - Target: ES2022, Module: NodeNext, ModuleResolution: NodeNext
  - Composite projects with incremental compilation
  - Declaration files and source maps enabled
- **Workspace dependencies**: Use `workspace:*` protocol
- **Build**: `tsc -b` (composite projects)

### 2. Code Style
- **Prettier**: Follow `.prettierrc`
  - 2 spaces, single quotes, 100 char line width
  - Semicolons, ES5 trailing commas
- **Naming**: camelCase (functions/variables), PascalCase (classes/types), kebab-case (file names)
- **Async**: Prefer async/await, avoid Promise chaining
- **Linting**: eslint in devDependencies (not actively configured project-wide)

### 3. Domain Design
- **core package**: Pure domain logic, minimal external dependencies (yaml, zod)
- **Provider interface**: Adhere to `BaristaProvider` contract for consistency
- **Event-driven**: Barista and Order state changes emit events
- **Validation**: Use Zod schemas for runtime type validation

### 4. Error Handling
- **Explicit error types**: `CafeError`, `ExecutionError`, `ProviderError`, etc.
- **Logging**: Record JSON logs via `LogManager` (JSONL format)
- **State persistence**: Manage JSON files via `Storage` class
- **IPC responses**: All Electron IPC handlers return structured responses

## Key Packages

### @codecafe/core
- **Role**: Domain models, recipe engine, event system
- **Key files**:
  - `barista.ts`: Barista class (execution unit)
  - `recipe.ts`: Recipe class (YAML parsing)
  - `order.ts`: Order class (execution instance)
  - `executor/`: Execution engine
  - `orchestrator.ts`: Integrated orchestrator
  - `storage.ts`: JSON storage
  - `log-manager.ts`: Log management
- **Dependencies**: `yaml`, `zod`

### @codecafe/cli
- **Role**: `codecafe` CLI commands
- **Main commands**:
  - `init`: Initialize environment
  - `run`: Execute recipe
  - `doctor`: Check environment
  - `status`: Query status
  - `ui`: Launch Desktop UI
- **Dependencies**: `commander`, `chalk`, `ora`, `inquirer`

### @codecafe/desktop
- **Role**: Electron-based Manager UI
- **Main views**:
  - Dashboard: Overall status
  - New Order: Create new order
  - Order Detail: Detailed execution status
  - Baristas: Barista list
- **Tech stack**: Electron, React, TailwindCSS, Zustand, Framer Motion, webpack
- **IPC Architecture**: main ↔ renderer communication via contextBridge
  - `preload/index.cts`: Exposes IPC API to renderer (CommonJS)
  - `main/ipc/*.ts`: IPC handlers (cafe, barista, order, workflow, run, config, role, terminal, worktree, provider)
  - Registry: Manages cafe metadata in `~/.codecafe/cafes.json`

### @codecafe/orchestrator
- **Role**: Multi AI CLI orchestrator engine
- **Key features**: Workflow execution, prompt templates, terminal pool, UI (ink), storage
- **Dependencies**: ajv, handlebars, gray-matter, jsonpath-plus, chalk, ora, commander, node-pty
- **Testing**: vitest configured with v8 coverage

### @codecafe/providers
- **common**: Shared provider interfaces and utilities
- **claude-code**: PTY-based Claude Code provider
- **codex**: Codex CLI provider (M2)

### @codecafe/schema
- **Role**: YAML/JSON schema definition and zod validation

### @codecafe/git-worktree
- **Role**: Git worktree parallel execution management

### agents/
- **Role**: Agent role definitions (markdown files)
  - `coder.md`: Implementation agent
  - `planner.md`: Planning agent
  - `reviewer.md`: Review agent
  - `tester.md`: Testing agent
  - `generic-agent.md`: Generic agent template

## Build and Development Commands

```bash
# Full build
pnpm build

# Development mode (watch)
pnpm dev

# Type check
pnpm typecheck

# Lint
pnpm lint

# Test
pnpm test

# Clean
pnpm clean
```

### Package-specific Builds

```bash
# Build core
cd packages/core && pnpm build

# Build and link CLI (local development)
cd packages/cli && pnpm build && pnpm link --global

# Build desktop
cd packages/desktop && pnpm build

# Desktop development server
cd packages/desktop && pnpm dev
```

## Environment Variables

The current project uses minimal environment variables.

- **desktop**: Uses `dotenv` (`packages/desktop/src/main/index.ts`)
- **.env.example**: None (TODO: add if needed)

When environment variables are required, follow these rules:
- Provide `.env.example` template
- Register `.env` in `.gitignore`
- Never commit sensitive information

## IPC API (Desktop)

Electron IPC channels exposed via `window.codecafe`:

### Cafe (Repository Registry)
- `cafe:list` - List all registered cafes
- `cafe:get` - Get cafe by ID
- `cafe:create` - Register new cafe
- `cafe:update` - Update cafe metadata
- `cafe:delete` - Remove cafe
- `cafe:setLastAccessed` / `cafe:getLastAccessed` - Last access tracking

### Barista (Execution Units)
- `barista:create` - Create new barista
- `barista:getAll` - List all baristas
- `barista:event` - Subscribe to barista events

### Order (Workflow Executions)
- `order:create` - Create new order
- `order:getAll` - List all orders
- `order:get` - Get order details
- `order:getLog` - Get order logs
- `order:cancel` - Cancel order
- `order:event` / `order:assigned` / `order:completed` - Event subscriptions

### Workflow
- `workflow:list` - List available workflows
- `workflow:get` - Get workflow definition
- `workflow:run` - Execute workflow

### Run (Workflow Run Management)
- `run:list` - List workflow runs
- `run:status` - Get run status
- `run:resume` - Resume run
- `run:logs` - Get run logs

### Config
- `config:assignments:get` / `config:assignments:set` - Assignment configuration
- `config:profiles:list` / `config:profiles:set` - Profile management
- `config:roles:list` - List roles

### Role
- `role:list` / `role:get` - Role definitions
- `role:listDefault` / `role:listUser` - Filter by type
- `role:reload` - Reload roles

### Terminal
- `terminal:init` - Initialize terminal
- `terminal:poolStatus` - Get terminal pool status

### Worktree
- `worktree:list` - List worktrees
- `worktree:exportPatch` - Export worktree patch
- `worktree:remove` - Remove worktree
- `worktree:openFolder` - Open worktree folder

### Provider
- `provider:getAvailable` - List available providers

### Skill
- `skill:list` - List all skills (built-in + user-created)
- `skill:get` - Get a single skill by ID
- `skill:create` - Create a new skill
- `skill:update` - Update an existing skill
- `skill:delete` - Delete a skill
- `skill:duplicate` - Duplicate a skill

## Data Storage

- **Recipes**: `recipes/` directory (YAML)
  - `house-blend/`: Default recipe templates
- **Skills**: `.orch/skills/` directory (JSON, gitignored)
  - Built-in skills auto-created on first run
  - User-created skills stored as individual `.json` files
- **Execution data**: `.orch/` directory (JSON, gitignored)
  - `storage.json`: Order metadata
  - `orders/{orderId}/`: Individual order logs and state
  - `runs/`: Workflow run data (gitignored)
- **Cafe Registry**: `~/.codecafe/cafes.json` (repository metadata)
- **Logs**: JSON Lines format (`.orch/orders/{orderId}/logs.jsonl`)

## Verification and Testing

- **Type check**: `pnpm typecheck` (entire project)
  - Desktop: `tsc --noEmit && tsc -p tsconfig.renderer.json --noEmit`
- **Test**: `pnpm test` (vitest in orchestrator package)
  - Test location: `src/**/*.test.ts`, `test/**/*.test.ts`
  - Coverage: v8 provider (text, json, html reporters)
  - Setup: `test/setup.ts`
- **Lint**: `pnpm lint` (eslint in devDeps, not actively configured)

## Documentation

- `README.md`: Project overview and usage
- `docs/IMPLEMENTATION_SUMMARY.md`: Implementation summary
- `docs/desktop-architecture.md`: Electron desktop UI architecture
- `docs/terminal-execution-flow.md`: Terminal PTY execution flow
- `docs/old/`: Archived documentation
  - `PRD.md`: Product requirements document
  - `오케스트레이터-PRD.md`: Orchestrator PRD (Korean)
- `agents/`: Agent role definitions (coder, planner, reviewer, tester, generic-agent)

## Milestone Progress

### M1 (✅ Completed)
- CLI core (init, run, doctor, status, ui)
- Provider: claude-code (PTY-based)
- Core package (domain models, recipe engine)
- Schema package (YAML validation)
- Barista Pool implementation
- Orchestrator (integrated management)
- Storage/observation system (JSON + logs)
- Electron UI (Dashboard, New Order, Order Detail, Baristas)

### M2 (In Progress - Partially Complete)
- [x] Workflow engine (FSM-based)
- [x] Git worktree parallel execution
- [x] Workflow UI (execution/monitoring)
- [x] Skill system (built-in + user-defined)
- [ ] Codex Provider integration
- [ ] DAG visualization

### M3 (Planned)
- Provider plugin expansion (Gemini/Grok)
- API mode
- Template registry

## Cautions

- **ESM compatibility**: All import/export uses ESM syntax
  - Exception: `preload/index.cts` uses CommonJS (Electron requirement)
- **nanoid ESM issue**: v5.0.0+ requires dynamic import
- **Path separators**: Use `path.join()` for cross-platform compatibility (Windows/POSIX)
- **PTY limitations**: node-pty build issues possible on Windows (WSL recommended)
- **Git operations**: Cafe registry reads from `.git/config` for repository metadata
- **Workspace protocol**: Use `workspace:*` for inter-package dependencies
- **Type safety**: Zod schemas validate runtime data (IPC params, YAML recipes, etc.)

## TODO

- [ ] Add .env.example template
- [ ] Add integration tests (currently only orchestrator has vitest)
- [ ] Set up CI/CD pipeline
- [ ] Configure ESLint project-wide (currently in devDeps but not configured)
- [ ] Add test coverage to other packages beyond orchestrator
- [ ] Complete M2 features (Codex Provider integration, DAG visualization)

## Built-in Skills

The following built-in skills are auto-created in `.orch/skills/`:

| ID | Name | Category | Command |
|----|------|----------|---------|
| `classify-task` | Task Classification | analysis | `/moonshot-classify-task` |
| `evaluate-complexity` | Complexity Evaluation | analysis | `/moonshot-evaluate-complexity` |
| `detect-uncertainty` | Uncertainty Detection | analysis | `/moonshot-detect-uncertainty` |
| `decide-sequence` | Sequence Decision | planning | `/moonshot-decide-sequence` |
| `pre-flight-check` | Pre-flight Check | planning | `/pre-flight-check` |
| `requirements-analyzer` | Requirements Analyzer | planning | `requirements-analyzer` |
| `context-builder` | Context Builder | planning | `context-builder` |
| `implementation-runner` | Implementation Runner | implementation | `implementation-runner` |
| `codex-review-code` | Codex Code Review | verification | `codex-review-code` |
| `codex-test-integration` | Codex Integration Test | verification | `codex-test-integration` |

Built-in skills cannot be modified or deleted directly; users should duplicate them first.
