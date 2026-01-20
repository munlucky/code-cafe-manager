# Cafe, Order, Recipe, Skill CRUD Flow

> **작성일**: 2026-01-20  
> **기준**: Desktop 패키지 IPC 핸들러

---

## 개요

```
┌─────────────────────────────────────────────────────────────────┐
│                        CodeCafe 엔티티 관계                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Cafe (프로젝트)                                               │
│     │                                                           │
│     └── Order (작업 단위)                                       │
│           │                                                     │
│           └── Recipe 선택 ──┬── Stage 1 ── Skill A, B          │
│                             ├── Stage 2 ── Skill C              │
│                             └── Stage 3 ── Skill D, E          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Cafe (프로젝트)

### 저장 위치
- **레지스트리**: `~/.codecafe/cafes.json`
- **데이터 구조**: `{ cafes: Cafe[], lastAccessedId?: string }`

### CRUD Flow

#### CREATE - Cafe 등록
```
┌─────────────┐      IPC: cafe:create       ┌─────────────────┐
│   UI        │ ─────────────────────────▶  │  CafeRegistry   │
│ GlobalLobby │                              │                 │
└─────────────┘                              └────────┬────────┘
                                                      │
    1. 프로젝트 경로 입력                              │
    2. "Add Cafe" 클릭                                │
                                                      ▼
                                              ┌───────────────┐
                                              │ cafes.json    │
                                              │ - id 생성     │
                                              │ - path 저장   │
                                              │ - branch 확인 │
                                              └───────────────┘
```

**IPC**: `cafe:create`
```typescript
// 파라미터
{ path: string }

// 내부 처리
1. Git Repository 유효성 검사
2. 중복 체크 (동일 경로)
3. repo name, current branch 추출
4. UUID 생성
5. cafes.json에 저장

// 반환
{ id, name, path, currentBranch, settings, ... }
```

#### READ - Cafe 조회
```
IPC: cafe:getAll     →  전체 Cafe 목록
IPC: cafe:get        →  단일 Cafe 조회
IPC: cafe:getLastAccessed  →  마지막 사용 Cafe
```

#### UPDATE - Cafe 수정
```
IPC: cafe:update

파라미터: { id, name?, settings? }
처리: cafes.json 업데이트
```

#### DELETE - Cafe 삭제
```
┌─────────────┐      IPC: cafe:delete       ┌─────────────────┐
│   UI        │ ─────────────────────────▶  │  CafeRegistry   │
│ GlobalLobby │                              │                 │
└─────────────┘                              └────────┬────────┘
                                                      │
    1. Cafe 선택                                      │
    2. "Delete" 클릭                                  │
    3. 확인 다이얼로그                                │
                                                      ▼
                                              ┌───────────────┐
                                              │ cafes.json    │
                                              │ - 항목 제거   │
                                              └───────────────┘
```

---

## 2. Order (작업 단위)

### 저장 위치
- **메모리**: Orchestrator 내 OrderManager
- **영속성**: `.orch/orders/` + worktree 경로

### CRUD Flow

#### CREATE - Order 생성
```
┌───────────────┐    IPC: order:createWithWorktree    ┌──────────────┐
│      UI       │ ─────────────────────────────────▶  │   order.ts   │
│ NewOrderDialog│                                      │              │
└───────────────┘                                      └──────┬───────┘
                                                              │
    1. Recipe 선택                                            │
    2. Worktree 옵션 선택                                     │
    3. "Create" 클릭                                          │
                                                              ▼
                                                ┌─────────────────────┐
                                                │    Orchestrator     │
                                                │  - Order 메타 생성  │
                                                └──────────┬──────────┘
                                                           │
                                                           ▼
                                                ┌─────────────────────┐
                                                │   WorktreeManager   │
                                                │  - 브랜치 생성      │
                                                │  - Worktree 생성    │
                                                └─────────────────────┘
