# Desktop-First CodeCafe Manager Implementation Plan

> Project rules: `.claude/PROJECT.md`

## Metadata

- Author: Context Builder Agent
- Created: 2026-01-12
- **Last Reviewed**: 2026-01-12 (Plan Reviewer - REJECT → Improvements Applied)
- Complexity: complex
- Related docs:
  - Requirements: `.claude/docs/requirements.md`
  - Vision: `docs/PRD_v2.md`
  - Current State: `docs/PRD.md`
  - Structure: `docs/STRUCTURE_PROPOSAL.md`
  - UI Plan: `docs/UI_IMPROVEMENT_PLAN.md`

## Plan Review Improvements Applied

Following Plan Reviewer feedback (REJECT), these improvements were made:

1. ✅ **Phase 1 Migration Approach**: Incremental migration strategy defined with concrete entry points, IPC preservation, and screen-by-screen sequence.
2. ✅ **Cafe Registry Specification**: Complete JSON schema, IPC endpoints, migration/validation strategy, and acceptance tests defined.
3. ✅ **TerminalPool Behavior**: Full API spec, concurrency primitive (Semaphore), crash recovery, and load test criteria specified.
4. ✅ **Role Markdown Spec**: LOCKED frontmatter schema, persistence/override rules, editor save semantics, and validation/testing defined.
5. ✅ **Risk Mitigations Actionable**: PoC success metrics for xterm.js (throughput, latency, CPU), native module build steps for node-pty with CI/CD automation.

**Status**: Ready for re-validation.

---

## 1. Implementation Overview

### 1.1 Executive Summary

**CodeCafe Manager Desktop-First**는 로컬 멀티-AI 오케스트레이션 플랫폼의 완전한 Desktop 전환을 구현합니다. 개발자는 Desktop App 내에서 여러 Git Repository(Cafe)를 관리하고, 다수의 AI 작업(Order)을 병렬로 실행하며, 실시간 CCTV처럼 AI 작업을 관찰할 수 있습니다.

**핵심 가치:**
1. **Desktop-First Experience**: 모든 워크플로우가 Desktop App에서 완결
2. **Multi-Cafe Management**: N개 프로젝트 동시 관리
3. **Isolation by Default**: git-worktree 기반 자동 격리
4. **Real-time Observation**: Terminal Grid + Workflow Graph + Context Board

### 1.2 비즈니스 근거

**Why This Implementation?**
- M1-M2는 단일 프로젝트 CLI 중심 → 실제 개발자는 여러 프로젝트를 동시 관리
- 외부 터미널 의존성 제거 → Desktop 내 완전한 자급자족 환경
- AI 작업 가시성 부족 → CCTV 개념으로 실시간 관측 가능

**Technical Rationale:**
- Provider 프로세스와 논리적 Agent 분리 → 리소스 효율성 향상
- Role System 도입 → Agent 재사용성과 확장성
- Shared Context → Multi-Agent 협업 강화

### 1.3 Success Criteria

**완료 조건:**
- [ ] Global Lobby에서 3개 이상의 Cafe를 등록하고 전환 가능
- [ ] Order Live View에서 Terminal Grid + Workflow Graph + Context Board 동시 렌더링
- [ ] Settings 내 Embedded Terminal로 Provider 인증 완료
- [ ] Terminal Pool에서 4개 Terminal로 10개 Order 병렬 실행
- [ ] Role Manager에서 기본 4종 Role 조회 및 Order에 할당
- [ ] Worktree 자동 생성/정리 기능 동작

---

## 2. Architecture Decisions

### 2.1 Package Structure Changes

**현재 문제점:**
- `@codecafe/core` vs `@codecafe/orchestrator` 역할 불명확
- `@codecafe/schema` 분리 필요성 의문
- Terminal Pool, Role System, Context Manager 없음

**개선된 구조:**

```
packages/
├── core/                  # [Types & Contracts]
│   ├── types/             # Cafe, Role, Terminal, Workflow 타입
│   ├── schema/            # Zod Schemas (schema 패키지 병합)
│   └── interfaces/        # IProvider, ITerminal, IRole
├── orchestrator/          # [Main Engine]
│   ├── engine/            # DAG Execution (기존)
│   ├── terminal/          # [NEW] Terminal Pool
│   ├── barista/           # [REFACTOR] Barista + Role Logic
│   ├── context/           # [NEW] Context Manager
│   └── state/             # State Persistence
├── providers/
│   ├── common/            # IProvider 인터페이스
│   ├── claude-code/
│   └── codex/
├── cli/                   # [CLI Interface]
├── desktop/               # [GUI Interface]
│   ├── main/              # Electron Main Process
│   ├── preload/
│   └── renderer/          # React 18 (Refactor from Vanilla JS)
├── git-worktree/          # [Utility]
└── roles/                 # [NEW] Default Role Templates
    ├── planner.md
    ├── coder.md
    ├── tester.md
    └── reviewer.md
```

