# @codecafe/orchestrator 리팩토링 계획

> 작성일: 2026-02-02
> 패키지 경로: `packages/orchestrator/`
> 현재 LOC: ~3,000줄

---

## 1. 개요

`@codecafe/orchestrator`는 CodeCafe의 핵심 실행 엔진으로, 워크플로우 오케스트레이션, 터미널 풀 관리, 세션 관리, FSM 기반 상태 제어를 담당합니다. 가장 복잡한 로직이 집중된 패키지입니다.

### 핵심 문제 요약

| 우선순위 | 이슈 | 파일 수 | 예상 공수 |
|---------|------|--------|----------|
| **P0** | 긴 함수 (>50줄) | 7개 | 8-12시간 |
| **P0** | 깊은 중첩 (>4레벨) | 5곳 | 4-6시간 |
| **P1** | 이벤트 포워딩 중복 | 4개 파일, 60줄+ | 2시간 |
| **P1** | 상태 관리 분산 | order-session.ts | 4-5시간 |
| **P2** | Retry 정책 분산 | 3곳 | 2-3시간 |
| **P2** | 타입 안전성 | 12곳+ | 2시간 |
| **P3** | 리소스 생명주기 | 터미널 정리 | 3시간 |

---

## 2. Critical Issues (P0)

### 2.1 긴 함수 분할

#### A. `barista-engine-v2.ts` - `buildStagePrompt()` (77줄)

**위치**: `src/barista/barista-engine-v2.ts:336-413`

**문제**: Role instructions와 Signal format이 메서드 내 하드코딩

**Before**:
```typescript
private buildStagePrompt(stage: StageConfig, context: ExecutionContext): string {
  // 77줄의 문자열 조합 로직
  const roleInstructions = `You are a ${stage.role}...`;
  const signalFormat = `When you complete, output: [STAGE_COMPLETE]...`;
  // ...
}
```

**After**:
```typescript
// src/barista/prompts/role-instructions.ts (신규)
export const ROLE_INSTRUCTIONS: Record<string, string> = {
  analyst: 'You are a senior analyst...',
  developer: 'You are a senior developer...',
  // ...
};

// src/barista/prompts/signal-format.ts (신규)
export const SIGNAL_FORMAT_TEMPLATE = `
When you complete the task, output one of:
- [STAGE_COMPLETE] - Task finished successfully
- [NEED_CLARIFICATION] - Requires user input
- [STAGE_FAILED] - Task cannot be completed
`;

// barista-engine-v2.ts
import { ROLE_INSTRUCTIONS } from './prompts/role-instructions';
import { SIGNAL_FORMAT_TEMPLATE } from './prompts/signal-format';

private buildStagePrompt(stage: StageConfig, context: ExecutionContext): string {
  return this.promptBuilder.build({
    role: ROLE_INSTRUCTIONS[stage.role],
    signal: SIGNAL_FORMAT_TEMPLATE,
    context,
    stage,
  });
}
```

---

#### B. `barista-engine-v2.ts` - `loadDefaultWorkflow()` (80줄)

**위치**: `src/barista/barista-engine-v2.ts:418-498`

**문제**: 파일 로딩, YAML 파싱, 스킬 로딩 혼재

**After**: `WorkflowLoader` 서비스 추출
```typescript
// src/barista/services/workflow-loader.ts (신규)
export class WorkflowLoader {
  async load(workflowPath: string): Promise<WorkflowConfig> {
    const rawConfig = await this.loadYamlFile(workflowPath);
    const skills = await this.loadSkills(rawConfig.stages);
    return this.buildWorkflowConfig(rawConfig, skills);
  }

  private async loadYamlFile(path: string): Promise<RawWorkflowConfig> { /* ... */ }
  private async loadSkills(stages: RawStage[]): Promise<SkillMap> { /* ... */ }
  private buildWorkflowConfig(raw: RawWorkflowConfig, skills: SkillMap): WorkflowConfig { /* ... */ }
}
```

---

#### C. `stage-coordinator.ts` - `processParallelResults()` (135줄)

**위치**: `src/session/execution/stage-coordinator.ts:84-218`

**문제**: While 루프 내 5레벨 중첩, 재시도 로직 복잡

**After**: `ParallelStageProcessor` 클래스 추출
```typescript
// src/session/execution/parallel-stage-processor.ts (신규)
export class ParallelStageProcessor {
  constructor(
    private readonly orchestrator: StageOrchestrator,
    private readonly retryPolicy: RetryPolicy,
  ) {}

  async process(results: StageResult[]): Promise<ProcessResult> {
    const handler = new ParallelResultHandler(this.orchestrator);

    for (const result of results) {
      const decision = await handler.handle(result);
      if (decision.action === 'stop') {
        return { status: 'stopped', reason: decision.reason };
      }
    }

    return { status: 'completed' };
  }
}

// 별도 클래스로 결정 로직 분리
class ParallelResultHandler {
  async handle(result: StageResult): Promise<Decision> {
    if (result.status === 'failed') {
      return this.handleFailure(result);
    }
    if (result.status === 'needs_retry') {
      return this.handleRetry(result);
    }
    return { action: 'continue' };
  }
}
```

