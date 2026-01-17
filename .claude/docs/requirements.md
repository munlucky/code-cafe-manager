# CodeCafe Manager Desktop-First Requirements Analysis

> **작성일**: 2026-01-12
> **목적**: Desktop-First CodeCafe Manager 구현을 위한 요구사항 분석
> **기준 문서**: PRD_v2.md (Desktop-First Vision), PRD.md (M1-M2 Current State)

---

## 1. 요약 (Executive Summary)

### 1.1 프로젝트 비전

**CodeCafe Manager**는 로컬 멀티-AI 오케스트레이션 플랫폼으로, Desktop-First 경험을 통해 개발자가 여러 프로젝트(Cafe)와 AI 작업(Order)을 관리할 수 있는 시스템입니다.

### 1.2 핵심 가치

1. **Desktop-First Experience**: 모든 워크플로우(Setup, Execution, Monitoring)가 Desktop App에서 완결
2. **Project as a Cafe**: 단일 Git Repository = 1개 Cafe
3. **Isolation by Default**: `git-worktree` 기반 자동 격리
4. **Parallel Orchestration**: 다중 Order 병렬 실행 + 실시간 CCTV 관측

### 1.3 현재 상태 (As-Is)

**M1 완료 (CLI + Basic Orchestration)**
- ✅ CLI 기반 바리스타(Barista) 풀 관리
- ✅ Claude Code Provider 1종
- ✅ 기본 Order 실행 + 로그 스트리밍
- ✅ Electron UI 스켈레톤 (Vanilla JS)

**M2 완료 (Provider 확장 + Worktree + Recipe Engine)**
- ✅ Codex Provider 추가 (IProvider 인터페이스)
- ✅ Git Worktree 병렬 실행 지원
- ✅ Recipe 실행 엔진 (DAG, Parallel, Retry, Timeout)
- ✅ Desktop UI 기반 구조 (Provider/Worktree/Recipe Studio)

### 1.4 목표 상태 (To-Be: PRD_v2 Desktop-First)

**Desktop-First 완전 구현**
- Global Lobby (Cafe Selection)
- Cafe Dashboard (Order Management)
- Order Live View (CCTV: Terminal Grid + Workflow Graph)
- Role Manager (Agent Studio)
- Settings & Embedded Terminal (In-App Auth)

---

## 2. Gap Analysis (현재 vs 목표)

### 2.1 아키텍처 Gap

| 영역 | 현재 (M1-M2) | 목표 (PRD_v2) | Gap |
|------|-------------|--------------|-----|
| **Project Model** | 단일 프로젝트 실행 | Multi-Cafe 관리 (N개 Repo) | ❌ Cafe Registry 없음 |
| **Workspace** | Worktree 기능 존재 | 자동 Worktree 생성/정리 | ⚠️ 자동화 부족 |
| **Terminal** | Provider 프로세스 추상화 | Terminal Pool (Resource) 분리 | ❌ Terminal Pool 개념 없음 |
| **Agent Model** | Barista (Worker) | Barista + Role (Template) 분리 | ❌ Role System 없음 |
| **Context** | 없음 | Shared Memory Board (파일 기반) | ❌ Context 메커니즘 없음 |

### 2.2 UI/UX Gap

| 기능 | 현재 (M1-M2) | 목표 (PRD_v2) | Gap |
|------|-------------|--------------|-----|
| **Cafe Selection** | 없음 (단일 프로젝트) | Global Lobby (Card Grid) | ❌ 미구현 |
| **Order Creation** | Vanilla JS Form | Kiosk (Recipe + Role Mapping) | ⚠️ Role 매핑 UI 없음 |
| **Real-time Monitor** | 로그 텍스트 | Terminal Grid + Workflow Graph | ❌ PTY 미러링 없음 |
| **Context View** | 없음 | Shared Memory Board 실시간 렌더링 | ❌ 미구현 |
| **Role Manager** | 없음 | Agent Studio (Prompt + Skills) | ❌ 미구현 |
| **Provider Auth** | 외부 터미널 | Embedded Terminal (xterm.js) | ❌ 내장 터미널 없음 |

### 2.3 기능 Gap

| 기능 | 현재 (M1-M2) | 목표 (PRD_v2) | Gap |
|------|-------------|--------------|-----|
| **Multi-Cafe** | 1개 프로젝트 | N개 Cafe 동시 관리 | ❌ Cafe Registry |
| **Terminal Pool** | Provider = Process | Terminal Pool + Barista Lease | ❌ Resource Pool 아키텍처 |
| **Role System** | Hardcoded Barista | Role Template + Skills | ❌ Role Registry |
| **Context Sharing** | 없음 | `.codecafe/run/context.md` 공유 | ❌ Context Manager |
| **PR Workflow** | Patch Export | Worktree → PR 자동화 | ⚠️ PR 생성 수동 |