**주요 변경사항:**
1. `@codecafe/schema` → `@codecafe/core/src/schema` 병합
2. `@codecafe/orchestrator/src/terminal/` 신규 (Terminal Pool)
3. `@codecafe/orchestrator/src/context/` 신규 (Context Manager)
4. `packages/roles/` 신규 패키지 (기본 Role 템플릿)
5. `packages/desktop/src/renderer/` React 전환

### 2.2 Key Design Patterns

#### Terminal Pool Pattern
```
현재 (M2):
  Barista → Provider (1:1 고정)

목표:
  Provider → Terminal Pool (1:N)
  Terminal ← Barista Lease (M:N)
```

**장점:**
- Terminal 재사용 → 프로세스 생성 오버헤드 감소
- 동적 리소스 할당 → 메모리 효율성
- Barista는 논리적 Worker로 순수화

#### Role System Pattern
```
Barista = Role (Template) + Terminal (Process)
Role = System Prompt + Skills + Recommended Provider
```

**장점:**
- Agent 역할 재사용 가능
- Stage별 동적 Agent 할당
- 사용자 정의 Role 지원

#### Shared Context Pattern
```
Order → .codecafe/run/context.md (Worktree별)
Barista → Read/Write/Append
UI → File Watch → Real-time Rendering
```

**장점:**
- 파일 기반 → 단순성
- Append-Only → 동시성 안전
- Markdown → 사람이 읽기 쉬움

### 2.3 Technology Stack

#### Backend (Node.js)
| Library | Purpose | Version |
|---------|---------|---------|
| TypeScript | Type Safety | 5.3+ |
| node-pty | PTY Process | latest |
| Chokidar | File Watch | latest |
| Handlebars | Template Engine | latest |
| Zod | Schema Validation | latest |

#### Frontend (Electron Renderer)
| Library | Purpose | Version |
|---------|---------|---------|
| React | UI Framework | 18 |
| Zustand | State Management | latest |
| shadcn/ui | Component Library | latest |
| TailwindCSS | Styling | latest |
| xterm.js | Terminal Rendering | latest |
| React Flow | Workflow Graph | latest (or Mermaid) |
| react-markdown | Markdown Rendering | latest |
| Lucide React | Icons | latest |

#### Build & Dev Tools
- pnpm (workspace)
- webpack (Electron build)
- ESLint + Prettier
- Vitest

---

## 3. Implementation Roadmap

### Phase 1: Desktop UI Foundation (4주)
**목표:** React 기반 재작성 + Multi-Cafe UI

**작업:**
1. React 18 + TypeScript 마이그레이션
   - **Migration Approach**: Incremental (점진적 전환)
     - Step 1: 새 렌더러 엔트리포인트 생성 (`packages/desktop/src/renderer/index.tsx`)
     - Step 2: 기존 IPC 호환 레이어 유지 (`window.api` preload 보존)
     - Step 3: 화면별 마이그레이션 (Global Lobby → Cafe Dashboard 순)
   - webpack 설정 업데이트 (React JSX, TypeScript, CSS Modules)
   - ESM 호환성 확보
   - **Renderer Entry Points**:
     - `packages/desktop/src/renderer/index.tsx`: React 루트
     - `packages/desktop/src/renderer/App.tsx`: 라우팅 + 레이아웃
     - `packages/desktop/src/renderer/routes/`: 화면별 컴포넌트

2. shadcn/ui 컴포넌트 통합
   - Atomic Design 구조 수립
   - TailwindCSS 설정 (`packages/desktop/tailwind.config.js`)
   - shadcn/ui 초기 컴포넌트: Button, Card, Dialog, Input, Select

3. Global Lobby 구현
   - **Cafe Registry JSON Schema** (완전 명세):
     ```typescript
     // Location: %USERPROFILE%/.codecafe/cafes.json (Windows)
     //           ~/.codecafe/cafes.json (macOS/Linux)
     interface CafeRegistry {
       version: "1.0";
       cafes: Cafe[];
       lastAccessed?: string; // Cafe ID
     }
     interface Cafe {
       id: string;              // UUID v4
       name: string;            // Repo name
       path: string;            // Absolute path
       currentBranch: string;
       isDirty: boolean;
       activeOrders: number;
       createdAt: string;       // ISO 8601
       settings: {
         baseBranch: string;    // Default: 'main'
         worktreeRoot: string;  // Default: '../.codecafe-worktrees'
       };
     }
     ```
   - **IPC Endpoints** (완전 명세):
     ```typescript
     // Main Process (packages/desktop/src/main/ipc/cafe.ts)
     ipcMain.handle('cafe:list', async () => Promise<Cafe[]>);
     ipcMain.handle('cafe:get', async (event, id: string) => Promise<Cafe>);
     ipcMain.handle('cafe:create', async (event, path: string) => Promise<Cafe>);
     ipcMain.handle('cafe:delete', async (event, id: string) => Promise<void>);
     ipcMain.handle('cafe:update', async (event, id: string, partial: Partial<Cafe>) => Promise<Cafe>);

     // Preload API Surface (packages/desktop/src/preload/index.ts)
     window.api = {
       cafe: {
         list: () => ipcRenderer.invoke('cafe:list'),
         get: (id) => ipcRenderer.invoke('cafe:get', id),
         create: (path) => ipcRenderer.invoke('cafe:create', path),
         delete: (id) => ipcRenderer.invoke('cafe:delete', id),
         update: (id, partial) => ipcRenderer.invoke('cafe:update', id, partial),
       }
     };
     ```
   - **Migration/Validation Strategy**:
     - 초기 로드 시 JSON 스키마 검증 (Zod)
     - 버전 불일치 시 자동 마이그레이션 (`migrate_v0_to_v1()`)
     - 손상된 JSON → 백업 생성 후 초기화
   - Cafe Card Grid Layout
   - Cafe 등록/삭제/진입

