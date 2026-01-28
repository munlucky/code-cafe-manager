# Phase 3: Medium Priority 리팩토링 계획

> **기간**: 3-4주
> **목표**: 코드 구조 개선 및 패키지 결합도 감소
> **우선순위**: P2 (Phase 2 완료 후 진행)
> **선행 조건**: Phase 1, Phase 2 완료

---

## 1. terminal-log-parser.ts 분할 (844줄 → 5개 모듈)

### 1.1 현재 구조 분석

```
terminal-log-parser.ts (844줄)
├── Content Detection (파일, JSON, 에러, 코드 타입 감지)
├── Log Parsing (로그 청킹, 그룹화)
├── Summary Generation (파일, JSON, 툴 요약)
├── Badge Mapping (상태 뱃지 타입 매핑)
└── ANSI Conversion (ANSI → HTML 변환)
```

### 1.2 목표 구조

```
packages/desktop/src/renderer/utils/terminal-log/
├── index.ts                    (re-exports)
├── parser.ts                   (150줄, parseTerminalOutput, groupLogs)
├── content-detector.ts         (120줄, detectContentType, isFileContent, isJSONContent)
├── summarizer.ts               (200줄, generateSummary, summarizeFileContent)
├── tool-extractor.ts           (100줄, extractToolDetails)
└── formatter.ts                (100줄, convertAnsiToHtml, getBadgeType)
```

### 1.3 체크리스트

- [ ] **디렉토리 구조 생성**
  - [ ] `terminal-log/` 디렉토리 생성
  - [ ] `index.ts` 생성 (re-exports)

- [ ] **ContentDetector 모듈 추출**
  - [ ] `content-detector.ts` 생성
  - [ ] `detectContentType()` 함수 이동
  - [ ] `isFileContent()` 함수 이동
  - [ ] `isJSONContent()` 함수 이동
  - [ ] `isErrorContent()` 함수 이동
  - [ ] `isCodeContent()` 함수 이동
  - [ ] 단위 테스트 작성

- [ ] **Summarizer 모듈 추출**
  - [ ] `summarizer.ts` 생성
  - [ ] `generateSummary()` 함수 이동
  - [ ] `summarizeFileContent()` 함수 이동
  - [ ] `summarizeJSONContent()` 함수 이동
  - [ ] `summarizeToolOutput()` 함수 이동
  - [ ] 단위 테스트 작성

- [ ] **ToolExtractor 모듈 추출**
  - [ ] `tool-extractor.ts` 생성
  - [ ] `extractToolDetails()` 함수 이동
  - [ ] `parseToolCall()` 함수 이동
  - [ ] `parseToolResult()` 함수 이동
  - [ ] 단위 테스트 작성

- [ ] **Formatter 모듈 추출**
  - [ ] `formatter.ts` 생성
  - [ ] `convertAnsiToHtml()` 함수 이동
  - [ ] `getBadgeType()` 함수 이동
  - [ ] `formatTimestamp()` 함수 이동
  - [ ] 단위 테스트 작성

- [ ] **Parser 모듈 리팩토링**
  - [ ] `parser.ts` 생성
  - [ ] `parseTerminalOutput()` 함수 이동
  - [ ] `groupLogs()` 함수 이동
  - [ ] 다른 모듈 import로 의존성 연결
  - [ ] 단위 테스트 작성

- [ ] **기존 파일 교체**
  - [ ] `terminal-log-parser.ts` → `terminal-log/index.ts`로 re-export
  - [ ] 기존 import 경로 호환성 유지 (deprecation 경고 추가)

- [ ] **검증**
  - [ ] 모든 기존 테스트 통과
  - [ ] 각 모듈 200줄 이하 확인
  - [ ] 터미널 UI 정상 동작 확인

#### 완료 기준

```bash
wc -l packages/desktop/src/renderer/utils/terminal-log/*.ts
# 각 파일: 200 이하
# 총합: 원본보다 약간 증가 (import/export 오버헤드)
```

---

## 2. Provider Adapter 인터페이스 분리

### 2.1 현재 구조 문제