---

#### D. `order-session.ts` - `retryFromStage()` (73줄)

**위치**: `src/session/order-session.ts:474-546`

**문제**: `retryFromStage()`와 `retryFromBeginning()` 유사 패턴 반복

**After**: `RetryStrategyFactory` 추출
```typescript
// src/session/retry/retry-strategy.ts (신규)
interface RetryStrategy {
  prepareState(): void;
  getStartIndex(): number;
}

class RetryFromStageStrategy implements RetryStrategy {
  constructor(private session: OrderSession, private stageId: string) {}

  prepareState(): void {
    this.session.clearStagesAfter(this.stageId);
    this.session.resetContext();
  }

  getStartIndex(): number {
    return this.session.findStageIndex(this.stageId);
  }
}

class RetryFromBeginningStrategy implements RetryStrategy {
  constructor(private session: OrderSession) {}

  prepareState(): void {
    this.session.clearAllStages();
    this.session.resetContext();
  }

  getStartIndex(): number {
    return 0;
  }
}
```

---

### 2.2 깊은 중첩 해소

#### A. `stage-orchestrator.ts:202-214` (5레벨)

**Before**:
```typescript
if (isAnalyzeStage || isPlanStage) {
  if (hasVerySubstantialOutput && hasCompletionIndicators) {
    if (specificCondition) {
      return { action: 'proceed', confidence: 0.9 };
    }
  }
}
```

**After**: Strategy 패턴 적용
```typescript
// src/session/orchestration/strategies/analyze-stage-evaluator.ts
export class AnalyzeStageEvaluator implements StageEvaluator {
  evaluate(context: EvaluationContext): EvaluationResult | null {
    if (!this.isApplicable(context)) return null;

    const indicators = this.detectCompletionIndicators(context.output);
    const outputQuality = this.assessOutputQuality(context.output);

    if (indicators.hasCompletion && outputQuality.isSubstantial) {
      return { action: 'proceed', confidence: 0.9 };
    }

    return null;
  }

  private isApplicable(context: EvaluationContext): boolean {
    return context.stageType === 'analyze' || context.stageType === 'plan';
  }
}
```

---

#### B. `terminal-pool.ts:331-362` (4+레벨)

**Before**:
```typescript
for (const terminal of this.terminals.values()) {
  if (terminal.provider !== provider) continue;
  if (terminal.status === 'idle') {
    if (terminal.cwd === effectiveCwd) {
      // 재사용
    } else if (shouldRecycle) {
      // 재활용
    }
  }
}
```

**After**: Early return + 헬퍼 메서드
```typescript
private findMatchingTerminal(provider: string, cwd: string): Terminal | null {
  const candidates = this.getIdleTerminals(provider);

  // 1순위: 동일 cwd
  const exactMatch = candidates.find(t => t.cwd === cwd);
  if (exactMatch) return exactMatch;

  // 2순위: 재활용 가능
  const recyclable = candidates.find(t => this.canRecycle(t));
  if (recyclable) return recyclable;

  return null;
}

private getIdleTerminals(provider: string): Terminal[] {
  return Array.from(this.terminals.values())
    .filter(t => t.provider === provider && t.status === 'idle');
}
```

---

## 3. High Priority Issues (P1)

### 3.1 이벤트 포워딩 중복 제거

**현황**: 4개 파일에서 동일한 이벤트 전파 패턴 반복

**위치**:
- `cafe-session-manager.ts:109-127`
- `order-session.ts:134-136, 804-823`
- `terminal-pool.ts:391-405`

**Before**:
```typescript
// cafe-session-manager.ts
this.listenerManager.attach(engine, 'order:started', (data) => this.emit('order:started', data));
this.listenerManager.attach(engine, 'order:output', (data) => this.emit('order:output', data));
this.listenerManager.attach(engine, 'order:completed', (data) => this.emit('order:completed', data));
// ... 9개 더
```

**After**: `EventForwarder` 유틸리티
```typescript
// src/core/utils/event-forwarder.ts (신규)
export class EventForwarder {
  static relay(
    source: EventEmitter,
    target: EventEmitter,
    events: string[],
    listenerManager?: EventListenerManager
  ): () => void {
    const cleanups: Array<() => void> = [];

    for (const event of events) {
      const handler = (data: unknown) => target.emit(event, data);

      if (listenerManager) {
        listenerManager.attach(source, event, handler);
      } else {
        source.on(event, handler);
        cleanups.push(() => source.off(event, handler));
      }
    }

    return () => cleanups.forEach(fn => fn());
  }
}

// 사용
EventForwarder.relay(engine, this, [
  'order:started',
  'order:output',
  'order:completed',
  'order:failed',
  'stage:started',
  'stage:completed',
], this.listenerManager);
```