4. Cafe Dashboard 기본 구현
   - **Order List Data Source**: Mock fixtures (Phase 2까지 실제 Order 엔진 없음)
     - `packages/desktop/src/renderer/__fixtures__/orders.json`
     - Status: 'pending' | 'running' | 'completed' | 'failed'
   - Order List (Kanban/List View)
   - New Order Button (Phase 2에서 연결)

**산출물:**
- `packages/desktop/src/renderer/index.tsx` (새 엔트리포인트)
- `packages/desktop/src/renderer/App.tsx` (라우팅)
- `packages/desktop/src/main/ipc/cafe.ts` (IPC 핸들러)
- `packages/desktop/src/preload/index.ts` (API Surface)
- `@codecafe/core/src/types/cafe.ts` (타입 정의)
- `@codecafe/core/src/schema/cafe.ts` (Zod 스키마)
- `.codecafe/cafes.json` (사용자 데이터)
- `packages/desktop/src/renderer/components/` (30개 컴포넌트)
- `packages/desktop/src/renderer/__fixtures__/orders.json` (Mock 데이터)

**리스크:**
- React 마이그레이션 중 Electron IPC 호환성 → **완화**: 기존 preload API 보존
- Cafe Context Switching 성능 → **완화**: Lazy Loading + In-Memory Cache

**완료 기준 (측정 가능):**
- [ ] `cafe:create` IPC로 Cafe 3개 등록 후 `.codecafe/cafes.json` 검증
- [ ] Global Lobby에서 Cafe Card 3개 렌더링 (name, path, activeOrders 표시)
- [ ] Cafe 클릭 → Dashboard 전환 시 URL `/cafe/:id` 변경 확인
- [ ] Cafe Dashboard에서 Mock Order 5개 렌더링 (Kanban 또는 List View)
- [ ] Zustand `useCafeStore`에 현재 Cafe ID 저장 확인

---

### Phase 2: Terminal Pool & Role System (3주)
**목표:** 아키텍처 개선 + Role 기반 Agent 관리

> **상세 구현 계획**: `.claude/docs/tasks/phase-2-implementation-plan.md` (10-day step-by-step guide)

**사용자 결정 사항:**
- **Terminal Pool Size**: 8개 (기본값, 사용자 확정)
- **Role Templates**: 4종 (planner, coder, tester, reviewer)

**작업:**
1. Terminal Pool 구현
   - **TerminalPool API 완전 명세**:
     ```typescript
     // packages/orchestrator/src/terminal/terminal-pool.ts
     class TerminalPool {
       constructor(config: TerminalPoolConfig);

       // Lifecycle
       async spawn(provider: string): Promise<Terminal>;
       async lease(provider: string): Promise<Terminal>;
       async release(terminal: Terminal): Promise<void>;
       async cleanup(terminal: Terminal): Promise<void>;
       async shutdown(): Promise<void>;

       // State
       getStatus(): PoolStatus;
       getTerminal(id: string): Terminal | undefined;
     }

     interface TerminalPoolConfig {
       perProvider: {
         [provider: string]: {
           size: number;        // Default: 8 (사용자 결정)
           timeout: number;     // Lease timeout (ms)
           maxRetries: number;  // Spawn retry count
         };
       };
     }

     interface Terminal {
       id: string;
       provider: string;
       process: IPty;           // node-pty instance
       status: 'idle' | 'busy' | 'crashed';
       currentBarista?: string;
       createdAt: Date;
       lastUsed: Date;
     }
     ```
   - **Concurrency Primitive**: Semaphore (p-limit 라이브러리)
     - Provider별 독립 Semaphore
     - `lease()`: Semaphore acquire → 첫 idle Terminal 할당
     - `release()`: Terminal idle 전환 → Semaphore release
   - **Crash Recovery**:
     - Terminal exit code !== 0 → `status = 'crashed'`
     - 자동 재시작 (maxRetries 이내)
     - Barista에게 `TerminalCrashedError` throw
   - **Load Test Criteria**:
     - 10개 Order 동시 실행 (8 Terminal Pool)
     - Lease wait time < 1초 (99 percentile)
     - No deadlock, no leaked processes