```typescript
// provider-adapter.ts - 인터페이스와 구현이 혼재
import { ClaudeCodeAdapter } from './adapters/claude-code-adapter.js';  // 구체 클래스
import { CodexAdapter } from './adapters/codex-adapter.js';              // 구체 클래스

export interface IProviderAdapter { }  // 인터페이스
export class ProviderAdapterFactory { }  // 팩토리
```

### 2.2 목표 구조

```
packages/orchestrator/src/terminal/
├── interfaces/
│   ├── index.ts
│   ├── provider-adapter.interface.ts   (IProviderAdapter, IPty, IPtyProcess)
│   └── provider-errors.ts              (ProviderError 타입들)
├── factory/
│   ├── index.ts
│   └── provider-adapter-factory.ts     (Factory만, 동적 import 사용)
└── adapters/
    ├── index.ts
    ├── claude-code-adapter.ts          (인터페이스만 import)
    └── codex-adapter.ts                (인터페이스만 import)
```

### 2.3 체크리스트

- [ ] **interfaces 디렉토리 생성**
  - [ ] `interfaces/` 디렉토리 생성
  - [ ] `provider-adapter.interface.ts` 생성
  - [ ] `IProviderAdapter` 인터페이스 이동
  - [ ] `IPty`, `IPtyProcess` 타입 이동
  - [ ] `ProviderType` 타입 이동

- [ ] **provider-errors.ts 생성**
  - [ ] `ProviderSpawnError` 클래스
  - [ ] `ProviderTimeoutError` 클래스
  - [ ] `ProviderExecutionError` 클래스

- [ ] **Factory 분리**
  - [ ] `factory/provider-adapter-factory.ts` 생성
  - [ ] 동적 import로 구체 클래스 로드

```typescript
// 동적 import로 순환 의존성 방지
export class ProviderAdapterFactory {
  static async create(type: ProviderType): Promise<IProviderAdapter> {
    switch (type) {
      case 'claude-code': {
        const { ClaudeCodeAdapter } = await import('../adapters/claude-code-adapter.js');
        return new ClaudeCodeAdapter();
      }
      case 'codex': {
        const { CodexAdapter } = await import('../adapters/codex-adapter.js');
        return new CodexAdapter();
      }
    }
  }
}
```

- [ ] **Adapter 수정**
  - [ ] `claude-code-adapter.ts` - 인터페이스 import로 변경
  - [ ] `codex-adapter.ts` - 인터페이스 import로 변경
  - [ ] `as unknown as IPtyProcess` 제거 (타입 수정)

- [ ] **기존 import 경로 호환성**
  - [ ] `provider-adapter.ts`를 re-export hub로 유지
  - [ ] deprecation 경고 추가

- [ ] **검증**
  - [ ] 순환 의존성 없음 확인 (`madge --circular`)
  - [ ] 모든 provider 테스트 통과
  - [ ] 타입 체크 통과

#### 완료 기준

```bash
# 순환 의존성 검사
npx madge --circular packages/orchestrator/src/terminal/
# 결과: No circular dependencies found
```

---

## 3. ExecutionFacade 도입

### 3.1 현재 문제

```typescript
// desktop/execution-manager.ts - 내부 모듈 직접 의존
import { BaristaEngineV2, TerminalPool } from '@codecafe/orchestrator';
// 내부 구현 변경 시 desktop도 변경 필요
```

### 3.2 목표 구조

```
packages/orchestrator/src/
├── facades/
│   ├── index.ts
│   └── execution-facade.ts     (Desktop용 안정적인 API)
└── index.ts                    (facade만 public export)
```

### 3.3 체크리스트

- [ ] **ExecutionFacade 설계**
  - [ ] `ExecutionFacadeConfig` 인터페이스 정의
  - [ ] `ExecutionFacadeEvents` 이벤트 맵 정의
  - [ ] Public API 메서드 정의

