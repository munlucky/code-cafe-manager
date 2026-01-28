# CodeCafe Architecture Overview

> 모듈별 상세 기능정의서는 각 패키지의 `CLAUDE.md` 참조

## Package Dependency Graph

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

## Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  UI Layer                                                               │
│  ├── cli/         : Commander 기반 CLI                                  │
│  └── desktop/     : Electron + React GUI                                │
│      ├── main/          : Main Process (IPC, Services)                  │
│      └── renderer/      : React UI (zustand, hooks, components)         │
├─────────────────────────────────────────────────────────────────────────┤
│  Application Layer                                                      │
│  └── orchestrator/                                                      │
│      ├── facades/         : Public API (ExecutionFacade)                │
│      ├── session/         : Multi-terminal Session (Phase 3)            │
│      │   ├── events/        : Event propagation                         │
│      │   ├── lifecycle/     : Session lifecycle management              │
│      │   ├── resources/     : Context management                        │
│      │   └── execution/     : Stage coordination                        │
│      ├── terminal/        : Terminal Pool (Phase 2)                     │
│      │   ├── adapters/      : Provider-specific adapters                │
│      │   └── interfaces/    : Adapter interfaces                        │
│      ├── barista/         : BaristaEngineV2, BaristaManager             │
│      ├── engine/          : FSM, DAG Executor                           │
│      ├── workflow/        : Workflow Execution, RunRegistry             │
│      ├── provider/        : Executor (Assisted, Headless)               │
│      ├── storage/         : Run state, Event logging                    │
│      ├── cli/commands/    : CLI 명령어 구현 (UI Layer 연동)               │
│      └── ui/              : Electron IPC 어댑터 (UI Layer 연동)           │
├─────────────────────────────────────────────────────────────────────────┤
│  Domain Layer                                                           │
│  └── core/                                                              │
│      ├── types/                     : 도메인 타입 (Cafe, Terminal, Role) │
│      ├── Barista, Order, Receipt    : 도메인 엔티티                      │
│      ├── BaristaManager, OrderManager : 매니저 클래스                    │
│      ├── schema/                    : Zod 스키마 검증                    │
│      ├── errors/                    : 에러 클래스, ErrorCode             │
│      ├── logging/                   : 로깅 유틸리티                      │
│      └── utils/                     : 유틸리티 (EventEmitter, TypeGuards)│
├─────────────────────────────────────────────────────────────────────────┤
│  Infrastructure Layer                                                   │
│  ├── providers/      : CLI Provider 구현체 (claude-code, codex)         │
│  └── git-worktree/   : Git Worktree 유틸리티                            │
└─────────────────────────────────────────────────────────────────────────┘
```

## Core Data Flow

```
User Request
     │
     ▼
┌─────────┐    ┌────────────┐    ┌──────────────┐    ┌─────────────┐
│   CLI   │───▶│Orchestrator│───▶│BaristaEngine │───▶│  Provider   │
│         │    │            │    │    V2        │    │ (PTY Proc)  │
└─────────┘    └────────────┘    └──────────────┘    └─────────────┘
                     │                   │                   │
                     ▼                   ▼                   ▼
              ┌────────────┐    ┌──────────────┐    ┌─────────────┐
              │   Order    │    │TerminalPool  │    │  AI Output  │
              │  Manager   │    │   Session    │    │             │
              └────────────┘    └──────────────┘    └─────────────┘
```

## Package Summary

| Package | 역할 | 핵심 Export |
|---------|------|-------------|
| `core` | 도메인 모델, 타입, 스키마 | `Barista`, `Order`, `BaristaManager`, `OrderManager`, `createLogger`, `TIMEOUTS` |
| `orchestrator` | 실행 오케스트레이션 | `ExecutionFacade`, `BaristaEngineV2`, `TerminalPool`, `RoleManager`, `WorkflowExecutor` |
| `cli` | 명령줄 인터페이스 | `codecafe` CLI commands (init, doctor, run, status, ui, orch) |
| `desktop` | Electron GUI | IPC Handlers, React UI, zustand stores, execution-manager |
| `git-worktree` | Git Worktree 관리 | `WorktreeManager` |
| `providers-common` | Provider 인터페이스 | `IProvider`, `ProviderConfig`, `ValidationResult` |
| `provider-claude-code` | Claude Code CLI | `ClaudeCodeProvider` |
| `providers-codex` | Codex CLI | `CodexProvider` |

## Phase Evolution

- **Phase 1**: Basic Barista/Order management
- **Phase 2**: Terminal Pool, Role-based execution
- **Phase 3**: Multi-terminal Session orchestration

## Review Checklist (Global)

패키지 변경 시 확인:
- [ ] 해당 패키지 `CLAUDE.md`의 Flow 유지
- [ ] 의존 패키지 인터페이스 호환성
- [ ] Export 변경 시 상위 패키지 영향 확인