2. Role Registry 구현
   - **Role Markdown Spec (LOCKED)**:
     ```markdown
     ---
     id: planner
     name: Planner
     recommended_provider: claude-code
     skills:
       - read_file
       - search_code
       - create_plan
     variables:
       - name: project_context
         type: string
         required: true
       - name: issue_description
         type: string
         required: true
     ---

     # Planner Role

     You are a planning specialist...

     ## System Prompt Template

     Your task is to analyze {{project_context}} and create a plan for {{issue_description}}.
     ```
   - **Frontmatter Schema** (Zod):
     ```typescript
     const RoleFrontmatterSchema = z.object({
       id: z.string(),
       name: z.string(),
       recommended_provider: z.string(),
       skills: z.array(z.string()),
       variables: z.array(z.object({
         name: z.string(),
         type: z.enum(['string', 'number', 'boolean']),
         required: z.boolean().default(false),
       })).optional(),
     });
     ```
   - **Persistence/Override Rules**:
     - 기본 Role: `packages/roles/*.md` (read-only, Git-tracked)
     - 사용자 정의 Role: `~/.codecafe/roles/*.md` (read-write)
     - 우선순위: 사용자 정의 > 기본
     - 충돌 시: 사용자 정의가 기본을 override
   - **Editor Save Semantics**:
     - 저장 시 Frontmatter + Body 검증 (Zod + Handlebars 파싱)
     - 검증 실패 → 저장 중단 + 에러 메시지 표시
   - **Validation/Testing**:
     - Unit Test: `RoleRegistry.load()` 시 손상된 Markdown 처리
     - E2E Test: Role Editor에서 저장 → Registry 재로드 → Order 생성 시 사용

3. Barista 리팩토링
   - Role + Terminal Lease 통합
   - `execute()` 로직 업데이트:
     ```typescript
     async execute(order: Order, step: Step): Promise<StepResult> {
       const terminal = await this.pool.lease(this.role.recommended_provider);
       try {
         const prompt = this.renderPrompt(step.variables);
         const output = await this.sendToTerminal(terminal, prompt);
         return { status: 'success', output };
       } finally {
         await this.pool.release(terminal);
       }
     }
     ```

4. Order Creation Kiosk
   - Role Mapping UI
   - Stage별 Role 할당 폼:
     - Dropdown: 사용 가능 Role 목록
     - Number Input: Barista 개수 (1-10)
     - Variables Input: Role에서 정의한 변수 입력

5. Role Manager UI
   - Role List: 기본 4종 + 사용자 정의
   - Role Editor (Basic):
     - Frontmatter 폼 (id, name, provider, skills)
     - Body 텍스트 에디터 (Handlebars syntax highlighting)
     - 저장 시 검증

**산출물:**
- `packages/orchestrator/src/terminal/terminal-pool.ts` (TerminalPool 클래스)
- `packages/orchestrator/src/terminal/terminal-pool.test.ts` (동시성 테스트)
- `packages/orchestrator/src/role/role-registry.ts` (RoleRegistry 클래스)
- `packages/orchestrator/src/role/role-schema.ts` (Zod 스키마)
- `packages/roles/planner.md` (기본 Role)
- `packages/roles/coder.md` (기본 Role)
- `packages/roles/tester.md` (기본 Role)
- `packages/roles/reviewer.md` (기본 Role)
- `packages/orchestrator/src/barista/barista.ts` (리팩토링)
- `packages/desktop/src/renderer/components/RoleManager/` (UI)

**리스크:**
- Terminal Pool 동시성 Race Condition → **완화**: Semaphore + Unit Test
- Role Template 파싱 오류 처리 → **완화**: Zod 검증 + 사용자 친화적 에러 메시지

**완료 기준 (측정 가능):**
- [ ] `TerminalPool.lease()` 부하 테스트 통과 (10 Order, 8 Terminal, 99%ile < 1s)
- [ ] `packages/roles/*.md` 4개 파일 존재, Frontmatter 검증 통과
- [ ] Role Manager UI에서 기본 4종 + 사용자 정의 Role 표시
- [ ] Order Creation Kiosk에서 Stage별 Role 선택 → Order 생성 성공
- [ ] Barista가 Terminal Pool에서 lease → execute → release 수행 (로그 검증)

**구현 순서** (상세: `.claude/docs/tasks/phase-2-implementation-plan.md`):
1. Step 1: Core Types & Interfaces (Day 1)
2. Step 2: Terminal Pool Implementation (Day 2-3)
3. Step 3: Role Registry Implementation (Day 4-5)
4. Step 4: Barista Refactoring (Day 6-7)
5. Step 5: UI Components (Day 8-10)

---

### Phase 3: Order Live View (CCTV) (4주)
**목표:** 실시간 관측 기능 (Terminal Grid + Graph + Context)