```

**IPC**: `order:createWithWorktree`
```typescript
// 파라미터
{
  cafeId: string,
  workflowId: string,      // Recipe ID
  workflowName: string,
  createWorktree: boolean,
  worktreeOptions?: { baseBranch?, branchPrefix? }
}

// 내부 처리
1. Orchestrator.createOrder()
2. [선택] WorktreeManager.createWorktree()
3. Order에 worktreeInfo 연결

// 반환
{ order: Order, worktree?: { path, branch } }
```

#### READ - Order 조회
```
IPC: order:getAll    →  전체 Order 목록
IPC: order:get       →  단일 Order 조회
IPC: order:getLog    →  Order 실행 로그
```

#### UPDATE - Order 실행
```
┌───────────────┐    IPC: order:execute    ┌────────────────────┐
│      UI       │ ────────────────────────▶│     order.ts       │
│   OrderCard   │                           │                    │
└───────────────┘                           └─────────┬──────────┘
                                                      │
    1. Order 선택                                     │
    2. "Execute" 클릭                                 │
    3. Prompt 입력                                    │
                                                      ▼
                                            ┌──────────────────┐
                                            │   Orchestrator   │
                                            │ - Barista 할당   │
                                            │ - 이벤트 발생    │
                                            └────────┬─────────┘
                                                     │
                                                     ▼
                                            ┌──────────────────┐
                                            │ExecutionManager  │
                                            │ - 이벤트 수신    │
                                            └────────┬─────────┘
                                                     │
                                                     ▼
                                            ┌──────────────────┐
                                            │ BaristaEngineV2  │
                                            │ - Recipe 로드    │
                                            │ - Session 생성   │
                                            │ - Stage 실행     │
                                            └──────────────────┘
```

**실행 상태 업데이트**:
```
IPC: order:sendInput      →  사용자 입력 전송
IPC: order:retryFromStage →  특정 Stage부터 재시도
IPC: order:retryFromBeginning  →  처음부터 재시도
```

#### DELETE - Order 삭제
```
┌───────────────┐    IPC: order:delete    ┌──────────────────┐
│      UI       │ ───────────────────────▶│     order.ts     │
│   OrderCard   │                          │                  │
└───────────────┘                          └────────┬─────────┘
                                                    │
    1. Order 선택                                   │
    2. "Delete" 클릭                                │
    3. 확인 다이얼로그                              │
                                                    ▼
                                         ┌────────────────────┐
                                         │ 1. cancelOrder()   │
                                         │ 2. delay(500ms)    │
                                         │ 3. removeWorktree()│
                                         │ 4. deleteOrder()   │
                                         └────────────────────┘
```

**IPC**: `order:delete`, `order:deleteMany`
```typescript
// 내부 처리 (순서 중요!)
1. 실행 중이면 cancelOrder()
2. 500ms 대기 (Windows 프로세스 종료)
3. Worktree 삭제
4. Order 메타데이터 삭제
```

---

## 3. Recipe (Workflow)

### 저장 위치
- **디렉토리**: `.orch/workflows/`
- **파일 형식**: `{id}.workflow.yml`

### CRUD Flow

#### CREATE - Recipe 생성
```
┌───────────────┐    IPC: workflow:create    ┌──────────────────┐
│      UI       │ ──────────────────────────▶│   workflow.ts    │
│   Recipes탭   │                             │                  │
└───────────────┘                             └────────┬─────────┘
                                                       │
    1. "New Recipe" 클릭                               │
    2. 이름, 설명 입력                                 │
    3. Stages 추가                                     │
    4. 각 Stage에 Skills 할당                          │
    5. "Save" 클릭                                     │
                                                       ▼
                                              ┌────────────────┐
                                              │  YAML 파일 생성 │
                                              │  {id}.workflow │
                                              │  .yml          │
                                              └────────────────┘