---

## 3. 핵심 요구사항 (Core Requirements)

### 3.1 FR-1: Multi-Cafe Management

**목표**: 개발자가 여러 Git Repository를 "Cafe"로 등록하고 관리

**기능**
- `CafeRegistry`: Cafe 목록 저장 (로컬 SQLite 또는 JSON)
- Cafe 등록: 로컬 폴더 선택 → Git Repo 검증 → `.orch` 설정 로드
- Cafe 삭제: 메타데이터만 삭제, 실제 폴더는 유지
- Cafe 상태 표시: 현재 브랜치, dirty/clean, active orders 개수

**UI**
- **Global Lobby**: Card Grid Layout
  - Card: Cafe Name, Path, Active Orders Badge, Repo Status
  - Actions: `Add Cafe`, `Enter Cafe`, `Remove Cafe`

**데이터 모델**
```typescript
interface Cafe {
  id: string;               // UUID
  name: string;             // Repo 이름
  path: string;             // 절대 경로
  currentBranch: string;
  isDirty: boolean;
  activeOrders: number;     // running orders 개수
  createdAt: Date;
}
```

**우선순위**: 🔴 HIGH (Desktop-First 핵심)

---

### 3.2 FR-2: Terminal Pool & Resource Management

**목표**: Provider 프로세스를 "Terminal"로 추상화하고, Barista가 동적으로 Lease

**아키텍처 변경**
```
현재 (M2):
  Barista → Provider (1:1 매핑)

목표 (PRD_v2):
  Provider → Terminal Pool (1:N)
  Terminal ← Barista Lease (M:N)
```

**기능**
- `TerminalPool`: Provider별 Terminal 인스턴스 관리
  - `spawn(provider: string): Terminal`
  - `release(terminalId: string): void`
  - `list(): Terminal[]`
- `Barista`: 논리적 Worker
  - `lease(pool: TerminalPool): Terminal`
  - `execute(prompt: string): Promise<Result>`
  - `releaseTerminal(): void`

**데이터 모델**
```typescript
interface Terminal {
  id: string;               // Terminal ID
  provider: string;         // 'claude-code' | 'codex'
  process: ChildProcess;    // PTY 프로세스
  status: 'idle' | 'busy';
  currentBarista?: string;  // Lease 중인 Barista ID
}

interface Barista {
  id: string;
  role: Role;               // Role Template
  terminal?: Terminal;      // Leased Terminal
  status: 'idle' | 'running' | 'error';
}
```

**우선순위**: 🟡 MEDIUM (아키텍처 개선)

---

### 3.3 FR-3: Role System (Agent Templates)

**목표**: Barista의 "역할"을 Template화하여 재사용

**기능**
- `RoleRegistry`: 기본 Role + 사용자 정의 Role 관리
- Role 구성 요소:
  - System Prompt Template (Handlebars)
  - Skills (Tools Definition)
  - Recommended Provider
- Role 할당: Order 생성 시 각 Stage에 Role 매핑

**데이터 모델**
```typescript
interface Role {
  id: string;               // 'planner' | 'coder' | 'tester' | 'reviewer'
  name: string;
  systemPrompt: string;     // Handlebars template
  skills: string[];         // Tool names
  recommendedProvider: string;
}

interface Stage {
  id: string;
  roles: RoleAssignment[];  // N Baristas with roles
}

interface RoleAssignment {
  roleId: string;
  count: number;            // 동일 Role을 몇 개 할당할지 (예: Coder 3명)
}
```

**UI**
- **Role Manager (Agent Studio)**
  - Role List (Default + Custom)
  - Role Editor: Prompt + Skills + Provider
- **Order Creation Kiosk**
  - Stage별 Role 매핑 (드래그 앤 드롭 또는 폼)

**우선순위**: 🟡 MEDIUM (사용자 경험 개선)

---

### 3.4 FR-4: Shared Context (Memory Board)

**목표**: Order별 Barista 간 협업을 위한 파일 기반 공유 메모리

**기능**
- `.codecafe/run/context.md` 생성 (Worktree별)
- Barista가 Read/Write/Append 가능
- UI에서 실시간 렌더링 (Markdown)

**아키텍처**
```
Order Start → createContext() → .codecafe/run/context.md
Barista Prompt Injection → "You can read/write shared context at .codecafe/run/context.md"
Barista Execution → Context 파일 읽기/쓰기
UI → File Watcher → Real-time Markdown Rendering
```