**작업:**
1. xterm.js 통합
   - node-pty onData → IPC → xterm.js
   - Terminal Grid Layout (2x2 or Dynamic)
   - 백프레셔 처리
2. Workflow Graph
   - React Flow 또는 Mermaid
   - DAG 렌더링
   - 현재 실행 Node 하이라이트
3. Context Manager 구현
   - `ContextManager` 클래스
   - `create()`, `append()`, `watch()` API
   - Chokidar 파일 감지
4. Context Board UI
   - react-markdown 렌더링
   - Auto-scroll to bottom
   - File Watch 연동
5. Order Live View Layout
   - Split Pane (Resizable)
   - Graph + Terminal Grid + Context Board

**산출물:**
- `packages/desktop/src/renderer/components/OrderLiveView/`
  - `TerminalGrid.tsx`
  - `WorkflowGraph.tsx`
  - `ContextBoard.tsx`
- `packages/orchestrator/src/context/context-manager.ts`
- xterm.js + node-pty 통합 IPC 핸들러

**리스크:**
- PTY Mirroring 복잡도 (HIGH)
- 백프레셔 처리 실패 시 렌더링 지연

**완료 기준:**
- [ ] Order 실행 중 Terminal Grid에서 실시간 출력 확인
- [ ] Workflow Graph에서 현재 Node 하이라이트
- [ ] Context Board에서 context.md 변경 즉시 반영

---

### Phase 4: Settings & Embedded Terminal (2주)
**목표:** In-App Provider 인증

**작업:**
1. Settings UI 구현
   - Providers 탭
   - Provider Card (Name, Status, Version)
2. Embedded Terminal
   - xterm.js + node-pty Modal
   - `claude login` 자동 실행
   - Exit Code 감지
3. Provider Connect Workflow
   - Connect Button
   - 브라우저 인증 완료 대기
   - "Connected" 상태 업데이트
4. Provider List API
   - 설치된 Provider 조회
   - 버전 정보 표시

**산출물:**
- `packages/desktop/src/renderer/components/Settings/Providers.tsx`
- `packages/desktop/src/main/ipc/provider-auth.ts`
- Embedded Terminal Component

**리스크:**
- Provider별 인증 흐름 차이
- node-pty 권한 문제 (Windows)

**완료 기준:**
- [ ] Settings에서 Claude Connect → 인증 완료
- [ ] 인증 성공 시 "Connected" 상태 표시
- [ ] Desktop App 내에서 외부 터미널 없이 인증 완료

---

### Phase 5: Worktree Automation + Polish (2주)
**목표:** Worktree 자동화 + PR Workflow

**작업:**
1. Order Pre-Hook
   - Worktree 자동 생성
   - Context 파일 복사
2. Order Post-Hook
   - `workspace.clean=true` 시 자동 정리
   - 미커밋 변경사항 경고
3. Worktree Dashboard
   - Worktree 목록
   - "Open Folder", "Export Patch", "Clean" 버튼
4. PR 생성 지원 (선택적)
   - GitHub API 연동 (기본)
   - PR 생성 UI

**산출물:**
- `packages/orchestrator/src/hooks/` (Pre/Post Hooks)
- `packages/git-worktree/src/pr-helper.ts` (GitHub API)
- Worktree Dashboard UI

**리스크:**
- Git 명령어 크로스플랫폼 호환성
- Worktree 정리 시 데이터 손실 위험

**완료 기준:**
- [ ] Order 생성 시 Worktree 자동 생성
- [ ] Order 완료 시 `clean=true` 옵션으로 정리
- [ ] 미커밋 변경사항 있을 시 경고 표시

---

## 4. Development Guidelines

### 4.1 Coding Standards

**TypeScript:**
- ESM 모듈 (`"type": "module"`)
- Strict Type Checking
- 명시적 타입 정의 (any 금지)

**Naming Conventions:**
- camelCase: 함수/변수
- PascalCase: 클래스/타입/React 컴포넌트
- kebab-case: 파일명

**React Components:**
- Functional Components Only
- Hooks 사용
- Props 타입 명시 (interface)

**Error Handling:**
- 명시적 Error 타입 (`ExecutionError`, `ProviderError`)
- try-catch로 감싸기
- 에러 로그 기록 (`LogManager`)

### 4.2 Testing Approach

**Unit Tests:**
- Vitest 사용
- 각 클래스별 테스트 (Terminal Pool, Role Registry, Context Manager)
- Mocking: Provider 프로세스, File System

**Integration Tests:**
- Order 생성 → 실행 → 완료 E2E
- Terminal Pool Lease/Release 동시성 시나리오

**UI Tests:**
- React Testing Library (선택적)
- Storybook (컴포넌트 카탈로그)

### 4.3 Integration Points

