# M2 Phase 2 구현 계획

> 프로젝트 규칙: `.claude/PROJECT.md`

## 메타데이터

- 작업자: Context Builder Agent
- 작성일: 2026-01-09
- 복잡도: complex
- 관련 문서: `.claude/docs/agreements/m2-features-agreement.md`

## 작업 개요

- 목적: M2 Phase 2 - 실행 엔진 고도화 (병렬/재시도/타임아웃 + Orchestrator Worktree 통합)
- 범위: Parallel step 실행, Retry/Timeout 구현, DAG 의존성 해석, Orchestrator에 Worktree 생성 로직 통합
- 영향: `packages/core/` (executor 신규), `packages/cli/` (brew 명령 수정), `packages/desktop/` (Order 실행 로직 수정)

## 변경 대상 파일

### 신규

- `packages/core/src/executor/index.ts` - 실행 엔진 메인 모듈
- `packages/core/src/executor/step-executor.ts` - Step 실행 로직 (retry/timeout)
- `packages/core/src/executor/parallel-executor.ts` - Parallel step 실행
- `packages/core/src/executor/dag-resolver.ts` - DAG 의존성 해석
- `packages/core/src/executor/types.ts` - Executor 타입 정의
- `packages/core/src/__tests__/executor.test.ts` - Executor 단위 테스트
- `packages/core/src/__tests__/parallel-executor.test.ts` - Parallel executor 테스트

### 수정

- `packages/core/src/types.ts` - StepResult 타입 추가
- `packages/cli/src/commands/brew.ts` - Executor + Worktree 통합
- `packages/desktop/src/services/order-executor.ts` - Executor 사용 (신규 파일일 가능성)
- `packages/desktop/src/ipc/order-handlers.ts` - Order 실행 IPC 핸들러 수정

## 현재 상태/유사 기능

### Phase 1 완료 항목

1. **IProvider 인터페이스** (`packages/providers/common/src/provider-interface.ts`)
   - `run(config)`, `write(data)`, `stop()`, `isActive()` 메서드 정의
   - EventEmitter 기반 이벤트 스트리밍 (data, exit, error)

2. **Codex Provider** (`packages/providers/codex/src/provider.ts`)
   - IProvider 구현체
   - PTY 기반 프로세스 실행

3. **Git Worktree 패키지** (`packages/git-worktree/src/worktree-manager.ts`)
   - `createWorktree()`, `removeWorktree()`, `listWorktrees()`, `exportPatch()`
   - 경로: `{repo}/../.codecafe-worktrees/{orderId}`
   - 미커밋 변경사항 검증 (force=false 시)

4. **Order 타입 확장** (`packages/core/src/types.ts`)
   - `worktreeInfo?: { path, branch, baseBranch }` 추가

5. **Recipe 스키마 확장** (`packages/schema/src/recipe-schema.ts`)
   - `StepType`에 `'parallel'` 추가
   - `RecipeStep`에 `timeout_sec`, `retry`, `steps` 속성 추가

### 재사용 패턴

- **BaristaManager** (`packages/core/src/barista.ts`): 바리스타 풀 관리
  - `findIdleBarista(provider?)`: 사용 가능한 바리스타 찾기
  - `updateBaristaStatus()`: 바리스타 상태 변경
  - `maxBaristas`: 풀 크기 제한

## 구현 계획

### Phase 2-1: Executor 기반 구조 (1-2일)

#### 1. Executor 타입 정의

**파일**: `packages/core/src/executor/types.ts`

```typescript
export interface ExecutionContext {
  order: Order;
  recipe: Recipe;
  baristaManager: BaristaManager;
  providerFactory: ProviderFactory;
}

export interface StepResult {
  stepId: string;
  status: 'success' | 'failed' | 'skipped';
  startedAt: Date;
  endedAt: Date;
  output?: string;
  error?: string;
  retryCount?: number;
}

export interface ExecutionResult {
  orderId: string;
  status: 'completed' | 'failed' | 'cancelled';
  steps: StepResult[];
  startedAt: Date;
  endedAt: Date;
  error?: string;
}
```

