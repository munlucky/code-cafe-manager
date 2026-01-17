# M2 기능 확장 사전 합의서

> 프로젝트 규칙: `.claude/PROJECT.md`

## 메타데이터

- 작성일: 2026-01-09
- 작성자: Requirements Analyzer Agent
- 작업 타입: feature
- 복잡도: complex

## 요청 요약

```
M2 PRD를 기반으로 다음 4가지 핵심 기능 추가:
1. Codex Provider 추가
2. Git worktree 병렬 실행 지원
3. Recipe Studio UI (폼 기반 편집)
4. 실행 엔진 고도화 (병렬/재시도/타임아웃)

사용자 답변:
- Codex CLI: 설치됨 (로컬 테스트 가능)
- Worktree 정리: 수동 정리 (기본 보존)
- Recipe Studio UX: 폼 기반 편집 (초보자 친화)
- 병렬 제약: 바리스타 풀 크기와 동일
```

## 요구사항 확정

### (A) Codex Provider

**범위**
- `packages/providers/codex/` 신규 패키지 생성
- Claude Code Provider와 동일한 인터페이스 구현
- PTY 기반 프로세스 실행 및 로그 스트리밍
- UI에서 Provider 선택 드롭다운 제공

**구현 상세**
- Provider 인터페이스: `IProvider` (신규 정의 필요)
  - `spawn(order: Order): Promise<void>`
  - `terminate(processId: string): Promise<void>`
  - `validateEnv(): Promise<boolean>`
  - `getAuthHint(): string`
- Codex CLI 실행 명령: `codex <prompt>` (검증 필요)
- 환경 점검: `codecafe doctor`에서 Codex CLI 존재 여부 확인

**미확정 항목**
- Codex CLI의 정확한 인터랙티브 실행 명령어
- Codex 인증 흐름 (Claude Code와 다를 가능성)

---

### (B) Git Worktree 모드

**범위**
- 레시피 스펙에 `workspace.mode=worktree` 지원
- Worktree 생성/정리 헬퍼 패키지: `packages/git-worktree/`
- UI에서 Worktree 목록 표시 + 패치 내보내기

**구현 상세**

#### 1) Worktree 생성 흐름
```typescript
// packages/git-worktree/src/worktree-manager.ts
interface WorktreeOptions {
  repoPath: string;
  baseBranch: string;
  newBranch: string;
  worktreePath?: string; // 기본: repoPath/../worktrees/{newBranch}
}

// 기능
- createWorktree(options: WorktreeOptions): Promise<WorktreeInfo>
- removeWorktree(worktreePath: string, force?: boolean): Promise<void>
- listWorktrees(repoPath: string): Promise<WorktreeInfo[]>
- exportPatch(worktreePath: string, baseBranch: string): Promise<string>
```

#### 2) Order 실행 시 Worktree 처리
- Order 생성 시 `workspace.mode=worktree`이면:
  1. baseBranch에서 `{orderId}` 브랜치 생성
  2. Worktree 폴더 생성: `{repoPath}/../.codecafe-worktrees/{orderId}`
  3. Order.counter를 Worktree 경로로 설정
- Order 종료 시:
  - `workspace.clean=true`: worktree 삭제 + 브랜치 삭제
  - `workspace.clean=false` (기본): 보존

#### 3) UI 변경
- **Order Detail 화면**:
  - Worktree 경로 표시 (worktree 모드일 경우)
  - "패치 내보내기" 버튼 → `git diff baseBranch...HEAD` 저장
  - "브랜치 열기" 버튼 → 탐색기에서 worktree 폴더 열기
- **Dashboard**:
  - Worktree 목록 탭 추가
  - 각 Worktree별 주문 ID, 브랜치명, 상태, 크기

**미확정 항목**
- Worktree 경로 기본 위치 규칙 (프로젝트 외부 vs 내부)
- Worktree 정리 시 커밋되지 않은 변경사항 처리 방식

---

### (C) Recipe Studio UI (폼 기반 편집)

**범위**
- Electron UI에 "Recipe Studio" 메뉴 추가
- 폼 기반 레시피 편집기 + YAML 실시간 프리뷰
- 레시피 저장소 관리 (로컬 폴더)

**구현 상세**