**IPC (Main ↔ Renderer):**
```typescript
// Main Process
ipcMain.handle('cafe:list', async () => cafeRegistry.list());
ipcMain.handle('order:create', async (event, params) => ...);
ipcMain.handle('terminal:subscribe', async (event, orderId) => ...);

// Renderer Process
const cafes = await window.api.cafe.list();
const order = await window.api.order.create(params);
```

**File System:**
- Cafe Registry: `.codecafe/cafes.json`
- Order State: `.orch/orders/{orderId}/state.json`
- Context: `.codecafe/run/context.md`

**PTY Stream:**
```
Main (node-pty) → onData → IPC → Renderer (xterm.js)
```

### 4.4 State Management

**Zustand Stores:**
- `useCafeStore`: Cafe 목록, 현재 Cafe
- `useOrderStore`: Order 목록, 필터링
- `useTerminalStore`: Terminal Pool 상태
- `useRoleStore`: Role Registry

**Persistence:**
- Zustand Persist Middleware (로컬 스토리지)
- JSON 파일 동기화

---

## 5. Open Items

### 5.1 Unresolved Questions (HIGH Priority)

#### Q-1: Cafe Registry 저장소 형식
**질문:** SQLite vs JSON?

**제안:** M1-M3은 JSON (`.codecafe/cafes.json`), M4+ SQLite 마이그레이션

**근거:**
- JSON: 단순, 디버깅 쉬움, Git 버전 관리 가능
- SQLite: 성능, 쿼리 편의성 (Cafe 개수 > 50개 시 고려)

**결정 필요 시점:** Phase 1 시작 전

---

#### Q-2: Terminal Pool 크기 기본값
**질문:** Provider별 Terminal 기본 개수?

**✅ 결정:** 8개 (사용자 확정, 2026-01-12)

**근거:**
- 사용자 요구사항 반영
- 10개 Order 병렬 실행 지원

**설정 가능:** Settings > Providers > Pool Size

---

#### Q-3: Order Live View 기본 레이아웃
**질문:** Graph:Terminal:Context 비율?

**옵션:**
- A) 1:2:1 (Terminal 중심)
- B) 1:1:1 (동일)
- C) Resizable Split Pane

**제안:** C) React Split Pane 사용

**근거:**
- 사용자 선호도 다양
- 레이아웃 저장 (Zustand Persist)

**결정 필요 시점:** Phase 3 시작 전

---

### 5.2 Assumptions Made

**가정 1:** Cafe 개수는 10개 이하
- JSON 기반 Registry로 충분

**가정 2:** Terminal Pool 크기는 고정 (런타임 변경 불가)
- 동적 크기 조정은 M4+ 고려

**가정 3:** Role은 Markdown Frontmatter 형식
- YAML Frontmatter + Markdown Body

**가정 4:** Context 파일은 5MB 이하
- Markdown 렌더링 성능 고려

**가정 5:** 하나의 Order는 최대 10개 Barista
- UI 렌더링 한계

---

### 5.3 Decisions Needed Before Phase X

**Phase 1 시작 전:**
- [x] Cafe Registry 형식 결정 → JSON
- [ ] React 마이그레이션 우선순위 (점진적 vs 일괄)

**Phase 2 시작 전:**
- [ ] Terminal Pool 크기 기본값 확정
- [ ] Role Markdown 스펙 확정

**Phase 3 시작 전:**
- [ ] xterm.js 라이센스 검토
- [ ] Workflow Graph 라이브러리 선택 (React Flow vs Mermaid)

**Phase 4 시작 전:**
- [ ] Provider 인증 흐름 표준화
- [ ] Embedded Terminal 권한 이슈 해결 방안

**Phase 5 시작 전:**
- [ ] PR 생성 범위 (GitHub only vs 확장)
- [ ] Worktree 정리 정책 기본값

---

## 6. Risk Mitigation

### R-1: xterm.js PTY Mirroring 복잡도 (HIGH)
**리스크:** 실시간 PTY 출력을 여러 xterm.js 인스턴스에 미러링

**완화 전략:**
- **Proof of Concept (PoC) 선행 구현** (Phase 3 전):
  - **성공 기준**:
    1. node-pty `onData` → IPC → xterm.js 렌더링 동작 (단일 Terminal)
    2. 100ms 간격으로 1KB 출력 → xterm.js 지연 < 50ms (평균)
    3. 백프레셔 처리: 버퍼 크기 10MB, 초과 시 throttle
    4. 4개 Terminal 동시 렌더링 → CPU < 20% (M1 Mac 기준)
  - **구현 방법**:
    - `packages/desktop/src/main/ipc/terminal-stream.ts`:
      ```typescript
      ipcMain.handle('terminal:subscribe', (event, terminalId) => {
        const terminal = pool.getTerminal(terminalId);
        terminal.process.onData((data) => {
          if (buffer.size < MAX_BUFFER_SIZE) {
            event.sender.send(`terminal:data:${terminalId}`, data);
          } else {
            throttle(() => flushBuffer(terminalId), 100);
          }
        });
      });
      ```