```typescript
// 구현할 Facade
export interface ExecutionFacadeConfig {
  terminalPoolConfig?: TerminalPoolConfig;
  workflowDir?: string;
}

export interface ExecutionFacadeEvents {
  'order:output': (data: OrderOutputData) => void;
  'order:started': (data: OrderStartedData) => void;
  'order:completed': (data: OrderCompletedData) => void;
  'order:failed': (data: OrderFailedData) => void;
  // ... 필요한 이벤트만 노출
}

export class ExecutionFacade extends TypedEventEmitter<ExecutionFacadeEvents> {
  constructor(config: ExecutionFacadeConfig);

  // Order 실행
  async executeOrder(order: Order, prompt: string): Promise<void>;
  async cancelOrder(orderId: string): Promise<void>;
  async sendInput(orderId: string, input: string): Promise<void>;

  // Terminal Pool
  async initTerminalPool(): Promise<void>;
  getPoolStatus(): PoolStatus;

  // Lifecycle
  async dispose(): Promise<void>;
}
```

- [ ] **ExecutionFacade 구현**
  - [ ] `facades/execution-facade.ts` 생성
  - [ ] BaristaEngineV2 래핑
  - [ ] TerminalPool 래핑
  - [ ] 이벤트 변환/전파

- [ ] **Desktop 마이그레이션**
  - [ ] `execution-manager.ts` 수정
  - [ ] BaristaEngineV2 직접 사용 → ExecutionFacade 사용
  - [ ] TerminalPool 직접 접근 제거

```typescript
// Before
import { BaristaEngineV2, TerminalPool } from '@codecafe/orchestrator';
const engine = new BaristaEngineV2(config);
const pool = new TerminalPool(poolConfig);

// After
import { ExecutionFacade } from '@codecafe/orchestrator/facades';
const execution = new ExecutionFacade(config);
```

- [ ] **Export 정리**
  - [ ] `@codecafe/orchestrator`에서 내부 모듈 export 제거
  - [ ] `@codecafe/orchestrator/facades`만 public API로 노출
  - [ ] Migration guide 문서 작성

- [ ] **검증**
  - [ ] Desktop 빌드 성공
  - [ ] 모든 Order 실행 테스트 통과
  - [ ] 이벤트 전파 정상 동작

#### 완료 기준

```typescript
// Desktop에서 orchestrator 내부 import 없음
// packages/desktop/src/ 전체에서 검색
grep -r "from '@codecafe/orchestrator'" packages/desktop/src --include="*.ts"
// 결과: facades만 import
```

---

## 4. 배열 연산 최적화

### 4.1 terminal-pool.ts 최적화

**현재 문제**: `getStatus()`에서 Provider 수 × Terminal 수만큼 반복

#### 체크리스트

- [ ] **getStatus() 최적화**

```typescript
// Before - O(P × T × 4)
for (const [provider, _] of Object.entries(this.config.perProvider)) {
  const terminals = Array.from(this.terminals.values())
    .filter(t => t.provider === provider);
  status[provider] = {
    idle: terminals.filter(t => t.status === 'idle').length,
    busy: terminals.filter(t => t.status === 'busy').length,
    crashed: terminals.filter(t => t.status === 'crashed').length,
  };
}

// After - O(T)
const statusMap = new Map<string, ProviderStatus>();
for (const [provider] of Object.entries(this.config.perProvider)) {
  statusMap.set(provider, { total: 0, idle: 0, busy: 0, crashed: 0 });
}
for (const terminal of this.terminals.values()) {
  const stats = statusMap.get(terminal.provider)!;
  stats.total++;
  stats[terminal.status]++;
}
```

- [ ] **getOrCreateTerminal() 최적화**
  - [ ] 중복 filter 제거
  - [ ] 단일 패스로 변경

- [ ] **updateMetrics() 최적화**
  - [ ] 전체 재계산 → 증분 업데이트
  - [ ] `updateMetricsIncremental()` 메서드 추가

```typescript
private updateMetricsIncremental(
  operation: 'lease-acquired' | 'lease-released',
  provider: string
): void {
  const stats = this.metrics.providers[provider];
  if (operation === 'lease-acquired') {
    stats.activeLeases++;
    stats.busyTerminals++;
    stats.idleTerminals--;
  } else {
    stats.activeLeases--;
    stats.busyTerminals--;
    stats.idleTerminals++;
  }
}
```

- [ ] **성능 테스트**
  - [ ] 100개 터미널, 5개 프로바이더 환경 테스트
  - [ ] Before/After 비교

#### 완료 기준