```

**IPC**: `workflow:create`
```typescript
// 파라미터
{
  id: string,
  name: string,
  description?: string,
  stages: string[],
  stageConfigs?: Record<string, StageAssignment>
}

// StageAssignment
{
  provider: 'claude-code' | 'codex' | ...,
  role?: string,
  skills?: string[],   // Skill IDs
  mode?: 'sequential' | 'parallel',
  on_failure?: 'stop' | 'continue' | 'retry'
}
```

**생성되는 YAML 예시**:
```yaml
# moon.workflow.yml
workflow:
  stages:
    - analyze
    - plan
    - code
    - review

analyze:
  provider: claude-code
  role: analyzer
  skills:
    - classify-task
    - evaluate-complexity

plan:
  provider: claude-code
  role: planner
  skills:
    - decide-sequence

code:
  provider: claude-code
  role: coder
  skills:
    - implementation-runner

review:
  provider: codex
  role: reviewer
  skills:
    - codex-review-code
```

#### READ - Recipe 조회
```
IPC: workflow:list   →  전체 Recipe 목록
IPC: workflow:get    →  단일 Recipe 조회 (stages 포함)
```

#### UPDATE - Recipe 수정
```
IPC: workflow:update

파라미터: { id, name?, description?, stages?, stageConfigs? }
처리: YAML 파일 덮어쓰기
```

#### DELETE - Recipe 삭제
```
IPC: workflow:delete

