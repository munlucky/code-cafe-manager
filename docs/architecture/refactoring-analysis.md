# CodeCafe 리팩토링 분석 보고서

> 프로젝트 전체 코드베이스를 분석하여 리팩토링이 필요한 영역을 식별한 문서입니다.

## 요약 대시보드

| 카테고리 | 심각도 | 이슈 수 | 우선순위 |
|---------|--------|---------|----------|
| Console.log in Production | CRITICAL | 516+ | P0 |
| God Classes (>800 lines) | CRITICAL | 6 | P0 |
| Memory Leaks (Event Listeners) | HIGH | 12+ | P1 |
| Type Safety (`any` types) | HIGH | 68+ | P1 |
| Waterfall Async Calls | HIGH | 5+ | P1 |
| Layer Violations | MEDIUM | 4 | P2 |
| Missing Abstractions | MEDIUM | 5 | P2 |
| Magic Numbers | MEDIUM | 20+ | P3 |

---

## 1. CRITICAL 이슈 (즉시 수정 필요)

### 1.1 Production 코드의 Console.log (516+ instances)

**영향**: 성능 저하, 민감 정보 노출 위험, 로그 오염

| 패키지 | 인스턴스 수 | 주요 파일 |
|--------|------------|----------|
| orchestrator | 306 | barista-engine-v2.ts, dag-executor.ts, terminal-pool.ts |
| desktop | 210 | execution-manager.ts, ipc/*.ts, TerminalOutputPanel.tsx |
| core | 4 | (비교적 양호) |

**수정 방안**:
```typescript
// 통합 로거 서비스 도입
import { Logger } from '@codecafe/core/logging';

const logger = Logger.create('BaristaEngine');
logger.debug('Stage started', { stageId, orderId });  // console.log 대체
logger.error('Execution failed', { error });          // console.error 대체
```

**예상 작업량**: 2-3일 (패키지별 단계적 적용)

---

### 1.2 God Classes - 책임이 과도한 파일들

| 파일 | 라인 수 | 책임 수 | 분할 대상 |
|------|--------|--------|----------|
| `orchestrator/src/session/order-session.ts` | **1113** | 5+ | SessionLifecycle, StageCoordinator, EventPropagator |
| `orchestrator/src/workflow/workflow-executor.ts` | **942** | 4+ | FSMController, DAGRunner, StateManager |
| `desktop/src/main/ipc/order.ts` | **907** | 3+ | OrderService, EventBridge 분리 |
| `orchestrator/src/terminal/adapters/claude-code-adapter.ts` | **865** | 4+ | ProcessManager, OutputParser, SessionHandler |
| `desktop/src/renderer/utils/terminal-log-parser.ts` | **844** | 5+ | ContentDetector, Summarizer, Formatter |
| `desktop/src/main/execution-manager.ts` | **775** | 3+ | BaristaWrapper, TerminalAdapter |

**order-session.ts 분할 예시**:
```
session/
├── order-session.ts              (300줄, 핵심 오케스트레이션만)
├── lifecycle/
│   ├── session-lifecycle.ts      (150줄)
│   └── session-registry.ts
├── execution/
│   ├── stage-coordinator.ts      (200줄)
│   └── execution-planner.ts
├── resources/
│   ├── terminal-group.ts
│   └── context-manager.ts
└── events/
    └── event-propagator.ts       (100줄)
```

**예상 작업량**: 파일당 1-2일 (테스트 포함)

---

## 2. HIGH 우선순위 이슈

### 2.1 Memory Leaks - Event Listener 미정리

**위치 및 패턴**:

```typescript
// barista-engine-v2.ts:58-82 - 문제 패턴
this.sessionManager.on('output', (data) => {
  this.emit('order:output', { orderId: data.orderId, data: data.data });
});
// ... 7개 이상의 리스너가 dispose()에서 정리되지 않음

// order-session.ts:119-122 - 동일 패턴
this.sharedContext.on('stage:started', (data) => this.emit('stage:started', data));
// cleanup 메서드에서 removeListener 호출 없음
```

**수정 방안**:
```typescript
private eventListeners: Array<{ emitter: EventEmitter; event: string; handler: Function }> = [];

private attachListener(emitter: EventEmitter, event: string, handler: Function): void {
  emitter.on(event, handler);
  this.eventListeners.push({ emitter, event, handler });
}

async dispose(): Promise<void> {
  for (const { emitter, event, handler } of this.eventListeners) {
    emitter.removeListener(event, handler);
  }
  this.eventListeners = [];
}
```

**영향받는 파일**:
- `barista-engine-v2.ts` (7+ listeners)
- `cafe-session-manager.ts` (5+ listeners)
- `order-session.ts` (3+ listeners)
- `terminal-pool.ts` (lease callbacks)

---

### 2.2 Type Safety - `any` 타입 남용 (68+ instances)

**카테고리별 분류**:

| 카테고리 | 인스턴스 | 주요 위치 |
|---------|---------|----------|
| Error handling (`catch (error: any)`) | 20+ | git-worktree, execution-manager |
| Event handlers (`data: any`) | 15+ | ipc handlers, EventEmitter |
| Output/Data fields | 12+ | types.ts, shared-context.ts |
| YAML parsing (`as any`) | 10+ | workflow.ts, run.ts |
| Preload bridge | 8+ | preload/index.cts |

**위험한 Type Assertion 패턴**:
```typescript
// codex-adapter.ts:54 - 가장 위험
}) as unknown as IPtyProcess;

// workflow.ts:235 - Zod 검증 없이 사용
yaml.load(content) as any

// claude-code-adapter.ts:239-419 - 10개 이상의 as any
```

**수정 방안**:
```typescript
// 1. Error 타입 정의
interface TypedError extends Error {
  code?: string;
  cause?: Error;
}

// 2. Zod로 런타임 검증
import { WorkflowSchema } from './schema/workflow.schema';
const workflow = WorkflowSchema.parse(yaml.load(content));

// 3. Typed EventEmitter
interface SessionEvents {
  'stage:started': (data: StageStartedData) => void;
  'stage:completed': (data: StageCompletedData) => void;
}
class OrderSession extends TypedEventEmitter<SessionEvents> { }
```

---

### 2.3 Waterfall Async Calls - 순차 실행 병목

**위치**: `barista-engine-v2.ts:354-361`
```typescript
// BAD: N개 스킬을 순차적으로 로드 (N번의 파일시스템 호출)
for (const skillName of stageConfig.skills) {
  const skillContent = await this.loadSkillContent(skillName, projectRoot);
  if (skillContent) {
    skillContents.push(skillContent);
  }
}

// GOOD: 병렬 로드
const skillContents = (await Promise.all(
  stageConfig.skills.map(name => this.loadSkillContent(name, projectRoot))
)).filter(Boolean);
```

**추가 위치**:
- `dag-executor.ts` - 노드별 순차 실행 (일부 병렬화 가능)
- `workflow-executor.ts` - 설정 파일 로드
- `terminal-pool.ts` - 메트릭 수집

---

## 3. MEDIUM 우선순위 이슈

### 3.1 아키텍처 Layer Violations

**Desktop → Orchestrator 직접 결합**:
```typescript
// execution-manager.ts:10 - 내부 모듈 직접 import
import { BaristaEngineV2, TerminalPool } from '@codecafe/orchestrator';

// ipc/order.ts:13-14 - 여러 패키지 직접 의존
import { WorktreeManager } from '@codecafe/git-worktree';
import { getExecutionManager } from '../execution-manager.js';
```

**수정 방안 - Facade 패턴**:
```
orchestrator/src/facades/
└── execution-facade.ts     (Desktop용 단일 진입점)

// Desktop에서 사용
import { ExecutionFacade } from '@codecafe/orchestrator/facades';
const execution = new ExecutionFacade(config);
execution.on('order:output', callback);
```

---

### 3.2 Provider Adapter 순환 의존 위험

**현재 구조**:
```
provider-adapter.ts
├── imports → claude-code-adapter.ts
└── imports → codex-adapter.ts
    └── imports → provider-adapter.ts (인터페이스)
```

**개선된 구조**:
```
terminal/
├── interfaces/
│   └── provider-adapter.interface.ts   (IProviderAdapter, IPty)
├── factory/
│   └── provider-adapter-factory.ts     (Factory만)
└── adapters/
    ├── claude-code-adapter.ts          (interface import)
    └── codex-adapter.ts                (interface import)
```

---

### 3.3 비효율적 배열 연산

**위치**: `terminal-pool.ts:237-246`
```typescript
// BAD: Provider 수 × Terminal 수만큼 반복
for (const [provider, _] of Object.entries(this.config.perProvider)) {
  const terminals = Array.from(this.terminals.values())
    .filter(t => t.provider === provider);      // 1st pass

  status[provider] = {
    idle: terminals.filter(t => t.status === 'idle').length,    // 2nd pass
    busy: terminals.filter(t => t.status === 'busy').length,    // 3rd pass
    crashed: terminals.filter(t => t.status === 'crashed').length, // 4th pass
  };
}

// GOOD: 단일 패스
const statusMap = new Map();
for (const terminal of this.terminals.values()) {
  const stats = statusMap.get(terminal.provider) ?? { idle: 0, busy: 0, crashed: 0 };
  stats[terminal.status]++;
  statusMap.set(terminal.provider, stats);
}
```

---

### 3.4 Missing Caching - 반복 파일 읽기

**위치**: `barista-engine-v2.ts:185-227`
```typescript
// 현재: 매 스테이지마다 동일 스킬 파일 재로드
private async loadSkillContent(skillName: string, projectRoot: string): Promise<string | null> {
  const content = await fs.readFile(skillPath, 'utf-8');  // 매번 디스크 I/O
}

// 개선: LRU 캐시 적용
private skillCache = new Map<string, string>();
private async loadSkillContent(skillName: string, projectRoot: string): Promise<string | null> {
  const cacheKey = `${skillName}:${projectRoot}`;
  if (this.skillCache.has(cacheKey)) return this.skillCache.get(cacheKey);

  const content = await fs.readFile(skillPath, 'utf-8');
  this.skillCache.set(cacheKey, content);
  return content;
}
```

---

## 4. LOW 우선순위 이슈

### 4.1 Magic Numbers

```typescript
// 타임아웃 (ms)
1000, 5000, 10000, 15000, 30000, 60000, 3600000

// 출력 크기 임계값
500, 1000, 10000

// 수정: 상수 추출
const TERMINAL_IDLE_TIMEOUT_MS = 5000;
const SESSION_CLEANUP_THRESHOLD_MS = 3600000;
const SUBSTANTIAL_OUTPUT_BYTES = 500;
```

### 4.2 미해결 TODO/FIXME

| 위치 | 내용 |
|------|------|
| `cli/commands/role.ts:131` | `// TODO: Add interactive confirmation` |
| `desktop/main/index.ts:171` | `// TODO: Add run handlers if needed` |
| `cli/src/commands/ui.ts:12` | `// TODO: Electron 앱 실행 경로 확인 필요` |

---

## 5. 리팩토링 로드맵

### Phase 1: Critical (1-2주)

| 태스크 | 파일 | 예상 시간 | 영향도 |
|--------|------|----------|--------|
| Console.log 제거 + Logger 도입 | 전체 | 3일 | HIGH |
| order-session.ts 분할 | orchestrator/session | 2일 | HIGH |
| Event listener 정리 패턴 적용 | barista-engine-v2, order-session | 1일 | HIGH |

### Phase 2: High (2-3주)

| 태스크 | 파일 | 예상 시간 | 영향도 |
|--------|------|----------|--------|
| `any` 타입 제거 (catch blocks) | git-worktree, desktop/main | 2일 | MEDIUM |
| Zod 검증 일관성 확보 | workflow.ts, run.ts | 2일 | MEDIUM |
| IPC 서비스 레이어 추출 | desktop/main/ipc | 3일 | HIGH |
| Waterfall async → Promise.all | barista-engine-v2 | 1일 | MEDIUM |

### Phase 3: Medium (3-4주)

| 태스크 | 파일 | 예상 시간 | 영향도 |
|--------|------|----------|--------|
| terminal-log-parser 분할 | desktop/renderer/utils | 2일 | MEDIUM |
| Provider adapter 인터페이스 분리 | orchestrator/terminal | 1일 | LOW |
| ExecutionFacade 도입 | orchestrator/facades | 2일 | MEDIUM |
| 배열 연산 최적화 | terminal-pool.ts | 1일 | LOW |

### Phase 4: Maintenance (ongoing)

| 태스크 | 주기 | 담당 |
|--------|------|------|
| Magic number 상수화 | PR 리뷰 시 | 전체 |
| TODO 이슈 전환 | 분기별 | Tech Lead |
| 타입 커버리지 모니터링 | CI/CD | 자동화 |

---

## 6. 파일별 우선순위 매트릭스

### CRITICAL (즉시)

| 파일 | 라인 | 주요 이슈 | 액션 |
|------|------|----------|------|
| `order-session.ts` | 1113 | God class, 5+ 책임 | 5개 모듈로 분할 |
| `workflow-executor.ts` | 942 | God class, any 타입 | 4개 모듈로 분할 |
| `ipc/order.ts` | 907 | Layer violation, 비즈니스 로직 혼재 | Service 레이어 추출 |

### HIGH (2주 내)

| 파일 | 라인 | 주요 이슈 | 액션 |
|------|------|----------|------|
| `claude-code-adapter.ts` | 865 | 30+ console.log, as any | Logger + 타입 정리 |
| `terminal-log-parser.ts` | 844 | 10+ 함수, 5 책임 | 5개 모듈로 분할 |
| `execution-manager.ts` | 775 | 직접 의존, 이벤트 누수 | Adapter 패턴 적용 |
| `barista-engine-v2.ts` | 675 | 30 console.log, waterfall | Logger + Promise.all |

### MEDIUM (4주 내)

| 파일 | 라인 | 주요 이슈 | 액션 |
|------|------|----------|------|
| `run.ts` | 648 | as any, Zod 미사용 | 스키마 검증 추가 |
| `ipc/workflow.ts` | 614 | Layer violation | Service 추출 |
| `dag-executor.ts` | 505 | 17 console.log, any | Logger + 타입 |
| `terminal-pool.ts` | 482 | 비효율 배열 연산 | 단일 패스 최적화 |

---

## 7. 자동화 권장사항

### ESLint 규칙 추가

```json
{
  "rules": {
    "no-console": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "max-lines": ["warn", { "max": 400 }],
    "max-lines-per-function": ["warn", { "max": 50 }]
  }
}
```

### Pre-commit Hook

```bash
# .husky/pre-commit
npx eslint --max-warnings=0 packages/*/src/**/*.ts
```

### CI 품질 게이트

```yaml
quality-gate:
  - console.log count < previous
  - any type count < previous
  - max file lines < 800
  - test coverage > 80%
```

---

*이 문서는 자동 분석을 통해 생성되었습니다.*
*생성일: 2026-01-27*