**데이터 구조**
```markdown
# Order Context: {orderId}

## Metadata
- Order ID: {orderId}
- Recipe: {recipeName}
- Started: {timestamp}

## Shared Memory
[Barista들이 자유롭게 작성]

### Planner (2026-01-12 10:30)
- Plan: ...

### Coder-1 (2026-01-12 10:45)
- Implementation: ...
```

**우선순위**: 🟡 MEDIUM (협업 강화)

---

### 3.5 FR-5: Order Live View (CCTV)

**목표**: 실시간 Barista 작업 관찰 (Terminal Grid + Workflow Graph)

**UI 구성**
```
┌─────────────────────────────────────────────────────┐
│ Order Live View (#123)                              │
├──────────────┬────────────────────┬─────────────────┤
│ Workflow     │ Terminal Grid      │ Context Board   │
│ Graph        │ ┌────────┬────────┐│                 │
│              │ │Barista1│Barista2││ [context.md]    │
│ Plan → Code  │ │xterm.js│xterm.js││ Markdown        │
│    ↓         │ └────────┴────────┘│ Rendering       │
│  Test        │ ┌────────┬────────┐│                 │
│              │ │Barista3│Barista4││                 │
│              │ │xterm.js│xterm.js││                 │
│              │ └────────┴────────┘│                 │
└──────────────┴────────────────────┴─────────────────┘
```

**기능**
- **Workflow Graph**: Mermaid 또는 React Flow로 DAG 렌더링
  - 현재 실행 중인 Node 하이라이트
  - 완료/실패 상태 표시
- **Terminal Grid**: xterm.js 기반 PTY 미러링
  - Barista별 Terminal 실시간 출력
  - 스크롤, 복사 가능
- **Context Board**: Markdown 실시간 렌더링
  - Chokidar로 파일 변경 감지
  - Auto-scroll to bottom

**우선순위**: 🔴 HIGH (Desktop-First 핵심 가치)

---

### 3.6 FR-6: Settings & Embedded Terminal

**목표**: Desktop App 내에서 Provider 인증 완료

**기능**
- **Provider List**: 설치된 Provider 표시
- **Connect Workflow**:
  1. `Connect Claude` 버튼 클릭
  2. Embedded Terminal (xterm.js + node-pty) 열림
  3. `claude login` 자동 실행
  4. 사용자가 브라우저 인증 완료
  5. Exit code 0 감지 → "Connected" 상태 변경
- **Disconnect**: Provider 인증 해제 (선택적)

**UI**
- **Settings > Providers** 탭
  - Provider Card (Name, Status, Version)
  - `Connect` / `Disconnect` 버튼
  - 내장 터미널 모달

**우선순위**: 🔴 HIGH (Desktop-First UX)

---

### 3.7 FR-7: Automatic Worktree Management

**목표**: Order 생성 시 Worktree 자동 생성, 완료 시 정리 옵션

**기능**
- **Pre-Order Hook**:
  - `workspace.mode=worktree` 시 자동 실행
  - baseBranch에서 `order/{orderId}` 브랜치 생성
  - Worktree 폴더 생성: `{repo}/../.codecafe-worktrees/{orderId}`
  - Context 파일 복사: `.codecafe/run/context.md` 생성
- **Post-Order Hook**:
  - `workspace.clean=true`: worktree 삭제 + 브랜치 삭제
  - `workspace.clean=false`: 보존 (기본값)
  - 미커밋 변경사항 있을 경우 경고 + 사용자 확인

**UI**
- **Order Creation**: Worktree 모드 토글
- **Order Detail**:
  - Worktree 경로 표시
  - "Open Folder", "Export Patch", "Clean Worktree" 버튼
- **Dashboard > Worktrees 탭**:
  - Worktree 목록 (Order ID, Branch, Size, Status)
  - 일괄 정리 기능

**우선순위**: 🟡 MEDIUM (M2 기능 자동화)

---

## 4. 기술 요구사항 (Technical Requirements)

### 4.1 TR-1: Package Structure Refactoring

**현재 문제점** (STRUCTURE_PROPOSAL.md)
- `@codecafe/core` vs `@codecafe/orchestrator` 역할 불명확
- `@codecafe/schema` 분리 필요성 의문
- Provider 인터페이스 표준화 부족

