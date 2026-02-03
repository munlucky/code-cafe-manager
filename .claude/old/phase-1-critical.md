# Phase 1: Critical 리팩토링 계획

> **기간**: 1-2주
> **목표**: 프로덕션 안정성 및 유지보수성 확보를 위한 긴급 수정
> **우선순위**: P0 (즉시 수정 필요)

---

## 1. Console.log 제거 및 Logger 도입

### 1.1 통합 Logger 서비스 구현

**목표**: 516+ console.log 인스턴스를 구조화된 로깅으로 대체

#### 체크리스트

- [ ] **Logger 인프라 구축**
  - [ ] `packages/core/src/logging/logger.ts` 생성
  - [ ] Logger 인터페이스 정의 (debug, info, warn, error, fatal)
  - [ ] 환경별 로그 레벨 설정 (development: debug, production: warn)
  - [ ] JSON 포맷 옵션 지원 (structured logging)
  - [ ] `@codecafe/core`에서 Logger export

- [ ] **packages/orchestrator 적용 (306 instances)**
  - [ ] `barista-engine-v2.ts` (30개) - Logger 교체
  - [ ] `dag-executor.ts` (17개) - Logger 교체
  - [ ] `terminal-pool.ts` (10개) - Logger 교체
  - [ ] `stage-orchestrator.ts` (6개) - Logger 교체
  - [ ] `cafe-session-manager.ts` - Logger 교체
  - [ ] `order-session.ts` - Logger 교체
  - [ ] `workflow-executor.ts` - Logger 교체
  - [ ] 나머지 파일들 일괄 교체

- [ ] **packages/desktop 적용 (210 instances)**
  - [ ] `execution-manager.ts` - Logger 교체
  - [ ] `ipc/*.ts` 전체 - Logger 교체
  - [ ] `renderer/components/*.tsx` - Logger 교체 (개발 모드만)
  - [ ] `renderer/utils/*.ts` - Logger 교체

- [ ] **검증**
  - [ ] ESLint `no-console` 규칙 활성화
  - [ ] CI에서 console.log 검출 시 빌드 실패 설정
  - [ ] 로그 레벨별 출력 테스트

#### 완료 기준

```bash
# 아래 명령 실행 시 0개 결과
grep -r "console\." packages/*/src --include="*.ts" --include="*.tsx" | wc -l
# 결과: 0
```

---

### 1.2 order-session.ts 분할 (1113줄 → 5개 모듈)

**목표**: 단일 책임 원칙 적용으로 테스트 가능성 및 유지보수성 향상

#### 현재 구조 분석

```
order-session.ts (1113줄)
├── 세션 생명주기 관리 (start, pause, resume, cancel)
├── 스테이지 조율 (stage planning, execution order)
├── 터미널 그룹 관리 (terminal acquisition, release)
├── 공유 컨텍스트 동기화 (variables, results)
└── 이벤트 전파 (session events, stage events)
```

#### 목표 구조

```
packages/orchestrator/src/session/
├── order-session.ts              (300줄, 핵심 오케스트레이션)
├── lifecycle/
│   ├── session-lifecycle.ts      (150줄, 생명주기 상태 관리)
│   └── index.ts
├── execution/
│   ├── stage-coordinator.ts      (200줄, 스테이지 조율)
│   ├── execution-planner.ts      (100줄, 실행 계획 수립)
│   └── index.ts
├── resources/
│   ├── context-manager.ts        (150줄, 컨텍스트 관리)
│   └── index.ts
└── events/
    ├── event-propagator.ts       (100줄, 이벤트 전파)
    └── index.ts
```

#### 체크리스트

- [ ] **디렉토리 구조 생성**
  - [ ] `session/lifecycle/` 디렉토리 생성
  - [ ] `session/execution/` 디렉토리 생성
  - [ ] `session/resources/` 디렉토리 생성
  - [ ] `session/events/` 디렉토리 생성

- [ ] **SessionLifecycle 추출**
  - [ ] `SessionState` enum 정의 (pending, running, paused, completed, failed, cancelled)
  - [ ] `SessionLifecycle` 클래스 생성
  - [ ] `start()`, `pause()`, `resume()`, `cancel()` 메서드 이동
  - [ ] 상태 전이 로직 캡슐화
  - [ ] 단위 테스트 작성

- [ ] **StageCoordinator 추출**
  - [ ] `StageCoordinator` 클래스 생성
  - [ ] 스테이지 실행 순서 결정 로직 이동
  - [ ] 스테이지 의존성 관리 로직 이동
  - [ ] `evaluateNextAction()` 메서드 이동
  - [ ] 단위 테스트 작성

- [ ] **ContextManager 추출** (shared-context.ts 리팩토링)
  - [ ] `ContextManager` 인터페이스 정의
  - [ ] 변수 저장/조회 로직 이동
  - [ ] 결과 동기화 로직 이동
  - [ ] 단위 테스트 작성

- [ ] **EventPropagator 추출**
  - [ ] `EventPropagator` 클래스 생성
  - [ ] 이벤트 변환 로직 이동
  - [ ] 이벤트 브로드캐스트 로직 이동
  - [ ] 리스너 등록/해제 관리
  - [ ] 단위 테스트 작성