- 단일 Terminal 테스트 → 4개 확장 → 16개 스트레스 테스트

**대안:**
- 로그 파일 기반 Tail (실시간성 ↓, 안정성 ↑) - PoC 실패 시 적용

---

### R-2: Multi-Cafe Context Switching 성능 (HIGH)
**리스크:** Cafe 전환 시 `.orch` 로드 느림

**완화 전략:**
- Lazy Loading: 진입 시점에만 로드
- In-Memory Cache: 최근 3개 Cafe
- Background Sync: 백그라운드에서 상태 업데이트

**대안:**
- Cafe 전환 시 "Loading..." 스피너 표시

---

### R-3: Terminal Pool 동시성 제어 (MEDIUM)
**리스크:** Lease/Release Race Condition

**완화 전략:**
- Mutex 또는 Semaphore
- 원자적 상태 전이 (idle → busy → idle)
- 단위 테스트 철저히

**대안:**
- Pessimistic Locking (Queue 기반)

---

### R-4: Shared Context 파일 충돌 (MEDIUM)
**리스크:** 동시 쓰기 → 덮어쓰기

**완화 전략:**
- Append-Only (`fs.appendFile`)
- Timestamp 기반 섹션 구분

**대안:**
- File Locking (복잡도 ↑, 회피)

---

### R-5: React 마이그레이션 호환성 (MEDIUM)
**리스크:** Vanilla JS → React 전환 중 IPC 깨짐

**완화 전략:**
- 점진적 마이그레이션 (화면별)
- IPC 인터페이스 변경 최소화
- E2E 테스트

---

### R-6: node-pty Native Module Build (HIGH)
**리스크:** Electron에서 node-pty 빌드 실패 (OS별 차이)

**완화 전략:**
- **Native Module Build Steps** (명시):
  ```bash
  # Phase 1 시작 전 검증
  npm install --global node-gyp
  pnpm install
  pnpm rebuild node-pty --runtime=electron --target=<electron-version> --disturl=https://electronjs.org/headers

  # CI/CD 자동화 (Windows/macOS/Linux)
  - Windows: Visual Studio Build Tools 2019+
  - macOS: Xcode Command Line Tools
  - Linux: build-essential, python3
  ```
- **Electron Builder 설정**:
  ```json
  {
    "extraFiles": [
      {
        "from": "node_modules/node-pty/build/Release",
        "to": "node_modules/node-pty/build/Release"
      }
    ],
    "rebuild": {
      "force": true,
      "modules": ["node-pty"]
    }
  }
  ```
- **검증**:
  - Phase 2 시작 전: 3개 OS에서 Electron 앱 실행 + Terminal spawn 성공
  - 빌드 실패 시: electron-rebuild 재실행 + 로그 수집

**대안:**
- Prebuilt binaries (electron-builder-binaries) 사용 - 메인터넌스 리스크 있음

---

## 7. Dependencies

### External Dependencies
- **Git**: 모든 시스템에 설치 필요
- **Provider CLI**: claude-code, codex 사전 설치
- **Node.js**: >= 18 (ESM 지원)
- **pnpm**: >= 8 (workspace)

### API Spec
- **Cafe Registry API**: Phase 1에서 확정
- **Terminal Pool API**: Phase 2에서 확정
- **Context Manager API**: Phase 3에서 확정

### Menu/Permissions
- **File System Access**: Cafe 폴더 읽기/쓰기
- **Process Spawn**: node-pty 권한
- **Network (선택적)**: GitHub API (PR 생성)

---

## 8. Checkpoints

### Phase 1: Desktop UI Foundation
- [ ] React 18 마이그레이션 완료
- [ ] Global Lobby 동작
- [ ] Cafe Registry JSON 저장소 구현
- [ ] Cafe Dashboard 기본 화면

### Phase 2: Terminal Pool & Role System
- [ ] Terminal Pool 구현 및 테스트
- [ ] Role Registry 구현
- [ ] 기본 Role 4종 작성
- [ ] Barista 리팩토링 완료

### Phase 3: Order Live View (CCTV)
- [ ] xterm.js 통합 완료
- [ ] Workflow Graph 렌더링
- [ ] Context Manager 구현
- [ ] Context Board 실시간 렌더링

### Phase 4: Settings & Embedded Terminal
- [ ] Settings UI 구현
- [ ] Embedded Terminal 동작
- [ ] Provider Connect Workflow 완료

### Phase 5: Worktree Automation
- [ ] Order Pre/Post Hooks 구현
- [ ] Worktree 자동 생성/정리
- [ ] PR 생성 지원 (선택적)

---

## 9. Open Questions Summary

### Technical Questions
1. Cafe Registry: JSON vs SQLite? → **JSON (Phase 1-3)**
2. Terminal Pool Size: 4 vs 8? → **4 (기본값)**
3. Workflow Graph: React Flow vs Mermaid? → **Phase 3 시작 전 결정**
4. Context Board: react-markdown vs marked? → **react-markdown**
5. Role Skills: 문자열 배열 vs JSON Schema? → **문자열 배열 (단순)**

