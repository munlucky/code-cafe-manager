# CodeCafe Package Specifications

> 각 패키지의 아키텍처와 Flow를 분석한 문서입니다. 실제 코드가 아닌 구조와 흐름에 초점을 맞춥니다.

## 목차

1. [@codecafe/core](#1-codecafecore)
2. [@codecafe/cli](#2-codecafecli)
3. [@codecafe/desktop](#3-codecafedesktop)
4. [@codecafe/orchestrator](#4-codecafeorchestrator)
5. [@codecafe/providers](#5-codecafeproviders)
6. [@codecafe/schema](#6-codecafeschema)
7. [@codecafe/roles](#7-codecaferoles)
8. [@codecafe/git-worktree](#8-codecafegit-worktree)

---

## 1. @codecafe/core

### 개요
도메인 모델, 이벤트 시스템, 상태 관리를 담당하는 핵심 패키지

### 핵심 도메인 엔티티

| 엔티티 | 역할 | 주요 상태 |
|--------|------|----------|
| **Barista** | 실행 단위 (Worker) | IDLE → RUNNING → BUSY → ERROR → STOPPED |
| **Order** | 워크플로우 실행 인스턴스 | PENDING → RUNNING → COMPLETED/FAILED/CANCELLED |
| **Receipt** | 실행 결과 요약 | - |
| **Cafe** | 저장소 컨텍스트 | - |

### 아키텍처 흐름

```
┌─────────────────────────────────────────────────────┐
│              ORCHESTRATOR (Central Hub)             │
├─────────────────────────────────────────────────────┤
│ BaristaManager │ OrderManager │ Storage │ LogManager│
└───────┬────────┴───────┬──────┴────┬────┴─────┬─────┘
        │                │           │          │
    Pool 관리        Queue 관리   JSON 저장   로그 파일
```

### Event Flow

```
BaristaManager.emit('event') → Orchestrator → emit('barista:event')
OrderManager.emit('event')   → Orchestrator → emit('order:event')
```

### 주요 상태 전이

**Order Lifecycle:**
```
PENDING → [ASSIGN barista] → RUNNING → COMPLETED/FAILED
                ↓
           CANCELLED (user cancel)
```

**Barista Lifecycle:**
```
IDLE → RUNNING (during assignment) → IDLE (after order)
  ↓
ERROR → STOPPED
```

---

## 2. @codecafe/cli

### 개요
`codecafe` CLI 명령어 및 설정 관리

### 명령어 구조

```
codecafe
├── init                    # 글로벌 설정 초기화
├── doctor                  # 환경 검증 (git, Claude CLI, Node.js)
├── run                     # Provider 직접 실행
├── status                  # Barista/Order 상태 표시
├── ui                      # Electron 앱 실행 (미구현)
└── orch                    # Orchestrator 서브커맨드
    ├── init               # .orch 디렉토리 초기화
    ├── run [workflow]     # 워크플로우 실행
    ├── resume <runId>     # 일시정지된 실행 재개
    ├── status [runId]     # 실행 상태 확인
    ├── logs <runId>       # 로그 조회
    └── role <action>      # Role 관리 (add|edit|rm|list|show)
```

### 명령어 실행 흐름

```
User Command
  ↓
CLI Parses args (Commander)
  ↓
Command action 실행
  ↓
├─ ConfigManager 로드
├─ 환경 검증
├─ Provider 또는 Orchestrator 호출
└─ 결과 출력 (chalk colors + ora spinners)
```

### 설정 구조

```
~/.codecafe/
├── config.json           # 설정 파일
├── data/                 # 데이터 디렉토리
└── logs/                 # 로그 디렉토리
```

---

## 3. @codecafe/desktop

### 개요
Electron 기반 Manager UI (React + Zustand + TailwindCSS)

### 아키텍처 계층

```
┌──────────────────────────────────────────────┐
│ Renderer (React)                             │
│  ├── Views (Dashboard, Workflows, Skills)   │
│  ├── Stores (Zustand)                        │
│  └── Hooks (IPC, Handlers)                  │
└────────────────────┬─────────────────────────┘
                     │ IPC Channels
┌────────────────────▼─────────────────────────┐
│ Preload (contextBridge)                      │
│  └── window.codecafe API                     │
└────────────────────┬─────────────────────────┘
                     │
┌────────────────────▼─────────────────────────┐
│ Main Process                                 │
│  ├── IPC Handlers (11개 모듈)               │
│  ├── ExecutionManager                        │
│  └── Orchestrator                            │
└──────────────────────────────────────────────┘
```

### IPC 채널 카테고리

| Handler | Channels | 역할 |
|---------|----------|------|
| cafe.ts | `cafe:*` | Cafe 레지스트리 관리 |
| order.ts | `order:*` | Order CRUD + Worktree 통합 |
| workflow.ts | `workflow:*` | Workflow 관리 |
| skill.ts | `skill:*` | Skill 관리 |
| terminal.ts | `terminal:*` | Terminal Pool API |
| worktree.ts | `worktree:*` | Git Worktree 관리 |

### State Management (Zustand)

| Store | 역할 | 주요 상태 |
|-------|------|----------|
| useOrderStore | Order 상태 관리 | orders, sessionStatuses, stageResults, todoProgress |
| useCafeStore | Cafe 관리 | cafes, currentCafeId |
| useViewStore | 뷰 네비게이션 | currentView, viewParams |
| useTerminalStore | Terminal 상태 | - |
| useBaristaStore | Barista 상태 | - |

### Order 실행 흐름

```
Renderer: order.execute()
  ↓
IPC invoke: 'order:execute'
  ↓
Main: Orchestrator.executeOrder()
  ↓
Main: BaristaEngineV2 실행
  ↓
Main: webContents.send('order:output', chunk)
  ↓
Renderer: useIpcEffect() / useStageTracking()
  ↓
Renderer UI 업데이트 (Zustand)
```

---

## 4. @codecafe/orchestrator

### 개요
Multi AI CLI 오케스트레이터 엔진 (FSM + DAG 기반)

### 핵심 엔진 아키텍처

```
┌─────────────────────────────────────────────────────────────────────┐
│                       WorkflowExecutor (High-level)                 │
└────────────────────────────┬────────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼─────┐        ┌────▼──────┐      ┌────▼─────┐
    │FSMEngine │        │DAGExecutor│      │EventLogger│
    │(stages)  │        │(nodes)    │      │(persist) │
    └────┬─────┘        └────┬──────┘      └──────────┘
         │                   │
         └───────────────────┼───────────────────┐
                             │                   │
                    ┌────────▼────────┐    ┌────▼────────┐
                    │ProviderExecutor │    │RoleManager+ │
                    │(claude/codex)   │    │TemplateEngine│
                    └────────┬────────┘    └────┬────────┘
                             │                  │
                    ┌────────▼──────────────────▼──┐
                    │     TerminalPool             │
                    └────────┬─────────────────────┘
                             │
                    ┌────────▼──────────┐
                    │ PTY Processes     │
                    └───────────────────┘
```

### 워크플로우 실행 흐름

```
WorkflowExecutor.start()
  ├─ WorkflowRun 생성 (ExecutionContext + StageResults)
  ├─ Workflow + Stage Profiles + Assignments 로드
  └─ executeWorkflow() 루프:
      ├─ FSM: getCurrentStage()
      ├─ Stage 실행 (sequential 또는 parallel)
      │   ├─ Stage Profile (DAG) 로드
      │   ├─ DAGExecutor: topological sort + 노드 실행
      │   └─ ExecutionContext에 결과 저장
      ├─ FSM: evaluateCheckResult() 또는 transitionToNext()
      └─ max_iters 또는 terminal stage까지 반복
```

### Session 관리 (Multi-Terminal)

```
CafeSessionManager
  └─ OrderSession[]
       ├─ SharedContext (변수/결과 동기화)
       ├─ TerminalGroup (N terminals per Order)
       └─ StageOrchestrator (다음 액션 결정)
```

### 실행 모드 및 전략

| Mode | 설명 |
|------|------|
| Sequential | Stage당 하나의 Provider |
| Parallel (all) | 모든 Provider 성공 필요 |
| Parallel (race) | 첫 번째 성공 채택 |
| Parallel (majority) | 과반수 합의 |

---

## 5. @codecafe/providers

### 개요
AI Provider 추상화 및 구현 (PTY 기반)

### 아키텍처 계층

```
packages/orchestrator/src/terminal/
├── provider-adapter.ts         # IProviderAdapter 인터페이스
├── terminal-pool.ts            # TerminalPool (동시성 관리)
├── pool-semaphore.ts           # Provider별 Semaphore
└── adapters/
    ├── claude-code-adapter.ts  # Claude Code (child_process)
    └── codex-adapter.ts        # Codex (node-pty)
```

### Provider 비교

| 항목 | ClaudeCodeAdapter | CodexAdapter |
|------|-------------------|--------------|
| PTY 타입 | child_process.spawn | node-pty |
| 프로토콜 | ndjson (stream-json) | JSON 메시지 (request/ack/output/done) |
| CLI 모드 | `-p` (print/headless) | `--interactive` |
| 입력 방식 | stdin pipe | PTY write |
| 세션 지원 | 가능 (`--continue`) | 미지원 |

### Terminal Pool Flow

```
acquireLease(provider, baristaId)
  ├─ Provider용 Semaphore 획득
  ├─ acquire() → slot 대기 (full이면)
  ├─ Terminal 생성 (spawn PTY)
  ├─ TerminalLease 반환 {terminal, token, release()}
  └─ release() → terminal 반환, semaphore 해제
```

### Output Markers

```
[STDERR]         # stderr 출력
[TOOL]           # Tool 호출
[TOOL_RESULT]    # Tool 실행 결과
[TODO_PROGRESS]  # TodoWrite 진행률
[RESULT]         # 최종 결과
[FILE_EDIT]      # 파일 편집
```

---

## 6. @codecafe/schema

### 개요
YAML/JSON 스키마 및 Zod 유효성 검증

### 검증 전략

| 대상 | 도구 | 위치 |
|------|------|------|
| TypeScript 도메인 객체 | Zod | packages/core/src/schema/ |
| 설정 파일 (YAML/JSON) | JSON Schema + AJV | packages/orchestrator/src/schema/ |

### Zod 스키마 (Core)

| 스키마 | 대상 |
|--------|------|
| CafeSchema | Cafe 엔티티 |
| TerminalSchema | Terminal Pool 타입 |
| RoleSchema | Role 정의 |

### JSON 스키마 (Orchestrator)

| 스키마 | 대상 |
|--------|------|
| workflow.schema.json | Workflow DSL |
| stage-profile.schema.json | DAG 정의 |
| plan/code/test/check.schema.json | Stage 출력 |

### 검증 흐름

```
YAML/JSON 파일
  ↓
AJV Validator (캐싱됨)
  ↓
{ valid: boolean, data?: T, errors?: string[] }
```

---

## 7. @codecafe/roles

### 개요
AI Role 템플릿 시스템 (Handlebars 기반)

### Role 파일 구조

```markdown
---
id: {role-id}
name: {human-readable-name}
recommended_provider: claude-code | codex
skills: [skill_1, skill_2]
variables:
  - name: task
    type: string
    required: true
---

# Role Name

Handlebars 템플릿 본문...

{{#if requirements}}
## Requirements
{{requirements}}
{{/if}}
```

### Built-in Roles

| Role | 역할 | 주요 Skills |
|------|------|-------------|
| planner | 구현 계획 수립 | read_file, analyze_code, search_code |
| coder | 코드 구현 | read_file, write_file, edit_file, run_tests |
| tester | 테스트 검증 | run_tests, run_coverage, analyze_results |
| reviewer | 코드 리뷰 | analyze_code, check_patterns, security_audit |
| generic-agent | 범용 | read_file, write_file, run_command |

### Role 로딩 우선순위

```
1. .orch/roles/          (사용자 정의 - 최우선)
2. packages/roles/       (프로젝트 빌트인)
3. node_modules/@codecafe/roles/  (패키지 fallback)
```

### 템플릿 렌더링 흐름

```
LoadRole(roleId)
  → YAML frontmatter + 템플릿 파싱
  → Role 객체 반환
    ↓
RenderRole(role, context)
  → Handlebars 컴파일
  → Context 병합 (role metadata + user context)
  → 렌더링된 프롬프트 반환
    ↓
SendToProvider(prompt, provider)
  → AI Provider로 전송
```

---

## 8. @codecafe/git-worktree

### 개요
Git Worktree 기반 병렬 실행 격리 관리

### 핵심 기능

| 메서드 | 역할 |
|--------|------|
| createWorktree() | 격리된 Worktree 생성 |
| removeWorktree() | Worktree 삭제 (5회 재시도) |
| mergeToTarget() | Worktree 브랜치를 타겟에 병합 |
| listWorktrees() | 모든 Worktree 조회 |
| exportPatch() | Git diff를 패치 파일로 추출 |

### 격리 아키텍처

```
Repository Root/
├── .git/
├── .codecafe-worktrees/         ← Worktree 컨테이너
│   ├── order-123/               ← 격리된 Worktree #1
│   │   └── .git (symlink)
│   ├── order-124-2/             ← 충돌 시 자동 suffix
│   └── feature-456/
```

### Order-Worktree 통합 흐름

```
Order 생성 (IPC: order:createWithWorktree)
  ↓
WorktreeManager.createWorktree()
  ↓
Order.worktreeInfo 업데이트 {path, branch, baseBranch}
  ↓
BaristaEngineV2 실행 (worktree에서)
  ↓
완료 후: mergeToTarget() 또는 removeWorktree()
```

### 병렬 실행 지원

```
Order #1 (worktree: order-1/)  [Terminal Pool 1]
Order #2 (worktree: order-2/)  [Terminal Pool 2]
Order #3 (worktree: order-3/)  [Terminal Pool 3]
  ↓
각각 독립적인 파일시스템 컨텍스트
Lock 없이 병렬 실행 가능
```

---

## 패키지 의존성 관계

```
                    ┌─────────────┐
                    │   desktop   │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
   ┌───────────┐    ┌─────────────┐    ┌───────────┐
   │    cli    │    │orchestrator │    │git-worktree│
   └─────┬─────┘    └──────┬──────┘    └───────────┘
         │                 │
         └────────┬────────┘
                  ▼
            ┌───────────┐
            │   core    │
            └─────┬─────┘
                  │
         ┌───────┴───────┐
         ▼               ▼
   ┌───────────┐   ┌───────────┐
   │  schema   │   │   roles   │
   └───────────┘   └───────────┘
```

---

*이 문서는 코드 분석을 통해 자동 생성되었습니다.*
*생성일: 2026-01-26*
