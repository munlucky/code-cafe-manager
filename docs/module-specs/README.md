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
| `core` | 도메인 모델, 타입, 스키마, 에러 | `Barista`, `Order`, `BaristaManager`, `OrderManager`, `Storage`, `LogManager` |
| `orchestrator` | 실행 오케스트레이션 | `ExecutionFacade`, `BaristaEngineV2`, `TerminalPool`, `CafeSessionManager` |
| `cli` | 명령줄 인터페이스 | `codecafe` CLI commands |
| `desktop` | Electron GUI | IPC Handlers, React UI |
| `git-worktree` | Git Worktree 관리 | `WorktreeManager` |
| `schema` | YAML/JSON 스키마 검증 (예약) | (향후 확장 예정) |
| `providers-common` | Provider 인터페이스 | `IProvider`, `IProviderStatic` |
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