#### 2. DAG 의존성 해석

**파일**: `packages/core/src/executor/dag-resolver.ts`

**기능**:
- `depends_on` 속성 기반 실행 순서 결정
- 순환 참조 검증
- 토폴로지 정렬 (Topological Sort)

**알고리즘**:
```
1. 각 step의 의존성 그래프 구성
2. 순환 참조 검증 (DFS)
3. 토폴로지 정렬로 실행 순서 결정
4. 같은 레벨의 step은 병렬 실행 가능 그룹으로 묶음
```

**핵심 메서드**:
```typescript
resolveExecutionOrder(steps: RecipeStep[]): StepGroup[]
validateNoCycles(steps: RecipeStep[]): void
```

#### 3. Step 실행기 (Retry/Timeout)

**파일**: `packages/core/src/executor/step-executor.ts`

**기능**:
- 단일 step 실행 로직
- Retry 로직 (exponential backoff: 1s, 2s, 4s...)
- Timeout 처리 (기본 7200초)

**핵심 메서드**:
```typescript
async function executeStepWithRetry(
  step: RecipeStep,
  ctx: ExecutionContext
): Promise<StepResult> {
  const maxRetries = step.retry ?? 0;
  const timeout = step.timeout_sec ?? 7200;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Timeout 래퍼
      return await executeStepWithTimeout(step, ctx, timeout);
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        await sleep(backoffMs);
      }
    }
  }

  throw lastError;
}

async function executeStepWithTimeout(
  step: RecipeStep,
  ctx: ExecutionContext,
  timeoutSec: number
): Promise<StepResult> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Step ${step.id} timed out after ${timeoutSec}s`));
    }, timeoutSec * 1000);

    executeStepCore(step, ctx)
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer));
  });
}
```

**Step 타입별 실행**:
- `ai.interactive`: Provider 실행 + 사용자 입력 대기
- `ai.prompt`: Provider 실행 + 자동 종료
- `shell`: 쉘 명령 실행
- `parallel`: ParallelExecutor 위임

### Phase 2-2: Parallel Step 실행 (2-3일)

#### 4. Parallel Executor

**파일**: `packages/core/src/executor/parallel-executor.ts`

**기능**:
- 하위 steps를 병렬 실행
- 바리스타 풀 크기 제약 (N개까지만 동시 실행)
- 하나라도 실패 시 전체 실패

**알고리즘**:
```
1. 사용 가능한 바리스타 수 확인 (N)
2. steps를 N개씩 그룹으로 나눔
3. 각 그룹 병렬 실행 → 완료 대기
4. 다음 그룹 실행 (순차+병렬 혼합)
5. 모든 step 완료 후 결과 집계
6. 하나라도 실패 시 parallel step 실패
```

**핵심 메서드**:
```typescript
async function executeParallelSteps(
  steps: RecipeStep[],
  ctx: ExecutionContext
): Promise<StepResult> {
  const results: StepResult[] = [];

  // 1. 병렬 실행 그룹 생성 (바리스타 풀 크기만큼)
  const availableBaristas = ctx.baristaManager
    .getAllBaristas()
    .filter(b => b.status === BaristaStatus.IDLE).length;

  const batchSize = Math.max(1, availableBaristas);
  const batches = chunkArray(steps, batchSize);

  // 2. 순차적으로 각 배치 실행 (배치 내부는 병렬)
  for (const batch of batches) {
    const batchResults = await Promise.allSettled(
      batch.map(step => executeStepWithRetry(step, ctx))
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        // 실패 시 전체 실패
        return {
          stepId: 'parallel',
          status: 'failed',
          startedAt: new Date(),
          endedAt: new Date(),
          error: result.reason.message,
        };
      }
    }
  }

  // 3. 모든 step 성공 시 parallel step 성공
  return {
    stepId: 'parallel',
    status: 'success',
    startedAt: results[0]?.startedAt,
    endedAt: results[results.length - 1]?.endedAt,
  };
}
```

#### 5. Executor 메인 모듈

**파일**: `packages/core/src/executor/index.ts`

**기능**:
- 전체 Recipe 실행 오케스트레이션
- DAG 기반 실행 순서 결정
- StepExecutor/ParallelExecutor 조합

**핵심 메서드**:
```typescript
export async function executeRecipe(
  ctx: ExecutionContext
): Promise<ExecutionResult> {
  const { recipe } = ctx;
  const results: StepResult[] = [];

  // 1. DAG 의존성 해석
  const executionOrder = resolveExecutionOrder(recipe.steps);

  // 2. 순서대로 step 실행
  for (const stepGroup of executionOrder) {
    // 같은 레벨의 step은 병렬 실행 가능
    const groupResults = await Promise.all(
      stepGroup.map(step => {
        if (step.type === 'parallel') {
          return executeParallelSteps(step.steps!, ctx);
        } else {
          return executeStepWithRetry(step, ctx);
        }
      })
    );

    results.push(...groupResults);

    // 실패 시 중단
    if (groupResults.some(r => r.status === 'failed')) {
      return {
        orderId: ctx.order.id,
        status: 'failed',
        steps: results,
        startedAt: results[0].startedAt,
        endedAt: new Date(),
      };
    }
  }

  return {
    orderId: ctx.order.id,
    status: 'completed',
    steps: results,
    startedAt: results[0].startedAt,
    endedAt: new Date(),
  };
}
```

### Phase 2-3: Orchestrator 통합 (2-3일)

#### 6. CLI brew 명령 수정

**파일**: `packages/cli/src/commands/brew.ts`

**변경 사항**:
```typescript
import { executeRecipe } from '@codecafe/core/executor';
import { WorktreeManager } from '@codecafe/git-worktree';

