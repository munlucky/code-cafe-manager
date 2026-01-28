# @codecafe/orchestrator

> 다중 터미널 오케스트레이션, 워크플로우 실행 엔진

## Flow

```
[CLI/Desktop 호출]
        │
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│  facades/execution-facade.ts:41-229                                   │
│  ExecutionFacade (Public API)                                         │
│  - executeOrder(), cancelOrder(), sendInput()                         │
│  - retryFromStage(), enterFollowup(), executeFollowup()               │
└───────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│  barista/barista-engine-v2.ts                                         │
│  BaristaEngineV2 (실행 엔진 코어)                                       │
│  - Order 실행 라이프사이클 관리                                         │
│  - Session/Terminal 할당                                              │
│  - 이벤트 발행 (order:*, stage:*)                                      │
└───────────────────────────────────────────────────────────────────────┘
        │
        ├─────────────────────────────────────┐
        │                                     │
        ▼                                     ▼
┌─────────────────────────┐      ┌─────────────────────────────────────┐
│  session/               │      │  terminal/                          │
│                         │      │                                     │
│  cafe-session-manager   │      │  terminal-pool.ts:50-200            │
│  :40-150                │      │  TerminalPool                       │
│  - Cafe별 세션 관리      │      │  - Provider별 터미널 풀              │
│                         │      │  - Lease 기반 할당/반환              │
│  order-session.ts       │      │                                     │
│  :30-180                │      │  pool-semaphore.ts                  │
│  - Order 실행 세션      │      │  - 동시성 제어                        │
│                         │      │                                     │
│  terminal-group.ts      │      │  provider-adapter.ts                │
│  :20-120                │      │  - Provider 추상화                   │
│  - 다중 터미널 그룹      │      │                                     │
│                         │      │  adapters/claude-code-adapter.ts    │
│  shared-context.ts      │      │  adapters/codex-adapter.ts          │
│  :15-100                │      │  - 구체 어댑터 구현                   │
│  - 터미널 간 컨텍스트    │      │                                     │
└─────────────────────────┘      └─────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│  engine/                                                              │
│                                                                       │
│  fsm.ts           : FSMEngine (상태 머신)                              │
│  dag-executor.ts  : DAGExecutor (DAG 실행)                            │
└───────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│  provider/                                                            │
│                                                                       │
│  executor.ts      : ProviderExecutor (통합 실행자)                     │
│  assisted.ts      : AssistedExecutor (대화형 실행)                     │
│  headless.ts      : HeadlessExecutor (비대화형 실행)                   │
└───────────────────────────────────────────────────────────────────────┘
```

## File Map

| 경로 | 역할 | 핵심 Export |
|------|------|-------------|
| `src/index.ts` | 패키지 진입점 | 모든 public API (90+ exports) |
| **facades/** | | |
| `execution-facade.ts` | 외부 공개 API | `ExecutionFacade` |
| **barista/** | | |
| `barista-engine-v2.ts` | 실행 엔진 코어 | `BaristaEngineV2` |
| **session/** | | |
| `index.ts` | 세션 모듈 진입점 | 세션 관련 전체 export |
| `cafe-session-manager.ts` | Cafe별 세션 관리 | `CafeSessionManager` |
| `order-session.ts` | Order 실행 세션 | `OrderSession` |
| `terminal-group.ts` | 다중 터미널 그룹 | `TerminalGroup` |
| `shared-context.ts` | 터미널 간 컨텍스트 | `SharedContext` |
| `stage-orchestrator.ts` | Stage 실행 | `StageOrchestrator` |
| `stage-signals.ts` | 재시도/스킵 신호 | `StageSignals` |
| **terminal/** | | |
| `index.ts` | 터미널 모듈 진입점 | 터미널 관련 전체 export |
| `terminal-pool.ts` | 터미널 풀 관리 | `TerminalPool`, `TerminalLease` |
| `pool-semaphore.ts` | 동시성 제어 | `PoolSemaphore`, `LeaseRequest` |
| `provider-adapter.ts` | Provider 추상화 | `ProviderAdapterFactory`, `IProviderAdapter` |
| `adapters/*.ts` | 구체 어댑터 | `ClaudeCodeAdapter`, `CodexAdapter` |
| `errors.ts` | 에러 정의 | 11개 에러 클래스 |
| **engine/** | | |
| `fsm.ts` | 상태 머신 | `FSMEngine` |
| `dag-executor.ts` | DAG 실행 | `DAGExecutor` |
| **provider/** | | |
| `executor.ts` | 통합 실행자 | `ProviderExecutor` |
| `assisted.ts` | 대화형 실행 | `AssistedExecutor` |
| `headless.ts` | 비대화형 실행 | `HeadlessExecutor` |
| **workflow/** | | |
| `workflow-executor.ts` | 워크플로우 실행 | `WorkflowExecutor` |
| `run-registry.ts` | 실행 레지스트리 | `RunRegistry` |
| **role/** | | |
| `role-manager.ts` | Role 관리 | `RoleManager` |
| `template.ts` | Handlebars 템플릿 | `TemplateEngine` |
| **cli/commands/** (UI Layer 연동) | | |
| `init.ts`, `run.ts`, etc. | CLI 명령어 구현 | `initOrchestrator`, `runWorkflow`, etc. |
| **storage/** | | |
| `run-state.ts` | 실행 상태 저장 | `RunStateManager` |
| `event-logger.ts` | 이벤트 로깅 | `EventLogger` |
| **ui/** (UI Layer 연동) | | |
| `electron-api.ts` | Electron IPC 어댑터 | `registerElectronHandlers` |

## Event Flow

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

## Dependencies

- **상위**: `cli`, `desktop`
- **하위**: `@codecafe/core`, `@codecafe/providers-common`
- **외부**: `commander`, `inquirer`, `chalk`, `handlebars`, `node-pty`

## Phase Architecture

| Phase | 모듈 | 설명 |
|-------|------|------|
| Phase 1 | `barista/`, `workflow/` | 기본 실행 |
| Phase 2 | `terminal/`, `role/` | Terminal Pool, Role 기반 실행 |
| Phase 3 | `session/` | Multi-terminal Session |

## Review Checklist

이 패키지 변경 시 확인:
- [ ] `ExecutionFacade` API 변경 시 → desktop 호환성
- [ ] 이벤트 페이로드 변경 시 → desktop IPC 핸들러 확인
- [ ] Terminal Pool 로직 변경 시 → 리소스 누수 확인
- [ ] Session 상태 변경 시 → 라이프사이클 일관성
- [ ] 새 Provider 추가 시 → adapter 구현 필요

## Critical Paths

1. **Order 실행**: `ExecutionFacade.executeOrder()` → `BaristaEngineV2` → `TerminalPool.lease()` → `Provider.run()`
2. **Followup**: `enterFollowup()` → `executeFollowup()` → `finishFollowup()`
3. **Retry**: `retryFromStage()` / `retryFromBeginning()`
