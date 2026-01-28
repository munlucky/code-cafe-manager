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
                       ┌────────────┴────────────┐
                       ▼                         ▼
             ┌─────────────────┐       ┌─────────────────┐
             │      core       │       │     schema      │
             │  (도메인 모델)   │       │  (스키마 검증)   │
             └────────┬────────┘       └─────────────────┘
                      │
    ┌─────────────────┼─────────────────┐
    │                 │                 │
    ▼                 ▼                 ▼
┌─────────┐     ┌───────────┐     ┌─────────┐
│providers│     │ providers │     │providers│
│/claude- │────▶│  /common  │◀────│ /codex  │
│  code   │     │(IProvider)│     │         │
└─────────┘     └───────────┘     └─────────┘
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
│      ├── terminal/        : Terminal Pool (Phase 2)                     │
│      ├── barista/         : BaristaEngineV2 실행 엔진                    │
│      ├── engine/          : FSM, DAG Executor                           │
│      ├── workflow/        : Workflow Execution                          │
│      ├── cli/commands/    : CLI 명령어 구현 (UI Layer 연동)               │
│      └── ui/              : Electron IPC 어댑터 (UI Layer 연동)           │
├─────────────────────────────────────────────────────────────────────────┤
│  Domain Layer                                                           │
│  └── core/                                                              │
│      ├── Barista, Order, Receipt    : 도메인 엔티티                      │
│      └── BaristaManager, OrderManager : 매니저 클래스                    │
├─────────────────────────────────────────────────────────────────────────┤
│  Schema Layer                                                           │
│  └── schema/        : YAML/JSON 파싱 및 Zod 스키마 검증                  │
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

| Package | 역할 | 핵심 Export | Spec |
|---------|------|-------------|------|
| `core` | 도메인 모델, 타입 | `Barista`, `Order`, `BaristaManager`, `OrderManager` | [CLAUDE.md](../../packages/core/CLAUDE.md) |
| `schema` | YAML/JSON 스키마 검증 | `parseYaml`, Zod schemas | [CLAUDE.md](../../packages/schema/CLAUDE.md) |
| `orchestrator` | 실행 오케스트레이션 | `ExecutionFacade`, `BaristaEngineV2`, `TerminalPool` | [CLAUDE.md](../../packages/orchestrator/CLAUDE.md) |
| `cli` | 명령줄 인터페이스 | `codecafe` CLI commands | [CLAUDE.md](../../packages/cli/CLAUDE.md) |
| `desktop` | Electron GUI | IPC Handlers, React UI | [CLAUDE.md](../../packages/desktop/CLAUDE.md) |
| `git-worktree` | Git Worktree 관리 | `WorktreeManager` | [CLAUDE.md](../../packages/git-worktree/CLAUDE.md) |
| `providers/common` | Provider 인터페이스 | `IProvider` | [CLAUDE.md](../../packages/providers/common/CLAUDE.md) |
| `providers/claude-code` | Claude Code CLI | `ClaudeCodeProvider` | [CLAUDE.md](../../packages/providers/claude-code/CLAUDE.md) |
| `providers/codex` | Codex CLI | `CodexProvider` | [CLAUDE.md](../../packages/providers/codex/CLAUDE.md) |

## Phase Evolution

- **Phase 1**: Basic Barista/Order management
- **Phase 2**: Terminal Pool, Role-based execution
- **Phase 3**: Multi-terminal Session orchestration

## Review Checklist (Global)

패키지 변경 시 확인:
- [ ] 해당 패키지 `CLAUDE.md`의 Flow 유지
- [ ] 의존 패키지 인터페이스 호환성
- [ ] Export 변경 시 상위 패키지 영향 확인