```typescript
// 성능 벤치마크
it('getStatus should be O(n) not O(n*m)', () => {
  const pool = createPoolWith(100, 5); // 100 terminals, 5 providers

  const start = performance.now();
  for (let i = 0; i < 1000; i++) {
    pool.getStatus();
  }
  const duration = performance.now() - start;

  expect(duration).toBeLessThan(100); // 1000회 × 100터미널 < 100ms
});
```

---

### 4.2 cafe-session-manager.ts 최적화

#### 체크리스트

- [ ] **getStatusSummary() 최적화**
  - [ ] `session.getStatus()` 캐싱
  - [ ] 불필요한 반복 제거

---

## 5. 스킬 캐싱 도입

### 5.1 LRU 캐시 구현

#### 체크리스트

- [ ] **LRU 캐시 유틸리티**
  - [ ] `packages/core/src/utils/lru-cache.ts` 생성
  - [ ] 또는 `lru-cache` 패키지 사용

- [ ] **barista-engine-v2.ts 적용**
  - [ ] `skillCache: LRUCache<string, string>` 추가
  - [ ] `loadSkillContent()` 캐시 적용
  - [ ] 캐시 무효화 전략 (파일 변경 감지 또는 TTL)

```typescript
private skillCache = new LRUCache<string, string>({
  max: 100,
  ttl: 5 * 60 * 1000 // 5분
});

private async loadSkillContent(skillName: string, projectRoot: string): Promise<string | null> {
  const cacheKey = `${skillName}:${projectRoot}`;

  const cached = this.skillCache.get(cacheKey);
  if (cached) return cached;

  const content = await this.readSkillFile(skillName, projectRoot);
  if (content) {
    this.skillCache.set(cacheKey, content);
  }
  return content;
}
```

- [ ] **캐시 메트릭 추가**
  - [ ] Hit/Miss 카운터
  - [ ] 디버그 로깅

#### 완료 기준

```typescript
it('should cache skill content', async () => {
  const engine = new BaristaEngineV2(config);

  // 첫 번째 로드
  await engine.loadSkillContent('skill1', '/project');
  expect(engine.skillCacheStats.misses).toBe(1);

  // 두 번째 로드 (캐시 히트)
  await engine.loadSkillContent('skill1', '/project');
  expect(engine.skillCacheStats.hits).toBe(1);
});
```

---

## 6. 진행 상황 추적

### 6.1 주간 체크포인트

| 주차 | 목표 | 완료 여부 |
|-----|------|----------|
| Week 1 | terminal-log-parser 분할 완료 | [x] |
| Week 2 | Provider adapter 인터페이스 분리 | [x] |
| Week 2 | ExecutionFacade 설계 + 구현 | [ ] (Phase 2 선행 조건 미충족) |
| Week 3 | Desktop ExecutionFacade 마이그레이션 | [ ] (Phase 2 선행 조건 미충족) |
| Week 3 | terminal-pool 배열 연산 최적화 | [x] |
| Week 4 | 스킬 캐싱 도입 + 검증 | [x] |

### 6.2 완료 검증 체크리스트

- [x] `terminal-log-parser.ts` 분할됨 (terminal-log/ 디렉토리, 기존 파일은 re-export hub)
- [x] `madge --circular` 순환 의존성 없음 (interfaces/ 분리로 해결)
- [ ] Desktop이 ExecutionFacade만 사용 (Phase 2 선행 조건 미충족)
- [x] terminal-pool 배열 연산 최적화됨 (getStatus() O(T), getOrCreateTerminal() 단일 패스)
- [x] 스킬 캐시 도입됨 (TTL 5분, LRU eviction)
- [ ] 모든 기존 테스트 통과 (검증 중)

---

## 7. 의존성 및 선행 조건

| 태스크 | 선행 조건 |
|--------|----------|
| terminal-log-parser 분할 | 없음 |
| Provider adapter 분리 | Phase 2 타입 정의 완료 |
| ExecutionFacade | Phase 2 IPC 서비스 추출 완료 |
| 배열 연산 최적화 | 없음 |
| 스킬 캐싱 | 없음 |

---

*문서 작성일: 2026-01-27*
*담당자: TBD*
*리뷰어: TBD*