**제안**
```
packages/
├── core/                  # [Types & Contracts]
│   ├── types/             # Workflow, Run, Node, Cafe, Role
│   ├── schema/            # Zod Schemas (schema 패키지 병합)
│   └── interfaces/        # IProvider, ITerminal, IRole
├── orchestrator/          # [Main Engine]
│   ├── engine/            # DAG Execution (기존)
│   ├── terminal/          # [NEW] Terminal Pool
│   ├── barista/           # [NEW] Barista + Role Logic
│   ├── context/           # [NEW] Shared Context Manager
│   └── state/             # State Persistence
├── providers/
│   ├── common/            # IProvider 인터페이스 (기존)
│   ├── claude-code/
│   └── codex/
├── cli/
├── desktop/
│   ├── main/
│   ├── preload/
│   └── renderer/          # React 마이그레이션 (M3+)
├── git-worktree/          # [Utility]
└── roles/                 # [NEW] Default Role Templates
    ├── planner.md
    ├── coder.md
    ├── tester.md
    └── reviewer.md
```

**작업**
1. `@codecafe/schema` → `@codecafe/core/src/schema`로 병합
2. `@codecafe/orchestrator/src/terminal/` 신규 생성 (Terminal Pool)
3. `@codecafe/orchestrator/src/barista/` 리팩토링 (Role System 통합)
4. `@codecafe/orchestrator/src/context/` 신규 생성 (Context Manager)
5. `packages/roles/` 신규 패키지 (기본 Role 템플릿)

**우선순위**: 🟡 MEDIUM

---

### 4.2 TR-2: Desktop UI Tech Stack Upgrade

**현재 상태** (M2)
- Vanilla JS + TailwindCSS
- IPC 기반 Main ↔ Renderer 통신
- xterm.js 없음 (로그만 텍스트)

**목표 상태** (UI_IMPROVEMENT_PLAN.md)
- React 18 + TypeScript
- Zustand (전역 상태 관리)
- shadcn/ui (고품질 컴포넌트)
- xterm.js + xterm-addon-fit (Terminal Grid)
- React Flow (Workflow Graph) 또는 Mermaid
- Lucide React (아이콘)

**마이그레이션 계획**
1. **Phase 1**: React 기반 재작성 (Atomic Design)
   - Atoms: Button, Input, Badge, Card
   - Molecules: CafeCard, OrderCard, TerminalPane
   - Organisms: CafeList, OrderList, TerminalGrid
   - Templates: LobbyLayout, DashboardLayout
2. **Phase 2**: xterm.js 통합 (PTY 미러링)
3. **Phase 3**: React Flow DAG 시각화

**우선순위**: 🔴 HIGH (Desktop-First 핵심)

---

### 4.3 TR-3: Context Manager Implementation

**요구사항**
- 파일 기반 Shared Memory (`.codecafe/run/context.md`)
- Chokidar 기반 파일 변경 감지
- UI에서 실시간 Markdown 렌더링
- Barista에게 Context 경로 자동 주입 (Prompt)

**아키텍처**
```typescript
// packages/orchestrator/src/context/context-manager.ts
class ContextManager {
  async create(orderId: string, worktreePath: string): Promise<string>;
  async read(contextPath: string): Promise<string>;
  async append(contextPath: string, content: string): Promise<void>;
  watch(contextPath: string, callback: (content: string) => void): void;
}
```

**통합 지점**
- Order 생성 시: `contextManager.create()`
- Barista Prompt: 시스템 메시지에 Context 경로 추가
- UI: `contextManager.watch()` + Markdown 렌더링

**우선순위**: 🟡 MEDIUM

---

### 4.4 TR-4: Terminal Pool Architecture

**기존 문제**
- Provider = Process (1:1 고정)
- Barista 재사용 불가능
- Terminal 리소스 최적화 어려움

**새로운 아키텍처**
```typescript
// packages/orchestrator/src/terminal/terminal-pool.ts
class TerminalPool {
  private terminals: Map<string, Terminal> = new Map();

  spawn(provider: string): Terminal;
  release(terminalId: string): void;
  lease(provider: string): Terminal | null;  // idle terminal 반환
  terminate(terminalId: string): void;
}

// packages/orchestrator/src/barista/barista.ts
class Barista {
  private terminal?: Terminal;

  async execute(pool: TerminalPool, prompt: string): Promise<Result> {
    this.terminal = pool.lease(this.role.recommendedProvider);
    if (!this.terminal) throw new Error('No available terminal');

    try {
      return await this.terminal.execute(prompt);
    } finally {
      pool.release(this.terminal.id);
      this.terminal = undefined;
    }
  }
}
```

**변경 범위**
- `@codecafe/orchestrator/src/terminal/` 신규
- `@codecafe/core/src/barista.ts` 리팩토링
- `@codecafe/orchestrator/src/engine/` Terminal Pool 통합

**우선순위**: 🟡 MEDIUM (아키텍처 개선)

---

### 4.5 TR-5: Role Registry Implementation

