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

## Core Data Flow

```
User Request
     │
     ▼
┌─────────┐    ┌────────────┐    ┌──────────────┐    ┌─────────────┐
│   CLI   │───▶│Execution   │───▶│BaristaEngine │───▶│  Provider   │
│         │    │  Facade    │    │    V2        │    │ (PTY Proc)  │
└─────────┘    └────────────┘    └──────────────┘    └─────────────┘
                     │                   │                   │
                     ▼                   ▼                   ▼
              ┌────────────┐    ┌──────────────┐    ┌─────────────┐
              │   Order    │    │TerminalPool  │    │  AI Output  │
              │  Manager   │    │   Session    │    │             │
              └────────────┘    └──────────────┘    └─────────────┘
```

## Execution Event Flow

```
BaristaEngineV2
      │
      ├──▶ 'order:started'    { orderId, cafeId }
      ├──▶ 'order:output'     { orderId, data }
      ├──▶ 'stage:started'    { orderId, stageId, provider, skills }
      ├──▶ 'stage:completed'  { orderId, stageId, output, duration }
      ├──▶ 'stage:failed'     { orderId, stageId, error }
      ├──▶ 'order:completed'  { orderId, cafeId, output }
      ├──▶ 'order:failed'     { orderId, cafeId, error, canRetry }
      ├──▶ 'order:awaiting-input' { orderId, stageId, questions }
      └──▶ 'order:followup*'  (followup 관련 이벤트들)
```

## Directory Structure

```
codecafe/
├── .claude/            # Claude Code configuration and skills
├── .codex/             # Codex configuration
├── .gemini/            # Gemini configuration
├── .orch/              # Orchestrator runtime data (gitignored)
│   ├── orders/             # Order execution logs
│   ├── runs/               # Workflow run data
│   ├── roles/              # User-defined custom roles
│   └── skills/             # Skill definitions (JSON)
├── packages/
│   ├── core/           # Domain models, types, schemas, errors
│   │   ├── types/          # Type exports (terminal, role, cafe, step)
│   │   ├── schema/         # Zod schemas (cafe, role, terminal, workflow, provider)
│   │   ├── errors/         # Error classes (base-error, error-codes, specific-errors)
│   │   ├── logging/        # Logger utilities
│   │   ├── utils/          # Utilities (event-emitter, type-guards)
│   │   └── constants/      # Constants (timeouts)
│   ├── cli/            # codecafe CLI commands
│   │   └── commands/       # Command implementations (init, doctor, run, status, ui, orch)
│   ├── desktop/        # Electron UI (Manager)
│   │   ├── src/main/       # Electron main process
│   │   │   ├── ipc/        # IPC handlers (cafe, order, workflow, terminal, provider, ...)
│   │   │   │   ├── handlers/   # Modular handlers (workflow.handler, order.handler)
│   │   │   │   └── utils/      # IPC utilities (output-interval-manager)
│   │   │   ├── services/   # Service layer (workflow-service, order-service)
│   │   │   └── config/     # Configuration (terminal-pool.config)
│   │   ├── src/preload/    # Preload scripts (CommonJS)
│   │   ├── src/renderer/   # React UI
│   │   │   ├── store/      # Zustand stores
│   │   │   ├── hooks/      # React hooks
│   │   │   ├── components/ # UI components (terminal, views)
│   │   │   ├── utils/      # Utilities (terminal-log parser/summarizer)
│   │   │   ├── types/      # Type definitions
│   │   │   └── i18n/       # Internationalization
│   │   └── src/common/     # Shared types (ipc-types, output-markers)
│   ├── orchestrator/   # Integrated orchestrator engine
│   │   ├── src/
│   │   │   ├── facades/    # Public API (ExecutionFacade)
│   │   │   ├── barista/    # BaristaEngineV2, BaristaManager
│   │   │   ├── session/    # Multi-terminal session
│   │   │   │   ├── events/     # Session events
│   │   │   │   ├── execution/  # Execution planning
│   │   │   │   ├── lifecycle/  # Session lifecycle
│   │   │   │   └── resources/  # Resource management
│   │   │   ├── terminal/   # Terminal pool
│   │   │   │   ├── adapters/   # Provider adapters
│   │   │   │   └── interfaces/ # Interface definitions
│   │   │   ├── engine/     # FSM, DAG executor
│   │   │   ├── provider/   # Provider executors
│   │   │   ├── workflow/   # Workflow execution
│   │   │   ├── role/       # Role management
│   │   │   ├── storage/    # State persistence
│   │   │   ├── cli/commands/   # CLI command implementations
│   │   │   ├── ui/         # Electron IPC adapter
│   │   │   ├── schema/     # Schema validation
│   │   │   └── constants/  # Constants (thresholds)
│   │   └── test/           # Vitest tests
│   ├── providers/
│   │   ├── common/         # Shared provider interfaces (IProvider, IProviderStatic)
│   │   ├── claude-code/    # Claude Code Provider (PTY)
│   │   └── codex/          # Codex Provider
│   ├── roles/          # Built-in role definitions (Handlebars templates)
│   ├── git-worktree/   # Git worktree management (WorktreeManager)
│   └── schema/         # YAML/JSON schema and validation (향후 확장)
├── agents/             # Agent definitions (PM, design-spec, docs, impl, etc.)
├── recipes/
│   └── house-blend/    # Default recipe templates
└── docs/
    ├── module-specs/       # Module specifications (README.md)
    ├── architecture/       # Architecture diagrams and docs
    ├── claude-cli-terminal/ # Terminal execution documentation
    ├── old/                # Archived documentation
    ├── desktop-architecture.md
    ├── refactoring-workflow.md
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

## Package Architecture

> 상세 모듈 스펙은 `docs/module-specs/README.md` 참조

### Package Dependency Graph

```
                    ┌─────────────────────────────────────────────────┐
                    │                   cli                           │
                    │  (codecafe CLI 진입점)                          │
                    └─────────────────┬───────────────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
          ▼                           ▼                           ▼