// Order 생성 시 Worktree 처리
if (recipe.defaults.workspace.mode === 'worktree') {
  const worktreeInfo = await WorktreeManager.createWorktree({
    repoPath: recipe.inputs.counter,
    baseBranch: recipe.defaults.workspace.baseBranch || 'main',
    newBranch: order.id,
  });

  order.counter = worktreeInfo.path;
  order.worktreeInfo = {
    path: worktreeInfo.path,
    branch: worktreeInfo.branch!,
    baseBranch: recipe.defaults.workspace.baseBranch || 'main',
  };
}

// Executor로 실행
const result = await executeRecipe({
  order,
  recipe,
  baristaManager,
  providerFactory,
});

// Order 종료 시 Worktree 정리
if (recipe.defaults.workspace.mode === 'worktree' && recipe.defaults.workspace.clean) {
  await WorktreeManager.removeWorktree({
    worktreePath: order.worktreeInfo!.path,
    force: false, // 미커밋 변경사항 있으면 경고
  });
}
```

#### 7. Desktop Order 실행 로직 수정

**파일**: `packages/desktop/src/services/order-executor.ts` (신규 또는 기존)

**기능**:
- IPC를 통해 Order 실행 요청 처리
- Executor 사용
- 로그 스트리밍 (IPC 이벤트)

**핵심 로직**:
```typescript
export class OrderExecutorService {
  async executeOrder(orderId: string): Promise<void> {
    const order = await orderStore.getOrder(orderId);
    const recipe = await recipeStore.getRecipe(order.recipeId);

    // Worktree 생성 (필요 시)
    if (recipe.defaults.workspace.mode === 'worktree') {
      // ... (CLI와 동일)
    }

    // Executor 실행
    const result = await executeRecipe({
      order,
      recipe,
      baristaManager,
      providerFactory,
    });

    // 결과 저장
    await orderStore.updateOrder(orderId, {
      status: result.status === 'completed' ? OrderStatus.COMPLETED : OrderStatus.FAILED,
      endedAt: result.endedAt,
      error: result.error,
    });

    // Worktree 정리 (필요 시)
    if (recipe.defaults.workspace.mode === 'worktree' && recipe.defaults.workspace.clean) {
      // ... (CLI와 동일)
    }
  }
}
```

#### 8. IPC 핸들러 수정

**파일**: `packages/desktop/src/ipc/order-handlers.ts`

**변경 사항**:
- `brew` IPC 핸들러에서 OrderExecutorService 사용
- 로그 스트리밍 이벤트 연결

### Phase 2-4: 검증 (1-2일)

#### 9. 단위 테스트

**파일**:
- `packages/core/src/__tests__/executor.test.ts`
- `packages/core/src/__tests__/parallel-executor.test.ts`
- `packages/core/src/__tests__/dag-resolver.test.ts`

**테스트 케이스**:
1. DAG 순환 참조 검증
2. Retry 로직 (exponential backoff)
3. Timeout 처리
4. Parallel step 실행 (바리스타 풀 제약)
5. 실패 시 전체 실패

#### 10. 통합 테스트

**시나리오**:
1. **Parallel 없는 레시피** (기존 pm-agent.yaml)
   - 단일 step 실행 확인
   - Retry/Timeout 동작 확인

2. **Parallel 레시피 (바리스타 충분)**
   - 3개 step을 4개 바리스타로 병렬 실행
   - 모든 step 동시 실행 확인

3. **Parallel 레시피 (바리스타 부족)**
   - 5개 step을 2개 바리스타로 실행
   - 순차+병렬 혼합 실행 확인 (2개씩 묶어서 실행)

4. **Worktree 모드**
   - Worktree 생성 → Recipe 실행 → 패치 내보내기
   - 원본 repo 상태 깨끗한지 확인

5. **Retry 시나리오**
   - 일부러 실패하는 step (retry=2)
   - Retry 횟수/대기 시간 확인

6. **Timeout 시나리오**
   - 무한 루프 step (timeout_sec=5)
   - 5초 후 강제 종료 확인

## 위험 및 대안

### 1. Parallel step 복잡도

**위험**: Parallel step 내부에 또 parallel step이 중첩되면?

**대안**:
- M2는 1레벨 parallel만 지원 (중첩 금지)
- Schema 검증 단계에서 중첩 parallel 거부
- M3에서 고도화 검토

### 2. Timeout 시 프로세스 정리

**위험**: Timeout 발생 시 Provider 프로세스가 좀비로 남을 수 있음

**대안**:
- Provider의 `stop()` 메서드 강제 호출
- PTY 프로세스 kill 확인
- 필요 시 SIGKILL 사용

### 3. Worktree 경로 충돌

**위험**: 같은 orderId로 재실행 시 worktree 경로 충돌

**대안**:
- Order 생성 시 기존 worktree 존재 여부 확인
- 존재하면 타임스탬프 suffix 추가 (`{orderId}-{timestamp}`)
- UI에 경고 표시

### 4. DAG 순환 참조

**위험**: 사용자가 순환 참조하는 depends_on 작성

**대응**:
- DAG 검증 단계에서 명확한 에러 메시지
- Recipe Studio에서 실시간 검증 (Phase 3에서 구현)

## 의존성

### 외부 의존성

- **없음** (Phase 1 완료 항목만 사용)

### 내부 의존성

1. **Phase 1 완료 항목**:
   - IProvider 인터페이스
   - Codex Provider
   - Git Worktree 패키지
   - Recipe 스키마 확장

2. **BaristaManager**:
   - `findIdleBarista()`: Parallel executor에서 사용
   - `updateBaristaStatus()`: Step 실행 전/후 상태 변경

3. **Recipe 스키마**:
   - `parallel`, `retry`, `timeout_sec` 속성 이미 추가됨

## 체크포인트

### Phase 2-1: Executor 기반 구조
- [ ] Executor 타입 정의 완료
- [ ] DAG 의존성 해석 구현
- [ ] Step 실행기 (Retry/Timeout) 구현
- [ ] 단위 테스트 작성

### Phase 2-2: Parallel Step 실행
- [ ] Parallel Executor 구현
- [ ] Executor 메인 모듈 구현
- [ ] 바리스타 풀 제약 로직 검증

### Phase 2-3: Orchestrator 통합
- [ ] CLI brew 명령 수정
- [ ] Desktop Order 실행 로직 수정
- [ ] IPC 핸들러 수정
- [ ] Worktree 생성/정리 통합

### Phase 2-4: 검증
- [ ] 단위 테스트 통과
- [ ] 통합 테스트 6개 시나리오 통과
- [ ] Windows/macOS 크로스플랫폼 검증

## 남은 질문

### HIGH

**없음** (사전 합의서에서 모두 해결됨)

### MEDIUM

1. **Parallel step 내부 step 실패 시 다른 step 중단?**
   - 질문: Parallel step 내부에서 하나가 실패하면 나머지 실행 중인 step도 즉시 중단할지?
   - 옵션:
     - A) 즉시 중단 (빠른 실패)
     - B) 모든 step 완료 대기 후 실패 처리 (로그 수집)
   - 제안: A) 즉시 중단 (리소스 절약)

2. **Worktree 경로 사용자 커스터마이징 가능?**
   - 질문: 레시피에서 worktree 경로를 직접 지정할 수 있게 할지?
   - 제안: M2는 자동 생성만, M3에서 `workspace.worktreePath` 속성 추가

### LOW

3. **Retry backoff 커스터마이징**
   - 질문: Retry 대기 시간을 레시피에서 설정 가능하게 할지?
   - 제안: M2는 고정 (1s, 2s, 4s...), M3에서 `retry_policy` 속성 추가

4. **Parallel step 진행률 표시**
   - 질문: UI에서 Parallel step 내부 각 step의 진행률을 실시간 표시할지?
   - 제안: M2는 단순 로그만, M3에서 진행률 UI 추가

## 수용 기준 (Phase 2)

1. ✅ Parallel step이 바리스타 풀 크기만큼 병렬 실행된다.
2. ✅ 바리스타 부족 시 순차+병렬 혼합 실행된다.
3. ✅ Retry가 exponential backoff로 동작한다 (1s, 2s, 4s...).
4. ✅ Timeout이 설정대로 동작하고 프로세스를 강제 종료한다.
5. ✅ Worktree 모드에서 주문 실행 시 Worktree가 자동 생성/정리된다.
6. ✅ DAG 의존성에 따라 step 실행 순서가 결정된다.
7. ✅ 순환 참조 레시피는 검증 단계에서 거부된다.
8. ✅ 통합 테스트 6개 시나리오가 모두 통과한다.

## 다음 단계

1. **Phase 2-1 구현 시작**: Executor 기반 구조 (DAG, Retry, Timeout)
2. **Phase 2-2 구현**: Parallel Executor
3. **Phase 2-3 구현**: Orchestrator 통합 (CLI + Desktop)
4. **Phase 2-4 검증**: 단위 테스트 + 통합 테스트

---

## 참고 자료

- 사전 합의서: `.claude/docs/agreements/m2-features-agreement.md`
- Phase 1 구현:
  - IProvider: `packages/providers/common/src/provider-interface.ts`
  - Codex Provider: `packages/providers/codex/src/provider.ts`
  - Git Worktree: `packages/git-worktree/src/worktree-manager.ts`
- 현재 타입: `packages/core/src/types.ts`
- Recipe 스키마: `packages/schema/src/recipe-schema.ts`
- BaristaManager: `packages/core/src/barista.ts`