#### 1) 화면 구성
```
Recipe Studio
├── Recipe List (왼쪽 사이드바)
│   ├── 기본 레시피 (house-blend)
│   ├── 사용자 레시피 목록
│   └── + 새 레시피
└── Recipe Editor (메인)
    ├── Form Tab
    │   ├── 기본 정보 (name, version, provider, workspace)
    │   ├── Variables
    │   └── Steps
    │       ├── Step 추가/삭제
    │       ├── Step 타입별 폼 (ai.interactive, shell, parallel)
    │       ├── 의존성 설정 (depends_on)
    │       └── 재시도/타임아웃 설정
    └── YAML Preview Tab (읽기 전용, 복사 가능)
```

#### 2) 레시피 저장소
- 기본 경로: `~/.codecafe/recipes/`
- 레시피 파일: `{recipe-name}.yaml`
- 기본 제공: `house-blend/pm-agent.yaml`

#### 3) 검증
- 실시간 YAML 검증 (Zod schema)
- 필수 필드 누락 시 폼에 에러 표시
- Step ID 중복 검증
- depends_on 순환 참조 검증

**미확정 항목**
- DAG 시각화 UI 포함 여부 (M2 Should 항목)
- 레시피 템플릿 갤러리 기능 (M3으로 연기 가능)

---

### (D) 실행 엔진 고도화

**범위**
- `parallel` step 타입 지원
- `retry`, `timeout_sec` step 속성 지원
- Step 실행 순서 DAG 해석 (depends_on)

**구현 상세**

#### 1) Parallel Step 실행
```typescript
// packages/core/src/executor.ts
interface ExecutionContext {
  order: Order;
  recipe: Recipe;
  baristaManager: BaristaManager;
}

async function executeStep(
  step: RecipeStep,
  ctx: ExecutionContext
): Promise<StepResult> {
  if (step.type === 'parallel') {
    // 하위 steps를 병렬 실행
    // 제약: 바리스타 풀 크기만큼만 동시 실행
    return executeParallelSteps(step.steps!, ctx);
  }
  // ...
}

async function executeParallelSteps(
  steps: RecipeStep[],
  ctx: ExecutionContext
): Promise<StepResult> {
  // 1) 사용 가능한 바리스타 N개 확보
  // 2) steps를 N개 그룹으로 나눠 실행
  // 3) 모든 step 완료/실패 대기
  // 4) 하나라도 실패 시 parallel step 실패
}
```

#### 2) Retry 로직
```typescript
async function executeStepWithRetry(
  step: RecipeStep,
  ctx: ExecutionContext
): Promise<StepResult> {
  const maxRetries = step.retry ?? 0;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await executeStepCore(step, ctx);
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxRetries) {
        // 재시도 전 대기 (exponential backoff)
        await sleep(Math.pow(2, attempt) * 1000);
      }
    }
  }

  throw lastError;
}
```

#### 3) Timeout 처리
- `timeout_sec` 설정 시 해당 시간 초과 시 프로세스 강제 종료
- 기본값: 7200초 (2시간)

**미확정 항목**
- Parallel step 실행 시 바리스타 풀 부족 시 대기 vs 오류 정책
- Retry 시 exponential backoff 설정 커스터마이징 필요 여부

---

## 범위

### 포함

1. **Provider 확장**
   - Codex Provider 구현 (`packages/providers/codex/`)
   - Provider 인터페이스 표준화 (`IProvider`)
   - UI Provider 선택 드롭다운

2. **Worktree 지원**
   - Git worktree 관리 패키지 (`packages/git-worktree/`)
   - Worktree 생성/삭제/목록 조회
   - 패치 내보내기 기능
   - UI Worktree 목록 화면

3. **Recipe Studio**
   - 폼 기반 레시피 편집기
   - YAML 실시간 프리뷰
   - 레시피 저장소 관리
   - 스키마 기반 검증 + 에러 표시

4. **실행 엔진**
   - Parallel step 실행
   - Retry 로직 (exponential backoff)
   - Timeout 처리
   - DAG 기반 의존성 해석

### 제외 (M2 범위 외)

1. **M3 항목**
   - Gemini/Grok Provider
   - API 모드
   - 자동 병합 완전 자동화
   - 레시피 템플릿 레지스트리

2. **UI 고도화**
   - DAG 시각화 (Should 항목, 우선순위 낮음)
   - 결과 비교 UI
   - HTML/Markdown Receipt export

3. **운영 기능**
   - 실패 노드 하이라이트
   - 변경 파일 요약 상세화

---

## 미해결 질문

### HIGH (✅ 모두 해결됨)