---

### 3.2 OrderSession State Machine 구현

**현황**: 8개 상태 변경 메서드가 분산되어 검증 없이 상태 변경

**위치**: `src/session/order-session.ts`

**현재 문제 메서드**:
- `execute()` - created → running
- `executePrompt()` - running → awaiting_input
- `resume()` - awaiting_input → running
- `cancel()` - * → cancelled
- `retryFromStage()` - failed → running
- `retryFromBeginning()` - failed → running
- `enterFollowup()` - completed → followup
- `executeFollowup()` - followup → running

**After**: State Machine 패턴
```typescript
// src/session/state-machine/session-state.ts (신규)
export type SessionState =
  | 'created'
  | 'running'
  | 'awaiting_input'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'followup';

export const SESSION_TRANSITIONS: Record<SessionState, SessionState[]> = {
  created: ['running', 'cancelled'],
  running: ['awaiting_input', 'completed', 'failed', 'cancelled'],
  awaiting_input: ['running', 'cancelled'],
  completed: ['followup'],
  failed: ['running', 'cancelled'],  // retry
  cancelled: [],
  followup: ['running', 'completed', 'failed'],
};

// src/session/state-machine/session-state-machine.ts
export class SessionStateMachine {
  private state: SessionState = 'created';

  canTransition(to: SessionState): boolean {
    return SESSION_TRANSITIONS[this.state]?.includes(to) ?? false;
  }

  transition(to: SessionState): void {
    if (!this.canTransition(to)) {
      throw new InvalidStateTransitionError(this.state, to);
    }
    this.state = to;
  }

  getState(): SessionState {
    return this.state;
  }
}

// order-session.ts에서 사용
class OrderSession {
  private stateMachine = new SessionStateMachine();

  async execute(): Promise<ExecutionResult> {
    this.stateMachine.transition('running');  // 자동 검증
    // ...
  }
}
```

---

## 4. Medium Priority Issues (P2)

### 4.1 RetryPolicy 서비스 통합

**현황**: MAX_RETRIES 상수가 여러 파일에 분산

**위치**:
- `stage-orchestrator.ts:53` - retryCount Map
- `stage-coordinator.ts:92` - MAX_RETRIES = 3
- `stage-coordinator.ts:273` - 별도 retry 상수

**After**:
```typescript
// src/session/retry/retry-policy.ts (신규)
export interface RetryPolicy {
  shouldRetry(attemptCount: number, error: Error): boolean;
  getDelay(attemptCount: number): number;
  getMaxRetries(): number;
}

export class ExponentialBackoffPolicy implements RetryPolicy {
  constructor(
    private readonly maxRetries: number = 3,
    private readonly baseDelayMs: number = 1000,
  ) {}

  shouldRetry(attemptCount: number, error: Error): boolean {
    if (attemptCount >= this.maxRetries) return false;
    return this.isRetryableError(error);
  }

  getDelay(attemptCount: number): number {
    return this.baseDelayMs * Math.pow(2, attemptCount);
  }

  getMaxRetries(): number {
    return this.maxRetries;
  }

  private isRetryableError(error: Error): boolean {
    // Transient errors만 재시도
    return error.message.includes('timeout') ||
           error.message.includes('network');
  }
}

// src/session/retry/retry-policy-manager.ts
export class RetryPolicyManager {
  private counters = new Map<string, number>();

  increment(key: string): number {
    const current = this.counters.get(key) ?? 0;
    this.counters.set(key, current + 1);
    return current + 1;
  }

  reset(key: string): void {
    this.counters.delete(key);
  }

  getCount(key: string): number {
    return this.counters.get(key) ?? 0;
  }
}
```

---

### 4.2 타입 안전성 개선

#### A. `terminal-pool.ts:156` - 문자열 상태 → Enum

**Before**:
```typescript
terminal.status = 'busy' | 'idle' | 'crashed';  // 문자열 리터럴
```

**After**:
```typescript
// src/terminal/types.ts
export enum TerminalStatus {
  IDLE = 'idle',
  BUSY = 'busy',
  CRASHED = 'crashed',
  INITIALIZING = 'initializing',
}

// terminal-pool.ts
terminal.status = TerminalStatus.BUSY;
```

#### B. `barista-engine-v2.ts:226` - Skill Name 타입 강화

**Before**:
```typescript
const skillNameMap: Record<string, string> = { /* ... */ };
```