- [ ] **OrderSession 리팩토링**
  - [ ] 추출된 모듈들을 의존성 주입으로 연결
  - [ ] 핵심 오케스트레이션 로직만 유지
  - [ ] 기존 public API 호환성 유지
  - [ ] 통합 테스트 작성

- [ ] **검증**
  - [ ] 기존 테스트 모두 통과
  - [ ] order-session.ts 300줄 이하 확인
  - [ ] 각 모듈 200줄 이하 확인
  - [ ] 순환 의존성 없음 확인

#### 완료 기준

```bash
# 파일별 라인 수 확인
wc -l packages/orchestrator/src/session/order-session.ts
# 결과: 300 이하

wc -l packages/orchestrator/src/session/*/*.ts
# 각 파일: 200 이하
```

---

### 1.3 Event Listener 정리 패턴 적용

**목표**: Memory leak 방지를 위한 이벤트 리스너 생명주기 관리

#### 체크리스트

- [ ] **EventListenerManager 유틸리티 생성**
  - [ ] `packages/core/src/utils/event-listener-manager.ts` 생성
  - [ ] `attachListener()` 메서드 구현
  - [ ] `detachAll()` 메서드 구현
  - [ ] TypeScript 제네릭 타입 지원

```typescript
// 구현 예시
interface EventListenerManager {
  attach<T extends EventEmitter>(emitter: T, event: string, handler: Function): void;
  detachAll(): void;
  getListenerCount(): number;
}
```

- [ ] **barista-engine-v2.ts 적용 (7+ listeners)**
  - [ ] 기존 `.on()` 호출을 `EventListenerManager` 사용으로 변경
  - [ ] `dispose()` 메서드에 `detachAll()` 추가
  - [ ] 테스트 작성 (리스너 정리 확인)

- [ ] **cafe-session-manager.ts 적용 (5+ listeners)**
  - [ ] `EventListenerManager` 적용
  - [ ] `cleanupSession()` 메서드에 리스너 정리 추가
  - [ ] 테스트 작성

- [ ] **order-session.ts 적용 (3+ listeners)**
  - [ ] `EventListenerManager` 적용
  - [ ] `cleanup()` 메서드에 리스너 정리 추가
  - [ ] 테스트 작성

- [ ] **terminal-pool.ts 적용**
  - [ ] lease 콜백 정리 로직 추가
  - [ ] 터미널 종료 시 리스너 정리
  - [ ] 테스트 작성

- [ ] **검증**
  - [ ] Memory leak 테스트 (heapdump 비교)
  - [ ] 장시간 실행 테스트 (메모리 사용량 모니터링)
  - [ ] dispose 후 listener count = 0 확인

#### 완료 기준

```typescript
// 테스트 코드
describe('EventListenerManager', () => {
  it('should cleanup all listeners on dispose', async () => {
    const engine = new BaristaEngineV2(config);
    await engine.executeOrder(order);
    await engine.dispose();

    expect(engine.listenerCount()).toBe(0);
    expect(sessionManager.listenerCount()).toBe(0);
  });
});
```

---

## 2. 진행 상황 추적

### 2.1 일일 체크포인트

| 일차 | 목표 | 완료 여부 |
|-----|------|----------|
| Day 1 | Logger 인프라 구축 완료 | [ ] |
| Day 2 | orchestrator console.log 50% 제거 | [ ] |
| Day 3 | orchestrator console.log 100% 제거 | [ ] |
| Day 4 | desktop console.log 100% 제거 | [ ] |
| Day 5 | order-session 디렉토리 구조 + SessionLifecycle 추출 | [ ] |
| Day 6 | StageCoordinator + ContextManager 추출 | [ ] |
| Day 7 | EventPropagator 추출 + OrderSession 리팩토링 | [ ] |
| Day 8 | EventListenerManager 구현 + barista-engine 적용 | [ ] |
| Day 9 | 나머지 파일 EventListenerManager 적용 | [ ] |
| Day 10 | 통합 테스트 + 검증 | [ ] |

### 2.2 완료 검증 체크리스트

- [ ] `grep -r "console\." packages/*/src` 결과 0개
- [ ] `order-session.ts` 라인 수 300 이하
- [ ] 모든 기존 테스트 통과
- [ ] ESLint `no-console` 규칙 통과
- [ ] Memory leak 테스트 통과
- [ ] CI 파이프라인 green

---

## 3. 롤백 계획

문제 발생 시 롤백 절차:

1. **Logger 롤백**: `git revert` 후 console.log 복원
2. **order-session 롤백**: feature branch에서 작업, 문제 시 merge 취소
3. **EventListener 롤백**: 이전 코드 복원 (breaking change 없음)

---

## 4. 리스크 및 완화 방안

| 리스크 | 확률 | 영향 | 완화 방안 |
|--------|------|------|----------|
| Logger 성능 저하 | 낮음 | 중간 | 로그 레벨로 프로덕션 최소화 |
| order-session API 변경 | 중간 | 높음 | 기존 public API 유지, deprecation 경고 |
| 테스트 커버리지 부족 | 중간 | 중간 | 리팩토링 전 테스트 추가 |

---

*문서 작성일: 2026-01-27*
*담당자: TBD*
*리뷰어: TBD*