**요구사항**
- 기본 Role 4종 제공 (Planner, Coder, Tester, Reviewer)
- 사용자 정의 Role 추가/편집/삭제
- Role → Barista 매핑 로직

**데이터 구조**
```typescript
// packages/roles/planner.md
---
id: planner
name: Planner
recommendedProvider: claude-code
skills:
  - file-read
  - git-status
---

# Role: Planner

You are a software planner. Your task is to...
[System Prompt Template]
```

**구현**
```typescript
// packages/orchestrator/src/role/role-registry.ts
class RoleRegistry {
  private roles: Map<string, Role> = new Map();

  async loadDefaults(): Promise<void>;          // packages/roles/*.md
  async loadCustom(userPath: string): Promise<void>;  // ~/.codecafe/roles/*.md
  get(roleId: string): Role;
  list(): Role[];
  create(role: Role): void;
  update(roleId: string, updates: Partial<Role>): void;
  delete(roleId: string): void;
}
```

**우선순위**: 🟡 MEDIUM

---

## 5. 리스크 분석 (Risk Assessment)

### 5.1 HIGH Risk

#### R-1: xterm.js PTY Mirroring 복잡도
**리스크**: PTY 출력을 실시간으로 여러 xterm.js 인스턴스에 전송하는 로직이 복잡할 수 있음

**영향**: Order Live View (CCTV) 핵심 기능

**완화 전략**:
- node-pty의 `onData` 이벤트를 WebSocket 또는 IPC로 Renderer에 전송
- xterm.js 인스턴스별 독립적인 버퍼 관리
- 백프레셔 처리 (출력 속도가 렌더링 속도보다 빠를 경우)

**우선순위**: 🔴 HIGH

---

#### R-2: Multi-Cafe Context Switching 성능
**리스크**: Cafe 전환 시 모든 `.orch` 설정과 Order 메타데이터를 로드하면 느려질 수 있음

**영향**: Global Lobby ↔ Cafe Dashboard 전환 UX

**완화 전략**:
- Lazy Loading: Cafe 진입 시에만 `.orch` 로드
- In-Memory Cache: 최근 3개 Cafe 메타데이터 캐싱
- Background Sync: Cafe 상태 업데이트는 백그라운드에서 수행

**우선순위**: 🔴 HIGH

---

### 5.2 MEDIUM Risk

#### R-3: Terminal Pool 동시성 제어
**리스크**: 여러 Barista가 동시에 Terminal을 Lease/Release할 때 Race Condition

**영향**: Terminal Pool 아키텍처

**완화 전략**:
- Mutex 또는 Semaphore 사용
- Terminal 상태 전이를 원자적으로 처리 (idle → busy → idle)
- 단위 테스트로 동시성 시나리오 검증

**우선순위**: 🟡 MEDIUM

---

#### R-4: Shared Context 파일 충돌
**리스크**: 여러 Barista가 동시에 `context.md`를 쓸 때 덮어쓰기 가능성

**영향**: Context Sharing 기능

**완화 전략**:
- Append-Only: 항상 파일 끝에 추가 (`fs.appendFile`)
- Timestamp 기반 섹션: `### Barista-X (timestamp)` 형태로 구분
- File Locking은 복잡하므로 Append-Only로 회피

**우선순위**: 🟡 MEDIUM

---

### 5.3 LOW Risk

#### R-5: Role Template Handlebars 주입 보안
**리스크**: 사용자 정의 Role의 Handlebars 템플릿에 악의적인 코드 삽입

**영향**: Role System 보안

**완화 전략**:
- Handlebars는 기본적으로 XSS 안전 (HTML Escape)
- 추가 검증: Template 로드 시 위험한 Helper 사용 금지
- Sandbox: Role은 파일 시스템 외부 접근 불가

**우선순위**: 🟢 LOW (현재는 로컬 사용자만 접근)

---

## 6. 미해결 질문 (Open Questions)

### 6.1 HIGH Priority

#### Q-1: Cafe Registry 저장소 형식
**질문**: Cafe 메타데이터를 어디에 저장할지?

**옵션**:
- A) SQLite (`.codecafe/cafes.db`)
  - 장점: 쿼리 성능, 트랜잭션 안전
  - 단점: 바이너리 파일, 백업 어려움
- B) JSON (`.codecafe/cafes.json`)
  - 장점: 사람이 읽기 쉬움, Git 버전 관리 가능
  - 단점: 대규모 데이터 느림

**제안**: M1-M2는 JSON, M3+ SQLite 마이그레이션 (Cafe 개수가 많아질 경우)

---

#### Q-2: Terminal Pool 크기 기본값
**질문**: 각 Provider별 Terminal 몇 개를 기본으로 생성할지?