**After**:
```typescript
// src/constants/skills.ts
export const SKILL_NAMES = {
  ANALYZER: 'analyzer',
  PLANNER: 'planner',
  IMPLEMENTER: 'implementer',
  REVIEWER: 'reviewer',
} as const;

export type SkillName = typeof SKILL_NAMES[keyof typeof SKILL_NAMES];
```

---

## 5. Low Priority Issues (P3)

### 5.1 리소스 생명주기 관리

**현황**: 터미널 리소스 정리가 3곳에 분산

**위치**:
- `terminal-pool.ts:279-295`
- `order-session.ts:780-798`
- `terminal-group.ts` (dispose)

**After**: `ResourceLifecycleManager`
```typescript
// src/core/resource-lifecycle/resource-manager.ts
export interface ManagedResource {
  readonly id: string;
  dispose(): Promise<void>;
}

export class ResourceLifecycleManager {
  private resources = new Map<string, ManagedResource>();

  register(resource: ManagedResource): void {
    this.resources.set(resource.id, resource);
  }

  async release(id: string): Promise<void> {
    const resource = this.resources.get(id);
    if (resource) {
      await resource.dispose();
      this.resources.delete(id);
    }
  }

  async releaseAll(): Promise<void> {
    const disposals = Array.from(this.resources.values())
      .map(r => r.dispose().catch(() => {}));
    await Promise.all(disposals);
    this.resources.clear();
  }
}
```

---

## 6. 파일별 LOC 현황 및 목표

| 파일 | 현재 LOC | 목표 LOC | 분할 대상 |
|------|---------|---------|----------|
| `order-session.ts` | 824 | <400 | SessionStateMachine, RetryStrategy |
| `barista-engine-v2.ts` | 775 | <400 | WorkflowLoader, PromptBuilder |
| `terminal-pool.ts` | 533 | <400 | TerminalMatcher |
| `stage-coordinator.ts` | 359 | <300 | ParallelStageProcessor |
| `stage-orchestrator.ts` | 333 | <300 | StageEvaluator strategies |

---

## 7. 리팩토링 실행 순서

```
┌─────────────────────────────────────────────────────────────┐
│  Week 1: Quick Wins                                         │
│  ├─ 1.1 상수 파일 추출 (role-instructions, signal-format)    │
│  ├─ 1.2 TerminalStatus enum 생성                            │
│  ├─ 1.3 EventForwarder 유틸리티 생성                         │
│  └─ 1.4 SKILL_NAMES 상수 정의                               │
├─────────────────────────────────────────────────────────────┤
│  Week 2: Core Services                                      │
│  ├─ 2.1 RetryPolicy 서비스 구현                              │
│  ├─ 2.2 WorkflowLoader 서비스 추출                           │
│  └─ 2.3 ParallelStageProcessor 클래스 추출                   │
├─────────────────────────────────────────────────────────────┤
│  Week 3: State Management                                   │
│  ├─ 3.1 SessionStateMachine 구현                            │
│  ├─ 3.2 OrderSession 리팩토링 (상태 머신 적용)                │
│  └─ 3.3 StageEvaluator Strategy 패턴 적용                   │
├─────────────────────────────────────────────────────────────┤
│  Week 4: Resource Management                                │
│  ├─ 4.1 ResourceLifecycleManager 구현                       │
│  ├─ 4.2 TerminalPool 리소스 관리 통합                        │
│  └─ 4.3 전체 통합 테스트                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. 검증 체크리스트

```bash
# 긴 함수 검사 (50줄 초과)
find packages/orchestrator/src -name "*.ts" -exec awk '
  /^[[:space:]]*(async )?function|^[[:space:]]*(async )?[a-zA-Z]+\(/ {start=NR}
  /^[[:space:]]*}$/ && start {if(NR-start>50) print FILENAME":"start" ("NR-start" lines)"}
' {} \;

# 중첩 깊이 검사 (수동 검토 필요)
grep -n "if.*{" packages/orchestrator/src/**/*.ts | head -20

# 타입 체크
pnpm --filter @codecafe/orchestrator typecheck

# 테스트
pnpm --filter @codecafe/orchestrator test

# 순환 의존성 검사
npx madge --circular packages/orchestrator/src/
```

---

## 9. 주요 메트릭 추적

| 메트릭 | 현재 | 목표 |
|--------|------|------|
| 50줄 초과 함수 | 7개 | 0개 |
| 5레벨+ 중첩 | 5곳 | 0곳 |
| 이벤트 포워딩 중복 | 60줄+ | 10줄 |
| 상태 변경 메서드 | 8개 분산 | 1개 집중 |
| 파일당 평균 LOC | ~400줄 | <300줄 |

---

*마지막 업데이트: 2026-02-02*