1. **Codex CLI 실행 명령어 확정** ✅
   - 답변: `codex`
   - Provider 구현 시 `codex <prompt>` 형태로 실행

2. **Worktree 기본 경로 규칙** ✅
   - 답변: 프로젝트 외부 (`{repo}/../.codecafe-worktrees/{orderId}`)
   - 이유: 원본 repo git 상태에 영향 없음

3. **Parallel step 바리스타 부족 시 동작** ✅
   - 답변: 순차+병렬 혼합
   - 구현: 사용 가능한 바리스타만큼 병렬 실행, 완료 시 대기 중인 step 순차 실행

### MEDIUM

4. **Worktree 정리 시 미커밋 변경사항 처리**
   - 질문: Worktree 삭제 시 커밋되지 않은 변경사항이 있으면?
   - 옵션:
     - A) 경고 후 사용자 확인 필요
     - B) 자동 stash 생성
     - C) 강제 삭제 (변경사항 손실)
   - 제안: A) 경고 + 확인 (안전)

5. **Codex 인증 흐름**
   - 질문: Codex CLI의 인증/로그인 흐름은?
   - 이유: Claude Code와 다를 가능성
   - 조사 방법: Codex 문서 확인 + `doctor` 명령 테스트

6. **Recipe Studio DAG 시각화 우선순위**
   - 질문: M2에서 DAG 시각화를 포함할지?
   - 범위: Should 항목이므로 선택적
   - 제안: 폼 편집기 먼저 구현, 여유 있으면 간단한 노드/엣지 뷰 추가

### LOW

7. **Retry exponential backoff 커스터마이징**
   - 질문: Retry 대기 시간을 레시피에서 설정 가능하게 할지?
   - 제안: M2는 고정 (1s, 2s, 4s...), M3에서 `retry_policy` 속성 추가

8. **레시피 템플릿 갤러리**
   - 질문: 기본 제공 레시피 템플릿을 몇 개 만들지?
   - 제안: M2는 pm-agent만, M3에서 확장

---

## 구현 우선순위

### Phase 1: 기반 확장 (1-2주)
1. Provider 인터페이스 표준화
2. Codex Provider 구현
3. Git Worktree 패키지 구현
4. Recipe 스키마 확장 (parallel, retry, timeout)

### Phase 2: 실행 엔진 (1주)
5. Parallel step 실행 로직
6. Retry/Timeout 구현
7. DAG 의존성 해석 강화

### Phase 3: UI (1-2주)
8. Provider 선택 UI
9. Worktree 목록 화면
10. Recipe Studio 폼 편집기
11. YAML 프리뷰 + 검증 UI

### Phase 4: 통합 테스트 (1주)
12. E2E 테스트 (Windows/macOS)
13. Worktree 병렬 실행 시나리오
14. Recipe Studio → CLI 실행 검증

---

## 모듈 간 의존성 분석

```
packages/core (기존)
├── types.ts → StepType에 'parallel' 추가
├── barista.ts → (변경 없음)
└── executor.ts (신규) → Step 실행 로직

packages/providers/
├── common/ (신규)
│   └── provider-interface.ts → IProvider 인터페이스
├── claude-code/ (기존)
│   └── index.ts → IProvider 구현으로 리팩토링
└── codex/ (신규)
    └── index.ts → IProvider 구현

packages/git-worktree/ (신규)
└── src/
    ├── worktree-manager.ts → 핵심 로직
    └── types.ts

packages/schema/ (기존)
└── recipe-schema.ts → parallel/retry/timeout 스키마 추가

packages/cli/ (기존)
└── commands/doctor.ts → Codex CLI 점검 추가

packages/desktop/ (기존)
└── src/
    ├── components/
    │   ├── RecipeStudio/ (신규)
    │   └── WorktreeList/ (신규)
    └── ipc/ → Worktree IPC 핸들러 추가
```

**의존성 순서**
1. `packages/providers/common` (IProvider 인터페이스)
2. `packages/git-worktree` (독립 패키지)
3. `packages/core/executor` (실행 엔진)
4. `packages/providers/codex` (IProvider 의존)
5. `packages/desktop` (모든 패키지 의존)

---

## 리스크 및 대응 전략

### 1) Codex CLI 호환성
**리스크**: Codex CLI가 PTY 방식으로 실행 불가능하거나 인터랙티브 모드가 없을 수 있음
**대응**:
- 우선순위 1: Codex CLI 로컬 테스트 (사용자 환경에서 실행 가능 확인됨)
- 백업: Codex API 모드로 대체 (M3 범위이지만 필요 시 조기 도입)