**고려 사항**:
- 너무 많으면 메모리/CPU 낭비
- 너무 적으면 Barista 대기 시간 증가

**제안**:
- 기본값: Provider별 4개 (M1-M2 Barista Pool 크기와 동일)
- 사용자 설정 가능 (Settings > Providers > Pool Size)

---

#### Q-3: Order Live View 기본 레이아웃
**질문**: Workflow Graph, Terminal Grid, Context Board의 화면 비율?

**옵션**:
- A) 1:2:1 (Graph 작게, Terminal 크게)
- B) 1:1:1 (동일 비율)
- C) 사용자가 Resize 가능 (Split Pane)

**제안**: C) React Split Pane 사용하여 사용자 커스터마이징 허용

---

### 6.2 MEDIUM Priority

#### Q-4: Role의 Skills 정의 방법
**질문**: Skills를 어떻게 표현할지? (단순 문자열 vs JSON Schema)

**옵션**:
- A) 문자열 배열 (예: `["file-read", "git-status"]`)
  - 장점: 단순함
  - 단점: 검증 어려움, 확장성 낮음
- B) JSON Schema (MCP Tools 형식)
  - 장점: 표준화, 검증 가능
  - 단점: 복잡함

**제안**: A) 문자열 배열로 시작, M3+ JSON Schema 고려

---

#### Q-5: Context Board Markdown 렌더링 라이브러리
**질문**: 어떤 Markdown 렌더러를 사용할지?

**옵션**:
- A) `react-markdown` (React 기반)
- B) `marked` + DOMPurify (보안)
- C) `markdown-it` (플러그인 확장성)

**제안**: A) `react-markdown` (React UI 전환과 호환성)

---

### 6.3 LOW Priority

#### Q-6: Worktree 기본 baseBranch
**질문**: Worktree 생성 시 어느 브랜치를 기본으로 사용할지?

**옵션**:
- A) `main` 고정
- B) 현재 활성 브랜치
- C) `.orch` 설정에서 지정

**제안**: C) `.orch` 설정 (기본값 `main`)

---

## 7. 구현 우선순위 (Implementation Priority)

### 7.1 Phase 1: Desktop UI 기반 (4주)

**목표**: Desktop-First UX의 핵심 화면 구현

**작업**:
1. React + TypeScript 마이그레이션
2. shadcn/ui 컴포넌트 통합
3. Global Lobby (Cafe Selection)
4. Cafe Dashboard (Order List)
5. Cafe Registry (JSON 기반)

**산출물**:
- `packages/desktop/src/renderer/` 전면 재작성
- `@codecafe/core/src/types/cafe.ts` 신규
- `.codecafe/cafes.json` 스펙

**리스크**: React 마이그레이션 중 Electron IPC 호환성

---

### 7.2 Phase 2: Terminal Pool & Role System (3주)

**목표**: 아키텍처 개선 + Role 기반 Agent 관리

**작업**:
1. Terminal Pool 구현 (`@codecafe/orchestrator/src/terminal/`)
2. Role Registry 구현 (`@codecafe/orchestrator/src/role/`)
3. 기본 Role 4종 작성 (`packages/roles/`)
4. Barista ↔ Terminal Lease 로직 통합
5. Order Creation Kiosk (Role Mapping UI)

**산출물**:
- `packages/orchestrator/src/terminal/terminal-pool.ts`
- `packages/orchestrator/src/role/role-registry.ts`
- `packages/roles/*.md` (Planner, Coder, Tester, Reviewer)

**리스크**: Terminal Pool 동시성 제어

---

### 7.3 Phase 3: Order Live View (CCTV) (4주)

**목표**: 실시간 관측 기능 (Terminal Grid + Workflow Graph + Context Board)

**작업**:
1. xterm.js 통합 (PTY 미러링)
2. Workflow Graph (React Flow 또는 Mermaid)
3. Context Manager 구현
4. Context Board (Markdown 렌더링)
5. Real-time 업데이트 (IPC + File Watch)

**산출물**:
- `packages/desktop/src/renderer/components/OrderLiveView/`
- `packages/orchestrator/src/context/context-manager.ts`
- xterm.js + node-pty 통합

**리스크**: xterm.js PTY Mirroring 복잡도

---

### 7.4 Phase 4: Settings & Embedded Terminal (2주)

**목표**: In-App Provider 인증

**작업**:
1. Settings > Providers 화면
2. Embedded Terminal (xterm.js + node-pty)
3. Provider Connect Workflow (`claude login` 자동 실행)
4. Exit Code 감지 → 상태 업데이트