┌─────────────────┐       ┌───────────────────┐       ┌─────────────────┐
│    desktop      │       │   orchestrator    │       │  git-worktree   │
│  (Electron UI)  │──────▶│   (핵심 엔진)      │◀──────│  (Worktree 관리) │
└────────┬────────┘       └─────────┬─────────┘       └────────┬────────┘
         │                          │                          │
         └──────────────────────────┼──────────────────────────┘
                                    │
                                    ▼
                          ┌─────────────────┐
                          │      core       │
                          │  (도메인 모델)   │
                          └────────┬────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
         ▼                         ▼                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ provider-       │     │   providers-    │     │ provider-       │
│ claude-code     │────▶│   common        │◀────│ codex           │
└─────────────────┘     │  (IProvider)    │     └─────────────────┘
                        └─────────────────┘
```

### Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  UI Layer                                                               │
│  ├── cli/         : Commander 기반 CLI                                  │
│  └── desktop/     : Electron + React GUI                                │
├─────────────────────────────────────────────────────────────────────────┤
│  Application Layer                                                      │
│  └── orchestrator/                                                      │
│      ├── facades/         : Public API (ExecutionFacade)                │
│      ├── session/         : Multi-terminal Session (Phase 3)            │
│      │   ├── events/      : Session Events                              │
│      │   ├── execution/   : Execution Planning                          │
│      │   ├── lifecycle/   : Session Lifecycle                           │
│      │   └── resources/   : Resource Management                         │
│      ├── terminal/        : Terminal Pool (Phase 2)                     │
│      │   ├── adapters/    : Provider Adapters                           │
│      │   └── interfaces/  : Interface Definitions                       │
│      ├── barista/         : BaristaEngineV2 실행 엔진                    │
│      ├── engine/          : FSM, DAG Executor                           │
│      ├── provider/        : Provider Executors                          │
│      ├── workflow/        : Workflow Execution                          │
│      ├── role/            : Role Management                             │
│      ├── storage/         : State Persistence                           │
│      ├── cli/commands/    : CLI 명령어 구현 (UI Layer 연동)               │
│      └── ui/              : Electron IPC 어댑터 (UI Layer 연동)           │
├─────────────────────────────────────────────────────────────────────────┤
│  Domain Layer                                                           │
│  ├── core/                                                              │
│  │   ├── Barista, Order, Receipt    : 도메인 엔티티                      │
│  │   ├── BaristaManager, OrderManager : 매니저 클래스                    │
│  │   ├── Storage, LogManager        : 저장소 및 로깅                     │
│  │   ├── schema/                    : Zod 스키마 검증                    │
│  │   ├── errors/                    : 에러 클래스 정의                   │
│  │   └── utils/                     : 유틸리티                          │
│  └── schema/              : 중앙화된 스키마 검증 (향후 확장 예정)          │
├─────────────────────────────────────────────────────────────────────────┤
│  Infrastructure Layer                                                   │
│  ├── providers/                                                         │
│  │   ├── common/         : Provider 공통 인터페이스                      │
│  │   ├── claude-code/    : Claude Code CLI Provider                     │
│  │   └── codex/          : Codex CLI Provider                           │
│  └── git-worktree/       : Git Worktree 유틸리티                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Packages

> 각 패키지의 상세 스펙은 `packages/<name>/CLAUDE.md` 참조

### @codecafe/core
- **Role**: 도메인 모델, 타입, 스키마, 에러
- **Key exports**: `Barista`, `Order`, `BaristaManager`, `OrderManager`, `Storage`, `LogManager`
- **Key files**:
  - `types.ts`: 도메인 타입 (`Barista`, `Order`, `Receipt`, 상태 Enum)
  - `barista.ts`: `BaristaManager` 클래스
  - `order.ts`: `OrderManager` 클래스
  - `storage.ts`: `Storage` 저장소
  - `log-manager.ts`: `LogManager` 로깅
  - `types/*.ts`: Terminal, Role, Cafe, Step 타입
  - `schema/*.ts`: Zod 스키마 (`CafeSchema`, `RoleSchema`, `WorkflowSchema`, etc.)
  - `errors/`: 에러 클래스 (`BaseError`, `ErrorCode`)
  - `utils/`: `TypedEventEmitter`, `TypeGuards`, `EventListenerManager`
- **Dependencies**: `yaml`, `zod`

### @codecafe/cli
- **Role**: `codecafe` CLI 진입점
- **Main commands**:
  - `init`: 프로젝트 초기화
  - `doctor`: 환경 검증
  - `run`: 워크플로우 실행
  - `status`: 실행 상태 조회
  - `ui`: Desktop UI 실행
  - `orch`: 내부 오케스트레이션 명령
- **Dependencies**: `commander`, `chalk`, `ora`, `inquirer`

### @codecafe/desktop
- **Role**: Electron 기반 데스크톱 GUI
- **Main Process**:
  - `index.ts`: app lifecycle, `initExecutionFacade()`, `setupIpcHandlers()`
  - `execution-manager.ts`: `BaristaEngineV2` 연동
  - `ipc/*.ts`: IPC 핸들러 (cafe, order, workflow, terminal, provider, worktree, skill, dialog, system, execution-facade)
  - `ipc/handlers/`: 모듈화된 핸들러 (`workflow.handler.ts`, `order.handler.ts`)
  - `services/`: 서비스 레이어 (`workflow-service.ts`, `order-service.ts`)
- **Renderer Process**:
  - Zustand stores: `useCafeStore`, `useOrderStore`, `useBaristaStore`, `useTerminalStore`, `useSettingsStore`, `useViewStore`
  - Hooks: `useBaristas`, `useOrders`, `useCafeHandlers`, `useOrderHandlers`, etc.
  - Utils: `terminal-log/` (parser, summarizer, tool-extractor, formatter)
- **Tech stack**: Electron 28, React 18, TailwindCSS 3, Zustand 4, Radix UI, i18next

### @codecafe/orchestrator
- **Role**: 다중 터미널 오케스트레이션, 워크플로우 실행 엔진
- **Key modules**:
  - `facades/`: `ExecutionFacade` (Public API)
  - `barista/`: `BaristaEngineV2`, `BaristaManager`
  - `session/`: `CafeSessionManager`, `OrderSession`, `TerminalGroup`, `SharedContext`, `StageOrchestrator`
  - `terminal/`: `TerminalPool`, `TerminalLease`, `PoolSemaphore`, Provider Adapters
  - `engine/`: `FSMEngine`, `DAGExecutor`
  - `provider/`: `ProviderAdapter`, `ProviderExecutor`, `AssistedExecutor`, `HeadlessExecutor`
  - `workflow/`: `WorkflowExecutor`, `RunRegistry`
  - `role/`: `RoleManager`, `TemplateEngine`
  - `cli/commands/`: CLI 명령어 구현 (`init`, `run`, `resume`, `status`, `logs`, `profile`, `assign`, `role`)
  - `storage/`: `RunStateManager`, `EventLogger`
  - `ui/`: `registerElectronHandlers`, UI 타입
- **Dependencies**: commander, handlebars, node-pty, chalk, ora
- **Testing**: vitest with v8 coverage

### @codecafe/providers
- **common**: Provider 공통 인터페이스 (`IProvider`, `IProviderStatic`, `ProviderConfig`, `SchemaExecutionConfig`)
- **claude-code**: `ClaudeCodeProvider` (PTY 기반)
  - Interactive: `claude "<prompt>"`
  - Headless: `claude -p @file --output-format json`
- **codex**: `CodexProvider`
  - Interactive: `codex "<prompt>"`
  - Headless: `codex exec --json --output-schema <schema> -i <file>`

### @codecafe/schema
- **Role**: YAML/JSON 스키마 검증 (향후 확장 예정)
- **Current state**: 스키마 검증은 현재 `@codecafe/core/schema/`에서 수행

### @codecafe/git-worktree
- **Role**: Git Worktree 관리 유틸리티
- **Key exports**: `WorktreeManager` (static methods)
- **Methods**: `createWorktree`, `removeWorktree`, `mergeToTarget`, `listWorktrees`, `getWorktreeInfo`, `exportPatch`
- **Security**: `execFile` 사용 (command injection 방지)

### packages/roles/
- **Role**: Built-in role definitions with Handlebars templates
- **Format**: Markdown with YAML frontmatter
- **Template syntax**: Handlebars (variables, conditionals, loops)
- **Role files**:
  - `planner.md`: Implementation planning
  - `coder.md`: Code implementation
  - `tester.md`: Testing and coverage
  - `reviewer.md`: Code review
  - `generic-agent.md`: Generic template
- **Loading priority**: `.orch/roles/` (user) > `packages/roles/` (built-in) > `node_modules/@codecafe/roles/`

### agents/
- **Role**: Agent configuration for orchestrator workflows
- **Agent files**:
  - `pm-agent.md`: Project management orchestration
  - `design-spec-extractor.md`: Design spec extraction from assets
  - `documentation-agent.md`: Documentation generation
  - `implementation-agent.md`: Code implementation
  - `context-builder.md`: Context building
  - `requirements-analyzer.md`: Requirements analysis
  - `verification-agent.md`: Verification tasks

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
- `order:delete` - Delete single order
- `order:deleteMany` - Bulk delete orders
- `order:execute` - Execute order
- `order:sendInput` - Send input to order terminal
- `order:createWithWorktree` - Create order with git worktree
- `order:subscribeOutput` / `order:unsubscribeOutput` - Output stream subscription
- `order:retryFromStage` / `order:retryFromBeginning` / `order:getRetryOptions` - Retry support
- Event subscriptions:
  - `order:event` / `order:assigned` / `order:completed` / `order:failed` / `order:output`
  - Session: `order:session-started` / `order:session-completed` / `order:session-failed`
  - Stage: `order:stage-started` / `order:stage-completed` / `order:stage-failed`
  - `order:awaiting-input` - Awaiting user input event

### Receipt
- `receipt:getAll` - Get all execution receipts

### Workflow
- `workflow:list` - List available workflows
- `workflow:get` - Get workflow definition
- `workflow:create` - Create new workflow
- `workflow:update` - Update workflow
- `workflow:delete` - Delete workflow
- `workflow:run` - Execute workflow

### Run (Workflow Run Management)
- `run:list` - List workflow runs
- `run:status` - Get run status
- `run:resume` - Resume run
- `run:logs` - Get run logs

### Config
- `config:assignments:get` / `config:assignments:set` - Assignment configuration
- `config:profiles:list` / `config:profiles:set` - Profile management

### Terminal
- `terminal:init` - Initialize terminal
- `terminal:poolStatus` - Get terminal pool status
- `terminal:poolMetrics` - Get terminal pool metrics
- `terminal:subscribe` / `terminal:unsubscribe` - Terminal output subscription
- `terminal:shutdown` - Shutdown terminal
- `terminal:data:{id}` - Terminal data stream (per terminal)

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
- **Roles**:
  - Built-in: `packages/roles/` (Markdown with YAML frontmatter)
  - User-defined: `.orch/roles/` (gitignored, higher priority)
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
- `docs/module-specs/README.md`: **모듈 아키텍처 개요** (Package Dependency Graph, Layer Architecture)
- `packages/*/CLAUDE.md`: **패키지별 상세 스펙** (Flow, File Map, API, Review Checklist)
- `docs/IMPLEMENTATION_SUMMARY.md`: Implementation summary
- `docs/desktop-architecture.md`: Electron desktop UI architecture
- `docs/terminal-execution-flow.md`: Terminal PTY execution flow
- `docs/refactoring-workflow.md`: Package refactoring workflow guide
- `docs/architecture/`: Architecture diagrams and documentation
- `docs/claude-cli-terminal/`: Terminal execution detailed docs
- `docs/old/`: Archived documentation
  - `PRD.md`: Product requirements document
  - `오케스트레이터-PRD.md`: Orchestrator PRD (Korean)
- `packages/roles/README.md`: Role system documentation and template syntax
- `agents/`: Agent definitions for orchestrator workflows

## Review Checklist (Global)

패키지 변경 시 확인:
- [ ] 해당 패키지 `CLAUDE.md`의 Flow 유지
- [ ] 의존 패키지 인터페이스 호환성
- [ ] Export 변경 시 상위 패키지 영향 확인
- [ ] `docs/module-specs/README.md` 다이어그램과 일치 여부

## Phase Evolution

| Phase | 모듈 | 설명 |
|-------|------|------|
| Phase 1 | `barista/`, `workflow/` | 기본 실행 |
| Phase 2 | `terminal/`, `role/` | Terminal Pool, Role 기반 실행 |
| Phase 3 | `session/` | Multi-terminal Session |

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

### M2 (In Progress - Mostly Complete)
- [x] Workflow engine (FSM-based)
- [x] Git worktree parallel execution
- [x] Workflow UI (execution/monitoring)
- [x] Skill system (built-in + user-defined)
- [x] Role system (built-in roles with Handlebars templates)
- [x] Order management enhancements (retry, session/stage events)
- [x] Terminal pool management
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