### UX Questions
1. Order Live View Layout 비율? → **Resizable Split Pane**
2. Worktree baseBranch 기본값? → **main (`.orch` 설정 가능)**
3. Terminal Grid 최대 개수? → **16개 (4x4)**
4. Context Board 자동 스크롤? → **Yes (to bottom)**
5. Role Mapping UI 방식? → **Dropdown + Count Input**

### Process Questions
1. Phase 1-2 동시 진행 가능? → **No (순차 권장)**
2. xterm.js PoC 선행 필요? → **Yes (Phase 3 전)**
3. M2 완료 상태 확인 필요? → **Yes (Phase 1 전)**
4. 문서 동기화 주기? → **각 Phase 완료 시점**
5. 검증 자동화 범위? → **typecheck + build (lint 선택적)**

---

## 10. Verification Plan

### Phase별 검증 항목

**Phase 1:**
```bash
pnpm typecheck
pnpm build
# 수동 테스트:
# - Cafe 3개 등록
# - Cafe 전환 시 .orch 로드 확인
```

**Phase 2:**
```bash
pnpm typecheck
pnpm build
pnpm test packages/orchestrator
# 수동 테스트:
# - Terminal Pool 동시성 (10개 Order)
# - Role Manager에서 Role 조회
```

**Phase 3:**
```bash
pnpm typecheck
pnpm build
# 수동 테스트:
# - Order Live View 3-Pane 렌더링
# - Terminal Grid 실시간 출력
# - Context Board 파일 변경 감지
```

**Phase 4:**
```bash
pnpm typecheck
pnpm build
# 수동 테스트:
# - Settings > Providers > Connect Claude
# - 인증 완료 후 상태 업데이트
```

**Phase 5:**
```bash
pnpm typecheck
pnpm build
# 수동 테스트:
# - Worktree 자동 생성
# - clean=true 시 자동 정리
```

---

## 11. Next Steps

### Immediate (즉시)
1. **사용자 확인**
   - [ ] 본 context.md 리뷰
   - [ ] Open Questions 답변
   - [ ] Phase 우선순위 확인

2. **기술 검증 (PoC)**
   - [ ] xterm.js + node-pty 통합 테스트 (Phase 3 전)
   - [ ] React Flow 프로토타입 (Phase 3 전)
   - [ ] Terminal Pool 동시성 검증 (Phase 2 전)

### Short-term (1-2주)
3. **Phase 1 준비**
   - [ ] React 마이그레이션 계획 작성
   - [ ] shadcn/ui 컴포넌트 선정
   - [ ] Global Lobby UI 목업

4. **아키텍처 설계**
   - [ ] Terminal Pool 상세 설계 (Phase 2)
   - [ ] Role Registry API 스펙 (Phase 2)
   - [ ] Context Manager 인터페이스 (Phase 3)

### Mid-term (1개월)
5. **Phase 1 실행**
   - [ ] React 전환 구현
   - [ ] Global Lobby 구현
   - [ ] Cafe Registry JSON 저장소

6. **Phase 2 준비**
   - [ ] Terminal Pool 설계 검토
   - [ ] Role Markdown 스펙 확정

---

## 12. References

### Core Documents
- `.claude/docs/requirements.md`: Requirements Analysis
- `docs/PRD_v2.md`: Desktop-First Vision
- `docs/PRD.md`: M1-M2 Current State
- `docs/STRUCTURE_PROPOSAL.md`: Package Structure
- `docs/UI_IMPROVEMENT_PLAN.md`: UI Architecture

### Project Rules
- `.claude/PROJECT.md`: Project-specific rules
- `.claude/CLAUDE.md`: Global development guidelines
- `.claude/AGENT.md`: Agent canonical format

### Implementation Records
- `.claude/docs/tasks/m2-final-summary.md`: M2 완료 요약
- `.claude/docs/agreements/m2-features-agreement.md`: M2 기능 합의

---

## Appendix A: 용어 정리

| 용어 | 정의 | 영문 |
|------|------|------|
| **Cafe** | 관리되는 로컬 Git Repository | Cafe |
| **Order** | 단일 작업 요청 (Workflow 인스턴스) | Order |
| **Recipe** | Workflow 템플릿 (YAML) | Recipe |
| **Role** | Agent 역할 템플릿 | Role |
| **Barista** | 논리적 Agent (Worker) | Barista |
| **Terminal** | 물리적 프로세스 (Provider Session) | Terminal |
| **Provider** | AI CLI 공급자 | Provider (Beans) |
| **Context** | Shared Memory Board | Context |
| **CCTV** | Order Live View (실시간 관측) | CCTV |

---

## Appendix B: 핵심 데이터 모델

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
  isDefault: boolean;
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
**작성자**: Context Builder Agent
**검토 필요**: 사용자 확인 + Open Questions 답변