**산출물**:
- `packages/desktop/src/renderer/components/Settings/Providers.tsx`
- `packages/desktop/src/main/ipc/provider-auth.ts`

**리스크**: Provider별 인증 흐름 차이

---

### 7.5 Phase 5: Worktree 자동화 + PR Workflow (2주)

**목표**: Worktree 자동 생성/정리 + PR 생성 지원

**작업**:
1. Order Pre-Hook (Worktree 자동 생성)
2. Order Post-Hook (정리 옵션)
3. PR 생성 UI (GitHub API 연동)
4. Worktree 목록 화면 고도화

**산출물**:
- `packages/orchestrator/src/hooks/` (Pre/Post Hooks)
- `packages/git-worktree/src/pr-helper.ts` (GitHub API)

**리스크**: Git 명령어 크로스플랫폼 호환성

---

## 8. 영향 범위 추정 (Impact Analysis)

### 8.1 신규 파일 (약 60개)

**Packages (3개 신규 패키지)**
- `packages/roles/` (4개 Role 템플릿)
- `packages/orchestrator/src/terminal/` (3개)
- `packages/orchestrator/src/context/` (2개)

**Desktop UI (React 재작성)**
- `packages/desktop/src/renderer/components/` (약 30개)
  - Atoms: 5개
  - Molecules: 10개
  - Organisms: 10개
  - Templates: 5개

**IPC Handlers**
- `packages/desktop/src/main/ipc/cafe.ts`
- `packages/desktop/src/main/ipc/role.ts`
- `packages/desktop/src/main/ipc/context.ts`
- `packages/desktop/src/main/ipc/terminal.ts`

**Tests**
- Terminal Pool 테스트 (5개)
- Role Registry 테스트 (3개)
- Context Manager 테스트 (2개)

### 8.2 수정 파일 (약 20개)

**Core Types**
- `packages/core/src/types/cafe.ts` (신규)
- `packages/core/src/types/role.ts` (신규)
- `packages/core/src/types/terminal.ts` (신규)
- `packages/core/src/types.ts` (기존 확장)

**Orchestrator**
- `packages/orchestrator/src/engine/executor.ts` (Terminal Pool 통합)
- `packages/core/src/barista.ts` (Role System 통합)

**Desktop**
- `packages/desktop/package.json` (React 의존성)
- `packages/desktop/src/main/index.ts` (IPC 핸들러 추가)
- `packages/desktop/src/preload/index.ts` (API 확장)

### 8.3 삭제 파일 (약 5개)

- `packages/schema/` (core로 병합)
- `packages/desktop/src/renderer/app.js` (React 재작성)

---

## 9. 기술 스택 요약

### 9.1 Core Dependencies

**Backend (Node.js)**
- TypeScript 5.3+
- node-pty: PTY 프로세스 실행
- Chokidar: 파일 변경 감지
- Handlebars: Role Template 렌더링
- Zod: Schema 검증
- SQLite (M3+): Cafe Registry

**Frontend (Electron Renderer)**
- React 18 + TypeScript
- Zustand: 전역 상태 관리
- shadcn/ui: UI 컴포넌트
- TailwindCSS: 스타일링
- xterm.js + xterm-addon-fit: Terminal 렌더링
- React Flow: Workflow Graph (또는 Mermaid)
- react-markdown: Context Board
- Lucide React: 아이콘

**Git Integration**
- `@codecafe/git-worktree` (기존)
- GitHub REST API (PR 생성)

### 9.2 Dev Dependencies

- ESLint + Prettier
- Vitest (테스트)
- Electron Builder (빌드/배포)

---

## 10. 수용 기준 (Acceptance Criteria)

### AC-1: Multi-Cafe Management
- [ ] Global Lobby에서 3개 이상의 Cafe를 등록할 수 있다.
- [ ] Cafe 카드에 Active Orders 개수가 실시간으로 업데이트된다.
- [ ] Cafe 진입 시 해당 Cafe의 `.orch` 설정이 로드된다.

### AC-2: Order Live View (CCTV)
- [ ] Order 실행 중 Terminal Grid에서 각 Barista의 실시간 출력을 볼 수 있다.
- [ ] Workflow Graph에서 현재 실행 중인 Node가 하이라이트된다.
- [ ] Context Board에서 `context.md` 파일 변경이 즉시 반영된다.

### AC-3: Role System
- [ ] Role Manager에서 기본 Role 4종을 조회할 수 있다.
- [ ] Order 생성 시 각 Stage에 Role을 매핑할 수 있다.
- [ ] 동일 Role을 N개 할당할 수 있다 (예: Coder 3명).

### AC-4: Embedded Terminal
- [ ] Settings > Providers에서 Claude 인증을 Desktop App 내에서 완료할 수 있다.
- [ ] 인증 성공 시 Provider 상태가 "Connected"로 변경된다.