처리: .orch/workflows/{id}.workflow.yml 삭제
```

---

## 4. Skill (개별 작업 단위)

### 저장 위치
- **Built-in**: `desktop/skills/*.json`
- **사용자 정의**: `.orch/skills/*.json`

### CRUD Flow

#### CREATE - Skill 생성
```
┌───────────────┐    IPC: skill:create    ┌──────────────────┐
│      UI       │ ───────────────────────▶│    skill.ts      │
│  Skills탭    │                           │                  │
└───────────────┘                          └────────┬─────────┘
                                                    │
    1. "New Skill" 클릭                             │
    2. 이름, 설명 입력                              │
    3. Category 선택                                │
    4. Instructions 작성                            │
    5. "Save" 클릭                                  │
                                                    ▼
                                           ┌────────────────┐
                                           │  JSON 파일 생성 │
                                           │  {id}.json     │
                                           └────────────────┘
```

**IPC**: `skill:create`
```typescript
// 파라미터
{
  id: string,
  name: string,
  description: string,
  category: 'planning' | 'implementation' | 'verification' | 'review',
  skillCommand: string,
  context?: 'fork' | 'inherit',
  instructions?: string   // 실제 실행될 프롬프트
}
```

**생성되는 JSON 예시**:
```json
{
  "id": "classify-task",
  "name": "Task Classification",
  "description": "사용자 요청을 작업 유형으로 분류",
  "category": "planning",
  "skillCommand": "/classify-task",
  "instructions": "Analyze the user request and classify...",
  "isBuiltIn": false,
  "createdAt": "2026-01-20T10:00:00Z"
}
```

#### READ - Skill 조회
```
IPC: skill:list   →  전체 Skill 목록 (Built-in + 사용자)
IPC: skill:get    →  단일 Skill 조회
```

#### UPDATE - Skill 수정
```
IPC: skill:update

파라미터: { id, name?, description?, category?, skillCommand?, instructions? }
처리: JSON 파일 덮어쓰기
주의: Built-in Skill은 수정 불가 (복제 후 수정)
```

#### DELETE - Skill 삭제
```
IPC: skill:delete

처리: .orch/skills/{id}.json 삭제
주의: Built-in Skill은 삭제 불가
```

#### 특수 기능
```
IPC: skill:duplicate  →  Skill 복제 (Built-in → 커스텀)
```

---

## 5. 전체 실행 Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         전체 실행 흐름                               │
└─────────────────────────────────────────────────────────────────────┘

[사용자]
   │
   ▼
┌──────────┐
│ 1. Cafe  │  프로젝트 등록 (Git Repository)
│   등록   │
└────┬─────┘
     │
     ▼
┌──────────┐
│ 2. Order │  Recipe 선택 + Worktree 생성
│   생성   │
└────┬─────┘
     │
     ▼
┌──────────┐
│ 3. Order │  Prompt 입력 + 실행 시작
│   실행   │
└────┬─────┘
     │
     ▼
┌──────────────────────────────────────────────────┐
│ 4. BaristaEngineV2                               │
│                                                  │
│    Recipe (YAML) 로드                            │
│         │                                        │
│         ▼                                        │
│    각 Stage의 Skills (JSON) 로드                 │
│         │                                        │
│         ▼                                        │
│    Stage Prompt 생성                             │
│    = Role Instructions + Skill Instructions     │
│      + User Prompt                              │
│         │                                        │
│         ▼                                        │
│    OrderSession 생성 및 실행                     │
│         │                                        │
│         ├── Stage 1 (analyze)                    │
│         │     └── claude-code 실행               │
│         │                                        │
│         ├── Stage 2 (plan)                       │
│         │     └── claude-code 실행               │
│         │                                        │
│         ├── Stage 3 (code)                       │
│         │     └── claude-code 실행               │
│         │                                        │
│         └── Stage 4 (review)                     │
│               └── codex 실행                     │
│                                                  │
└──────────────────────────────────────────────────┘
     │
     ▼
┌──────────┐
│ 5. 결과  │  Worktree에 코드 변경사항
│   확인   │  Git 브랜치로 리뷰
└──────────┘
```

---

## 6. IPC 핸들러 요약

### Cafe
| IPC | 기능 | 파라미터 |
|-----|------|----------|
| `cafe:create` | 생성 | `{ path }` |
| `cafe:getAll` | 전체 조회 | - |
| `cafe:get` | 단일 조회 | `id` |
| `cafe:update` | 수정 | `{ id, name?, settings? }` |
| `cafe:delete` | 삭제 | `id` |
| `cafe:setLastAccessed` | 마지막 접근 설정 | `id` |

### Order
| IPC | 기능 | 파라미터 |
|-----|------|----------|
| `order:createWithWorktree` | 생성 | `{ cafeId, workflowId, ... }` |
| `order:getAll` | 전체 조회 | - |
| `order:get` | 단일 조회 | `id` |
| `order:execute` | 실행 | `{ orderId, prompt, vars? }` |
| `order:sendInput` | 입력 전송 | `{ orderId, message }` |
| `order:cancel` | 취소 | `id` |
| `order:delete` | 삭제 | `id` |
| `order:deleteMany` | 일괄 삭제 | `ids[]` |
| `order:retryFromStage` | Stage 재시도 | `{ orderId, fromStageId? }` |
| `order:retryFromBeginning` | 처음부터 재시도 | `{ orderId, preserveContext? }` |

### Recipe (Workflow)
| IPC | 기능 | 파라미터 |
|-----|------|----------|
| `workflow:list` | 전체 조회 | - |
| `workflow:get` | 단일 조회 | `id` |
| `workflow:create` | 생성 | `{ id, name, stages, ... }` |
| `workflow:update` | 수정 | `{ id, name?, stages?, ... }` |
| `workflow:delete` | 삭제 | `id` |

### Skill
| IPC | 기능 | 파라미터 |
|-----|------|----------|
| `skill:list` | 전체 조회 | - |
| `skill:get` | 단일 조회 | `id` |
| `skill:create` | 생성 | `{ id, name, category, ... }` |
| `skill:update` | 수정 | `{ id, ...updates }` |
| `skill:delete` | 삭제 | `id` |
| `skill:duplicate` | 복제 | `{ id, newId, newName? }` |

---

**문서 버전**: 1.0  
**작성일**: 2026-01-20