### 2) Worktree 디스크 공간
**리스크**: 병렬 실행 시 여러 worktree가 디스크 공간 많이 차지
**대응**:
- 기본 정리 정책: 수동 정리 (사용자 답변 반영)
- UI에서 worktree 크기 표시 + 일괄 정리 기능
- 경고: worktree 5개 이상 시 알림

### 3) Parallel step 복잡도
**리스크**: Parallel step 구현이 생각보다 복잡할 수 있음 (바리스타 풀 관리, 오류 처리)
**대응**:
- 최소 구현: 바리스타 풀 크기만큼만 병렬 실행 (초과분은 대기)
- 오류 정책: 하나라도 실패 시 전체 실패 (단순화)
- 고도화는 M3로 연기 (동적 스케줄링)

### 4) Recipe Studio UX
**리스크**: 폼 기반 편집이 복잡한 레시피에는 제약이 많을 수 있음
**대응**:
- 폼 + YAML 투 트랙 지원 (YAML 직접 편집도 가능하게)
- 복잡한 레시피는 YAML 편집, 간단한 레시피는 폼 사용
- M3에서 고급 편집 기능 추가

### 5) 크로스플랫폼 테스트
**리스크**: Git worktree가 Windows/macOS/Linux에서 다르게 동작할 수 있음
**대응**:
- CI/CD에 Windows + macOS 테스트 환경 추가
- 경로 처리 시 `path.resolve` 사용 (플랫폼 독립적)
- Git 명령어 표준화 (porcelain 명령 사용)

---

## 영향 범위 (추정)

### 신규 파일 (약 20개)
- `packages/providers/common/src/provider-interface.ts`
- `packages/providers/codex/src/index.ts`
- `packages/git-worktree/src/worktree-manager.ts`
- `packages/git-worktree/src/types.ts`
- `packages/core/src/executor.ts`
- `packages/desktop/src/components/RecipeStudio/` (5개)
- `packages/desktop/src/components/WorktreeList/` (3개)
- `packages/desktop/src/ipc/worktree-handlers.ts`
- 테스트 파일 (~10개)

### 수정 파일 (약 10개)
- `packages/core/src/types.ts` (StepType 추가)
- `packages/schema/src/recipe-schema.ts` (스키마 확장)
- `packages/providers/claude-code/src/index.ts` (IProvider 구현)
- `packages/cli/src/commands/doctor.ts` (Codex 점검)
- `packages/desktop/src/main.ts` (IPC 핸들러 추가)
- `packages/desktop/src/components/Dashboard/` (Worktree 탭)
- `packages/desktop/src/components/OrderDetail/` (패치 내보내기)
- `package.json` (워크스페이스 추가)

### 위험 요소
- **호환성**: Codex CLI 실행 방식 차이
- **복잡도**: Parallel step 실행 로직
- **디스크**: Worktree 다수 생성 시 공간 부족
- **UX**: Recipe Studio 폼 구조 복잡도

---

## 수용 기준 (M2 PRD 기반)

1. ✅ Codex Provider로도 주문 실행/로그 스트리밍이 가능하다.
2. ✅ worktree 모드로 같은 repo에서 3개 주문을 병렬 실행할 수 있다.
3. ✅ 주문 종료 후 patch export가 가능하고, 원본 repo는 깨끗한 상태를 유지한다.
4. ✅ Recipe Studio에서 폼으로 만든 레시피가 YAML로 저장되고, CLI로도 실행된다.
5. ✅ Parallel step이 바리스타 풀 크기만큼 병렬 실행된다.
6. ✅ Retry/Timeout이 설정대로 동작한다.

---

## 다음 단계

- [ ] **HIGH 질문 해결** (Codex CLI 명령어 확정, Worktree 경로 규칙, Parallel step 동작)
- [ ] **사용자 확인/승인** (본 합의서 리뷰)
- [ ] **Phase 1 구현 시작** (Provider 인터페이스 + Codex Provider)
- [ ] **Context Builder 호출** (상세 구현 계획 작성)

---

## 참고 자료

- PRD.md (라인 183-231: M2 섹션)
- 현재 M1 구조: `packages/core/`, `packages/providers/claude-code/`
- Recipe 스키마: `packages/schema/src/recipe-schema.ts`