### AC-5: Terminal Pool
- [ ] 4개 Terminal Pool에서 10개 Order를 순차+병렬 혼합 실행할 수 있다.
- [ ] Terminal Lease/Release가 정상적으로 동작한다 (동시성 안전).

### AC-6: Worktree 자동화
- [ ] Order 생성 시 Worktree가 자동으로 생성된다.
- [ ] Order 완료 시 `workspace.clean=true`이면 Worktree가 삭제된다.
- [ ] 미커밋 변경사항이 있을 때 경고가 표시된다.

---

## 11. 다음 단계 (Next Steps)

### 11.1 즉시 (Immediate)

1. **사용자 확인**
   - [ ] 본 요구사항 문서 리뷰
   - [ ] 미해결 질문 (Q-1 ~ Q-6) 답변
   - [ ] 우선순위 조정 (필요시)

2. **기술 검증 (PoC)**
   - [ ] xterm.js + node-pty 통합 테스트
   - [ ] React Flow Workflow Graph 프로토타입
   - [ ] Terminal Pool 동시성 제어 검증

### 11.2 단기 (1-2주)

3. **Phase 1 시작**
   - [ ] React + TypeScript 마이그레이션 계획 작성
   - [ ] shadcn/ui 컴포넌트 선정
   - [ ] Global Lobby UI 목업

4. **아키텍처 설계**
   - [ ] Terminal Pool 상세 설계
   - [ ] Role Registry API 스펙
   - [ ] Context Manager 인터페이스 정의

### 11.3 중기 (1개월)

5. **Phase 1 완료**
   - [ ] Global Lobby 구현
   - [ ] Cafe Registry JSON 저장소
   - [ ] Cafe Dashboard 기본 기능

6. **Phase 2 시작**
   - [ ] Terminal Pool 구현
   - [ ] Role Registry 구현

---

## 12. 참고 문서 (References)

- `docs/PRD_v2.md`: Desktop-First 비전
- `docs/PRD.md`: M1-M2 현재 상태
- `docs/STRUCTURE_PROPOSAL.md`: 패키지 구조 개선안
- `docs/UI_IMPROVEMENT_PLAN.md`: UI 컴포넌트 아키텍처
- `.claude/docs/agreements/m2-features-agreement.md`: M2 기능 합의
- `.claude/docs/tasks/m2-final-summary.md`: M2 완료 요약

---

## 부록 A: 용어 정리

| 용어 | 정의 | 예시 |
|------|------|------|
| **Cafe** | 관리되는 로컬 Git Repository | `my-project` |
| **Order** | 단일 작업 요청 (Workflow 인스턴스) | Order #123 |
| **Recipe** | Workflow 템플릿 (YAML) | `feature-dev.yaml` |
| **Role** | Agent 역할 템플릿 | Planner, Coder |
| **Barista** | 논리적 Agent (Worker) | Coder-1, Tester-2 |
| **Terminal** | 물리적 프로세스 (Provider Session) | Claude Process #1 |
| **Provider** | AI CLI 공급자 | claude-code, codex |
| **Context** | Shared Memory Board | `.codecafe/run/context.md` |
| **CCTV** | Order Live View (실시간 관측) | Terminal Grid + Graph |

---

## 부록 B: 데이터 모델 스키마

### Cafe
```typescript
interface Cafe {
  id: string;               // UUID
  name: string;             // Repo name
  path: string;             // Absolute path
  currentBranch: string;
  isDirty: boolean;
  activeOrders: number;
  createdAt: Date;
  settings: {
    baseBranch: string;     // Default: 'main'
    worktreeRoot: string;   // Default: '../.codecafe-worktrees'
  };
}
```

### Terminal
```typescript
interface Terminal {
  id: string;
  provider: string;         // 'claude-code' | 'codex'
  process: ChildProcess;    // node-pty instance
  status: 'idle' | 'busy';
  currentBarista?: string;
  createdAt: Date;
}
```

### Role
```typescript
interface Role {
  id: string;               // 'planner' | 'coder' | ...
  name: string;
  systemPrompt: string;     // Handlebars template
  skills: string[];         // Tool names
  recommendedProvider: string;
  isDefault: boolean;       // 기본 제공 Role 여부
}
```

### Context
```typescript
interface Context {
  orderId: string;
  path: string;             // .codecafe/run/context.md
  content: string;          // Markdown
  lastModified: Date;
}
```

---

**문서 버전**: v1.0
**작성자**: Requirements Analyzer
**검토 필요**: 사용자 확인 (미해결 질문 답변)
