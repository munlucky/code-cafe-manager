# CodeCafe 모듈별 기능 및 상호작용 분석

> 각 파일/모듈의 기능과 다른 모듈과의 상호작용을 분석한 문서입니다.

## 목차

1. [Core 모듈 상호작용](#1-core-모듈-상호작용)
2. [Desktop 모듈 상호작용](#2-desktop-모듈-상호작용)
3. [Orchestrator 모듈 상호작용](#3-orchestrator-모듈-상호작용)
4. [전체 데이터 흐름](#4-전체-데이터-흐름)
5. [이벤트 흐름 맵](#5-이벤트-흐름-맵)
6. [IPC 채널 상호작용](#6-ipc-채널-상호작용)

---

## 1. Core 모듈 상호작용

### 1.1 파일별 기능 및 의존성

| 파일 | 기능 | 의존 모듈 | 소비자 |
|------|------|----------|--------|
| `types.ts` | 핵심 도메인 타입 정의 (Barista, Order, Receipt, Events) | - | 모든 모듈 |
| `barista.ts` | BaristaManager - 실행 단위 풀 관리 | types.ts, EventEmitter | orchestrator.ts |
| `order.ts` | OrderManager - 워크플로우 실행 큐 관리 | types.ts, EventEmitter | orchestrator.ts |
| `orchestrator.ts` | Orchestrator - 중앙 코디네이터 | barista.ts, order.ts, storage.ts, log-manager.ts | desktop/main, cli |
| `storage.ts` | Storage - JSON 기반 영속성 계층 | fs/promises, path | orchestrator.ts |
| `log-manager.ts` | LogManager - 주문별 로그 관리 | fs/promises, path | orchestrator.ts |
| `types/cafe.ts` | Cafe 타입 정의 | - | desktop/ipc/cafe.ts |
| `types/terminal.ts` | Terminal Pool 타입 | - | orchestrator/terminal |
| `types/role.ts` | Role 타입 정의 | - | orchestrator/role |
| `schema/cafe.ts` | Cafe Zod 스키마 | zod | desktop/ipc/cafe.ts |
| `schema/terminal.ts` | Terminal Zod 스키마 | zod | desktop/ipc/terminal.ts |
| `schema/role.ts` | Role Zod 스키마 | zod | orchestrator/role |

### 1.2 Core 내부 상호작용 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                        orchestrator.ts                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Orchestrator                          │   │
│  │  - createBarista()      - createOrder()                  │   │
│  │  - assignOrderToBarista() - startOrder()                 │   │
│  │  - executeOrder()       - completeOrder()                │   │
│  │  - cancelOrder()        - sendInput()                    │   │
│  └────┬─────────┬─────────┬─────────┬─────────────────────┘   │
│       │         │         │         │                          │
│  ┌────▼────┐┌───▼───┐┌────▼────┐┌───▼───┐                     │
│  │Barista  ││Order  ││Storage  ││Log    │                     │
│  │Manager  ││Manager││         ││Manager│                     │
│  └────┬────┘└───┬───┘└────┬────┘└───┬───┘                     │
│       │         │         │         │                          │
│    Pool      Queue      JSON      JSONL                        │
│    관리       관리      영속성     로깅                          │
└───────┴─────────┴─────────┴─────────┴──────────────────────────┘
```

### 1.3 이벤트 전파 경로

```
BaristaManager                    OrderManager
     │                                │
     │ emit('event', BaristaEvent)   │ emit('event', OrderEvent)
     │                                │
     ▼                                ▼
┌─────────────────────────────────────────────────────┐
│                   Orchestrator                       │
│  on('event') → re-emit as:                          │
│    - 'barista:event'                                │
│    - 'order:event'                                  │
│    - 'order:assigned'                               │
│    - 'order:completed'                              │
│    - 'order:execution-started'                      │
└────────────────────────┬────────────────────────────┘
                         │
                         ▼
              External Listeners
         (Desktop Main, CLI, Agents)
```

---

## 2. Desktop 모듈 상호작용

### 2.1 Main Process 파일별 기능

| 파일 | 기능 | 호출하는 모듈 | 호출받는 모듈 |
|------|------|--------------|--------------|
| `index.ts` | Electron 앱 진입점, 윈도우 생성 | - | preload, ipc/* |
| `execution-manager.ts` | BaristaEngineV2 통합, Order 실행 관리 | ipc/order.ts | orchestrator |
| `file-logger.ts` | Main 프로세스 로깅 | 모든 main 파일 | - |

### 2.2 IPC Handlers 상호작용

| Handler | 의존하는 외부 모듈 | 주요 역할 |
|---------|-------------------|----------|
| `ipc/cafe.ts` | @codecafe/core (CafeSchema) | Cafe 레지스트리 CRUD |
| `ipc/order.ts` | @codecafe/core (Orchestrator), @codecafe/git-worktree | Order CRUD + Worktree 통합 |
| `ipc/workflow.ts` | @codecafe/orchestrator | Workflow 관리 |
| `ipc/skill.ts` | @codecafe/orchestrator (SkillManager) | Skill CRUD |
| `ipc/terminal.ts` | @codecafe/orchestrator (TerminalPool) | Terminal Pool 관리 |
| `ipc/worktree.ts` | @codecafe/git-worktree (WorktreeManager) | Git Worktree 관리 |
| `ipc/provider.ts` | @codecafe/providers | Provider 정보 조회 |

### 2.3 Renderer 컴포넌트 상호작용

```
┌────────────────────────────────────────────────────────────────┐
│                           App.tsx                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ useViewStore → 현재 View 결정                             │  │
│  │ useIpcEffect → 모든 IPC 이벤트 구독                       │  │
│  │ useStageTracking → Stage 진행 추적                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│         ┌────────────────────┼────────────────────┐            │
│         ▼                    ▼                    ▼            │
│  ┌─────────────┐    ┌─────────────────┐   ┌───────────────┐   │
│  │NewGlobalLobby    │NewCafeDashboard │   │NewWorkflows   │   │
│  │(Cafe 선택)  │    │(Order 관리)     │   │(Workflow 편집)│   │
│  └─────────────┘    └────────┬────────┘   └───────────────┘   │
│                              │                                  │
│              ┌───────────────┼───────────────┐                 │
│              ▼               ▼               ▼                 │
│       ┌───────────┐   ┌───────────────┐ ┌──────────────┐      │
│       │OrderList  │   │Interactive    │ │OrderTimeline │      │
│       │           │   │Terminal       │ │View          │      │
│       └───────────┘   └───────────────┘ └──────────────┘      │
└────────────────────────────────────────────────────────────────┘
```

### 2.4 Store → Component 데이터 흐름

```
┌────────────────────────────────────────────────────────────┐
│                     Zustand Stores                          │
├───────────────┬────────────────┬────────────────────────────┤
│ useOrderStore │ useCafeStore   │ useViewStore               │
│  - orders     │  - cafes       │  - currentView             │
│  - session    │  - currentId   │  - viewParams              │
│    Statuses   │                │                            │
│  - stageResults               │                            │
└───────┬───────┴───────┬────────┴───────────┬───────────────┘
        │               │                    │
        ▼               ▼                    ▼
┌────────────┐  ┌─────────────┐      ┌─────────────┐
│ OrderList  │  │ NewSidebar  │      │ VIEW_MAP    │
│ OrderDetail│  │ CafeSelector│      │ [view]      │
└────────────┘  └─────────────┘      └─────────────┘
```

### 2.5 Hooks 의존성 맵

| Hook | 의존 Store | IPC 호출 | 역할 |
|------|-----------|---------|------|
| useIpcEffect | useOrderStore, useBaristaStore | order:on*, barista:on* | 이벤트 구독 |
| useStageTracking | useOrderStore | order:onOutput | Stage 진행 추적 |
| useOrderHandlers | useOrderStore | order:* | Order CRUD |
| useCafeHandlers | useCafeStore | cafe:* | Cafe CRUD |
| useRecipeHandlers | - | workflow:* | Workflow CRUD |
| useSkillHandlers | - | skill:* | Skill CRUD |

---

## 3. Orchestrator 모듈 상호작용

### 3.1 Engine 계층 상호작용

```
┌─────────────────────────────────────────────────────────────────┐
│                     workflow-executor.ts                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   WorkflowExecutor                          │ │
│  │  - start()         - pause()        - cancel()              │ │
│  │  - resume()        - executeWorkflow()                      │ │
│  └────────┬──────────────────┬─────────────────────┬──────────┘ │
│           │                  │                     │            │
│  ┌────────▼────────┐ ┌───────▼───────┐ ┌──────────▼──────────┐ │
│  │   fsm.ts        │ │dag-executor.ts│ │provider/executor.ts │ │
│  │   FSMEngine     │ │ DAGExecutor   │ │ ProviderExecutor    │ │
│  │  - getCurrentStage │- execute()    │ │ - execute()         │ │
│  │  - transitionTo │ │- executeNode()│ │ - headless/assisted │ │
│  └─────────────────┘ └───────────────┘ └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Terminal 계층 상호작용

```
┌─────────────────────────────────────────────────────────────────┐
│                     terminal-pool.ts                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    TerminalPool                             │ │
│  │  - acquireLease()   - releaseLease()   - getMetrics()      │ │
│  └────────┬─────────────────────────────────────────┬─────────┘ │
│           │                                         │           │
│  ┌────────▼─────────┐                     ┌─────────▼────────┐ │
│  │pool-semaphore.ts │                     │provider-adapter.ts│ │
│  │ PoolSemaphore    │                     │ProviderAdapter   │ │
│  │ - acquire()      │                     │Factory           │ │
│  │ - release()      │                     │ - create()       │ │
│  └──────────────────┘                     └────────┬─────────┘ │
│                                                    │           │
│                         ┌──────────────────────────┴───────┐   │
│                         │            adapters/              │   │
│                         │ ┌─────────────────────────────┐  │   │
│                         │ │ claude-code-adapter.ts      │  │   │
│                         │ │ - spawn() → ChildProcess    │  │   │
│                         │ │ - sendPrompt() → stdin      │  │   │
│                         │ │ - readOutput() → ndjson     │  │   │
│                         │ └─────────────────────────────┘  │   │
│                         │ ┌─────────────────────────────┐  │   │
│                         │ │ codex-adapter.ts            │  │   │
│                         │ │ - spawn() → node-pty        │  │   │
│                         │ │ - sendPrompt() → JSON msg   │  │   │
│                         │ │ - readOutput() → ack/done   │  │   │
│                         │ └─────────────────────────────┘  │   │
│                         └──────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Session 계층 상호작용

```
┌─────────────────────────────────────────────────────────────────┐
│                cafe-session-manager.ts                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │               CafeSessionManager                            │ │
│  │  - createSession()   - getSession()   - listSessions()     │ │
│  └────────────────────────────┬───────────────────────────────┘ │
│                               │                                 │
│                    ┌──────────▼──────────┐                     │
│                    │   order-session.ts   │                     │
│                    │     OrderSession     │                     │
│                    │  - start() - pause() │                     │
│                    │  - resume()          │                     │
│                    └─────────┬────────────┘                     │
│                              │                                  │
│           ┌──────────────────┼──────────────────┐              │
│           ▼                  ▼                  ▼              │
│  ┌─────────────────┐┌─────────────────┐┌─────────────────┐    │
│  │shared-context.ts││terminal-group.ts││stage-orchestrator│    │
│  │ SharedContext   ││ TerminalGroup   ││.ts               │    │
│  │ - setVar()      ││ - acquireTerminal││ StageOrchestrator│   │
│  │ - getVar()      ││ - release()     ││ - evaluate()     │    │
│  │ - syncResults() ││                 ││ - parseSignals() │    │
│  └─────────────────┘└─────────────────┘└─────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 3.4 Role/Template 상호작용

```
┌─────────────────────────────────────────────────────────────────┐
│                          role/                                   │
│  ┌───────────────────────────┐  ┌────────────────────────────┐ │
│  │     role-manager.ts       │  │      template.ts            │ │
│  │       RoleManager         │  │     TemplateEngine          │ │
│  │  - loadRole()             │  │  - renderRole()             │ │
│  │  - listRoles()            │  │  - render()                 │ │
│  │  - saveRole()             │  │  - extractVariables()       │ │
│  └──────────┬────────────────┘  └───────────────┬────────────┘ │
│             │                                   │               │
│             │         ┌─────────────────────────┘               │
│             │         │                                         │
│             ▼         ▼                                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    packages/roles/                        │  │
│  │  ├── planner.md    (Markdown + YAML frontmatter)         │  │
│  │  ├── coder.md      + Handlebars 템플릿                   │  │
│  │  ├── tester.md                                           │  │
│  │  ├── reviewer.md                                         │  │
│  │  └── generic-agent.md                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.5 Storage 상호작용

```
┌────────────────────────────────────────────────────────────┐
│                       storage/                              │
│  ┌─────────────────────────┐  ┌──────────────────────────┐ │
│  │     run-state.ts        │  │    event-logger.ts       │ │
│  │    RunStateManager      │  │     EventLogger          │ │
│  │  - createRun()          │  │  - logEvent()            │ │
│  │  - loadRun()            │  │  - getEvents()           │ │
│  │  - updateRun()          │  │                          │ │
│  └──────────┬──────────────┘  └──────────┬───────────────┘ │
│             │                            │                 │
│             ▼                            ▼                 │
│  ┌────────────────────────────────────────────────────────┐│
│  │                    .orch/runs/                          ││
│  │  ├── {runId}/                                          ││
│  │  │   ├── state.json      (실행 상태)                   ││
│  │  │   └── events.jsonl    (이벤트 로그)                 ││
│  └────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────┘
```

---

## 4. 전체 데이터 흐름

### 4.1 Order 생성 → 실행 → 완료 흐름

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Order Creation Flow                           │
└─────────────────────────────────────────────────────────────────────┘

[1] User Action (UI)
    │
    ▼
[2] Renderer: useOrderHandlers.handleCreateOrder()
    │
    ▼
[3] IPC: window.codecafe.order.createWithWorktree(params)
    │
    ▼
[4] Main/ipc/order.ts: 'order:createWithWorktree' handler
    │
    ├─[4a]─▶ WorktreeManager.createWorktree()
    │         └─▶ Git worktree add -b {branch} {path}
    │
    └─[4b]─▶ Orchestrator.createOrder()
              └─▶ OrderManager.createOrder()
                  └─▶ emit('order:created')
    │
    ▼
[5] Order 저장 (Storage) + worktreeInfo 업데이트
    │
    ▼
[6] IPC Response: { success: true, data: { order, worktreeInfo } }
    │
    ▼
[7] Renderer: useOrderStore.addOrder(order)
```

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Order Execution Flow                          │
└─────────────────────────────────────────────────────────────────────┘

[1] User clicks "Execute"
    │
    ▼
[2] IPC: order.execute(orderId, prompt)
    │
    ▼
[3] Main/ipc/order.ts: 'order:execute' handler
    │
    ▼
[4] ExecutionManager.executeOrder()
    │
    ├─[4a]─▶ BaristaEngineV2.executeOrder()
    │         │
    │         ├─▶ CafeSessionManager.createSession()
    │         │    │
    │         │    └─▶ OrderSession.start()
    │         │         │
    │         │         ├─▶ TerminalPool.acquireLease()
    │         │         │
    │         │         ├─▶ RoleManager.loadRole()
    │         │         │
    │         │         ├─▶ TemplateEngine.renderRole()
    │         │         │
    │         │         └─▶ Adapter.execute()
    │         │              │
    │         │              └─▶ PTY Process (Claude/Codex)
    │         │
    │         └─▶ emit('order:started', 'stage:started', etc.)
    │
    └─[4b]─▶ mainWindow.webContents.send('order:output', chunk)
    │
    ▼
[5] Renderer: useIpcEffect → order.onOutput()
    │
    ▼
[6] useOrderStore: appendOrderLog(), updateStageResult()
    │
    ▼
[7] UI Updates: InteractiveTerminal, OrderStageProgress
```

### 4.2 Workflow Stage 전이 흐름

```
┌────────────────────────────────────────────────────────────────┐
│                    FSM Stage Transition Flow                    │
└────────────────────────────────────────────────────────────────┘

[Stage: analyze] ─────────────────────────────────────────────────┐
    │                                                             │
    ▼                                                             │
FSMEngine.getCurrentStage() → 'analyze'                           │
    │                                                             │
    ▼                                                             │
DAGExecutor.execute(analyzeProfile)                               │
    │  - Load stage-profile.yml                                   │
    │  - Topological sort nodes                                   │
    │  - Execute each node                                        │
    │                                                             │
    ▼                                                             │
ProviderExecutor.execute()                                        │
    │  - TerminalPool.acquireLease()                             │
    │  - Adapter.sendPrompt()                                     │
    │  - Adapter.readOutput()                                     │
    │                                                             │
    ▼                                                             │
StageOrchestrator.evaluate(output)                                │
    │  - parseSignals() → { success, nextAction }                │
    │                                                             │
    ▼                                                             │
FSMEngine.transitionToNext() → 'plan'                             │
    │                                                             │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
[Stage: plan] → [Stage: code] → [Stage: review] → ...
```

---

## 5. 이벤트 흐름 맵

### 5.1 Order 이벤트 체인

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Event Chain Map                              │
└─────────────────────────────────────────────────────────────────────┘

OrderManager                Orchestrator              Desktop Main
     │                           │                         │
     │ order:created            │                         │
     ├─────────────────────────▶├─ order:event ──────────▶│ webContents.send
     │                          │                          │
     │ order:assigned           │                          │
     ├─────────────────────────▶├─ order:assigned ───────▶│
     │                          │                          │
     │ order:status-changed     │                          │
     ├─────────────────────────▶├─ order:event ──────────▶│
     │                          │                          │

BaristaEngineV2             ExecutionManager          Desktop Main
     │                           │                         │
     │ order:started            │                         │
     ├─────────────────────────▶├─ order:output ─────────▶│ webContents.send
     │                          │                          │
     │ stage:started            │                          │
     ├─────────────────────────▶├─ order:stage-started ──▶│
     │                          │                          │
     │ stage:completed          │                          │
     ├─────────────────────────▶├─ order:output (type:    │
     │                          │   stage_end) ──────────▶│
     │                          │                          │
     │ order:completed          │                          │
     ├─────────────────────────▶├─ order:completed ──────▶│
```

### 5.2 Renderer 이벤트 수신 및 처리

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Renderer Event Handling                           │
└─────────────────────────────────────────────────────────────────────┘

Main Process sends                  useIpcEffect hooks
     │                                    │
     │ 'order:event'                     │
     ├───────────────────────────────────▶│ updateOrder(order)
     │                                    │
     │ 'order:assigned'                  │
     ├───────────────────────────────────▶│ updateOrder(order)
     │                                    │
     │ 'order:completed'                 │
     ├───────────────────────────────────▶│ updateOrder(order)
     │                                    │
     │ 'order:output'                    │
     ├───────────────────────────────────▶│ appendOrderLog(log)
     │                                    │ updateStageResult()
     │                                    │
     │ 'order:session-started'           │
     ├───────────────────────────────────▶│ updateSessionStatus()
     │                                    │
     │ 'order:stage-started'             │
     ├───────────────────────────────────▶│ useStageTracking:
     │                                    │   updateStageResult(running)
     │                                    │
     │ 'order:awaiting-input'            │
     ├───────────────────────────────────▶│ setAwaitingInput(true)
     │                                    │
     │ 'order:todo-progress'             │
     └───────────────────────────────────▶│ updateTodoProgress()
```

---

## 6. IPC 채널 상호작용

### 6.1 IPC 채널 → Handler → 외부 모듈 맵

| IPC Channel | Handler 파일 | 호출하는 외부 모듈 | 반환 타입 |
|-------------|-------------|-------------------|----------|
| `cafe:list` | ipc/cafe.ts | CafeRegistry (JSON) | `IpcResponse<Cafe[]>` |
| `cafe:create` | ipc/cafe.ts | Git config, CafeSchema | `IpcResponse<Cafe>` |
| `order:createWithWorktree` | ipc/order.ts | WorktreeManager, Orchestrator | `IpcResponse<{order, worktreeInfo}>` |
| `order:execute` | ipc/order.ts | ExecutionManager, BaristaEngineV2 | `IpcResponse<void>` |
| `order:sendInput` | ipc/order.ts | Orchestrator.sendInput() | `IpcResponse<void>` |
| `workflow:list` | ipc/workflow.ts | @codecafe/orchestrator | `IpcResponse<Workflow[]>` |
| `skill:list` | ipc/skill.ts | SkillManager | `IpcResponse<Skill[]>` |
| `terminal:init` | ipc/terminal.ts | TerminalPool.init() | `IpcResponse<void>` |
| `terminal:poolStatus` | ipc/terminal.ts | TerminalPool.getStatus() | `IpcResponse<PoolStatus>` |
| `worktree:list` | ipc/worktree.ts | WorktreeManager.listWorktrees() | `IpcResponse<WorktreeInfo[]>` |
| `worktree:mergeToTarget` | ipc/worktree.ts | WorktreeManager.mergeToTarget() | `IpcResponse<MergeResult>` |
| `provider:getAvailable` | ipc/provider.ts | @codecafe/providers | `IpcResponse<Provider[]>` |

### 6.2 IPC Request-Response vs Event 패턴

```
┌─────────────────────────────────────────────────────────────────────┐
│                    IPC Communication Patterns                        │
└─────────────────────────────────────────────────────────────────────┘

[Request-Response Pattern] (ipcMain.handle / ipcRenderer.invoke)
─────────────────────────────────────────────────────────────────────

Renderer                          Main
   │                               │
   │ invoke('order:create', {})    │
   ├──────────────────────────────▶│
   │                               │ await createOrder()
   │                               │
   │ IpcResponse<Order>            │
   │◀──────────────────────────────┤
   │                               │


[Event Pattern] (ipcMain → webContents.send / ipcRenderer.on)
─────────────────────────────────────────────────────────────────────

Main                              Renderer
   │                               │
   │ send('order:output', data)    │
   ├──────────────────────────────▶│ on('order:output', callback)
   │                               │
   │ send('order:completed', {})   │
   ├──────────────────────────────▶│ on('order:completed', callback)
   │                               │
   │ send('order:stage-started')   │
   ├──────────────────────────────▶│ on('order:stage-started', callback)
```

### 6.3 Preload Bridge 구조

```
┌─────────────────────────────────────────────────────────────────────┐
│                       preload/index.cts                              │
└─────────────────────────────────────────────────────────────────────┘

contextBridge.exposeInMainWorld('codecafe', {
  │
  ├── cafe: {
  │     list: () => ipcRenderer.invoke('cafe:list'),
  │     create: (p) => ipcRenderer.invoke('cafe:create', p),
  │     ...
  │   }
  │
  ├── order: {
  │     create: (p) => ipcRenderer.invoke('order:create', p),
  │     execute: (id, p) => ipcRenderer.invoke('order:execute', id, p),
  │     onOutput: (cb) => setupIpcListener('order:output', cb),
  │     ...
  │   }
  │
  ├── workflow: { ... }
  │
  ├── skill: { ... }
  │
  ├── terminal: { ... }
  │
  └── worktree: { ... }
})

// Helper: 이벤트 리스너 설정 + cleanup 함수 반환
function setupIpcListener(channel, callback) {
  const handler = (event, data) => callback(data)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)  // cleanup
}
```

---

## 7. 크로스 패키지 의존성 매트릭스

### 7.1 Import 의존성 매트릭스

| 패키지 | core | cli | desktop | orchestrator | providers | schema | roles | git-worktree |
|--------|:----:|:---:|:-------:|:------------:|:---------:|:------:|:-----:|:------------:|
| **core** | - | | | | | ✓ | | |
| **cli** | ✓ | - | | ✓ | ✓ | | | |
| **desktop** | ✓ | | - | ✓ | ✓ | | | ✓ |
| **orchestrator** | ✓ | | | - | ✓ | ✓ | ✓ | |
| **providers** | ✓ | | | | - | | | |
| **schema** | | | | | | - | | |
| **roles** | | | | | | | - | |
| **git-worktree** | | | | | | | | - |

### 7.2 런타임 호출 관계

```
                    ┌─────────┐
                    │ desktop │
                    └────┬────┘
                         │ IPC
    ┌────────────────────┼────────────────────┐
    │                    │                    │
    ▼                    ▼                    ▼
┌─────────┐      ┌─────────────┐      ┌─────────────┐
│  core   │◀─────│orchestrator │─────▶│git-worktree │
└────┬────┘      └──────┬──────┘      └─────────────┘
     │                  │
     │                  ▼
     │           ┌─────────────┐
     │           │  providers  │
     │           └──────┬──────┘
     │                  │
     │                  ▼
     │           ┌─────────────┐
     └──────────▶│   schema    │
                 └─────────────┘
                        │
                        ▼
                 ┌─────────────┐
                 │   roles     │
                 └─────────────┘
```

---

*이 문서는 코드 분석을 통해 자동 생성되었습니다.*
*생성일: 2026-01-26*
