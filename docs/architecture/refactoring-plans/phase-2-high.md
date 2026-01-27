# Phase 2: High Priority 리팩토링 계획

> **기간**: 2-3주
> **목표**: 타입 안전성 강화 및 아키텍처 계층 분리
> **우선순위**: P1 (Phase 1 완료 후 진행)
> **선행 조건**: Phase 1 완료

---

## 1. `any` 타입 제거 (68+ instances)

### 1.1 Error Handling 타입 정의

**목표**: `catch (error: any)` 패턴을 타입 안전한 에러 처리로 대체

#### 체크리스트

- [ ] **Error 타입 인프라 구축**
  - [ ] `packages/core/src/errors/base-error.ts` 생성
  - [ ] `CodeCafeError` 기본 클래스 정의
  - [ ] 에러 코드 enum 정의

```typescript
// 구현할 에러 타입 계층
export abstract class CodeCafeError extends Error {
  abstract readonly code: string;
  abstract readonly isRetryable: boolean;
}

export class ProviderError extends CodeCafeError { }
export class WorktreeError extends CodeCafeError { }
export class ExecutionError extends CodeCafeError { }
export class ValidationError extends CodeCafeError { }
```

- [ ] **git-worktree 패키지 적용 (9 instances)**
  - [ ] `worktree-manager.ts:62` - `WorktreeError` 타입 적용
  - [ ] `worktree-manager.ts:77` - 에러 타입 적용
  - [ ] `worktree-manager.ts:149` - 에러 타입 적용
  - [ ] `worktree-manager.ts:174` - 에러 타입 적용
  - [ ] `worktree-manager.ts:285` - 에러 타입 적용
  - [ ] `worktree-manager.ts:297` - 에러 타입 적용
  - [ ] `worktree-manager.ts:327` - 에러 타입 적용
  - [ ] `worktree-manager.ts:361` - 에러 타입 적용
  - [ ] `worktree-manager.ts:443,489` - 에러 타입 적용

- [ ] **desktop 패키지 적용 (8 instances)**
  - [ ] `execution-manager.ts:505,580,615,632` - 에러 타입 적용
  - [ ] `ipc/dialog.ts:34,70` - 에러 타입 적용
  - [ ] 나머지 catch 블록 정리

- [ ] **isError 타입 가드 유틸리티**
  - [ ] `packages/core/src/utils/type-guards.ts` 생성
  - [ ] `isCodeCafeError()` 타입 가드 구현
  - [ ] `toCodeCafeError()` 변환 유틸리티 구현

#### 완료 기준

```bash
# catch (error: any) 패턴 검색 결과 0개
grep -r "catch (error: any)" packages/*/src | wc -l
# 결과: 0
```

---

### 1.2 Event Handler 타입 정의

**목표**: Untyped EventEmitter를 Typed EventEmitter로 교체

#### 체크리스트

- [ ] **TypedEventEmitter 구현**
  - [ ] `packages/core/src/utils/typed-event-emitter.ts` 생성
  - [ ] 제네릭 이벤트 맵 지원

```typescript
// 구현할 인터페이스
type EventMap = Record<string, (...args: any[]) => void>;

export class TypedEventEmitter<T extends EventMap> {
  on<K extends keyof T>(event: K, listener: T[K]): this;
  emit<K extends keyof T>(event: K, ...args: Parameters<T[K]>): boolean;
  off<K extends keyof T>(event: K, listener: T[K]): this;
}
```

- [ ] **Session 이벤트 타입 정의**
  - [ ] `SessionEvents` 인터페이스 정의
  - [ ] `StageEvents` 인터페이스 정의
  - [ ] `OrderEvents` 인터페이스 정의

```typescript
interface SessionEvents {
  'session:started': (data: SessionStartedData) => void;
  'session:completed': (data: SessionCompletedData) => void;
  'session:failed': (data: SessionFailedData) => void;
  'stage:started': (data: StageStartedData) => void;
  'stage:completed': (data: StageCompletedData) => void;
}
```

- [ ] **OrderSession 적용**
  - [ ] `extends TypedEventEmitter<SessionEvents>`로 변경
  - [ ] 모든 `.on()` / `.emit()` 호출 타입 검증
  - [ ] 테스트 업데이트

- [ ] **BaristaEngineV2 적용**
  - [ ] `BaristaEngineEvents` 정의
  - [ ] TypedEventEmitter 적용
  - [ ] 테스트 업데이트

- [ ] **BaristaManager 적용**
  - [ ] TypedEventEmitter 적용
  - [ ] 테스트 업데이트

#### 완료 기준

```typescript
// 컴파일 타임 타입 체크 통과
const session = new OrderSession(config);
session.on('stage:started', (data) => {
  // data는 StageStartedData 타입으로 추론됨
  console.log(data.stageId); // OK
  console.log(data.nonExistent); // 컴파일 에러
});
```

---

### 1.3 Preload Bridge 타입 강화

**목표**: `preload/index.cts`의 `any` 타입 제거

#### 체크리스트

- [ ] **IPC 타입 정의**
  - [ ] `packages/desktop/src/common/ipc-types.ts` 생성
  - [ ] 모든 IPC 채널별 Request/Response 타입 정의
  - [ ] `IpcApi` 전체 인터페이스 정의

- [ ] **Preload 타입 적용**
  - [ ] `index.cts`에서 `any` 제거
  - [ ] Callback 타입 명시
  - [ ] Event data 타입 명시

- [ ] **Renderer window.d.ts 업데이트**
  - [ ] `window.codecafe` 타입 강화
  - [ ] Event callback 타입 명시

#### 완료 기준

```bash
# preload에서 any 사용 검색 결과 0개
grep -n "any" packages/desktop/src/preload/index.cts | wc -l
# 결과: 0
```

---

## 2. Zod 검증 일관성 확보

### 2.1 YAML 파싱 검증 추가

**목표**: `yaml.load() as any` 패턴을 Zod 검증으로 대체

#### 체크리스트

- [ ] **Workflow YAML 검증**
  - [ ] `ipc/workflow.ts:235` - Zod 스키마 적용
  - [ ] `run.ts:440,469` - Zod 스키마 적용
  - [ ] `electron-api.ts:248` - Zod 스키마 적용
  - [ ] `provider/adapter.ts:31` - Zod 스키마 적용

- [ ] **Stage Profile 검증**
  - [ ] JSON Schema → Zod 마이그레이션 검토
  - [ ] 또는 AJV 검증 후 타입 assertion

- [ ] **검증 유틸리티**
  - [ ] `safeYamlLoad<T>()` 유틸리티 구현
  - [ ] 에러 메시지 포맷팅

```typescript
// 구현할 유틸리티
function safeYamlLoad<T>(
  content: string,
  schema: z.ZodType<T>
): { success: true; data: T } | { success: false; error: string };
```

#### 완료 기준

```bash
# "as any" YAML 패턴 검색 결과 0개
grep -r "yaml.load.*as any" packages/*/src | wc -l
# 결과: 0
```

---

## 3. IPC 서비스 레이어 추출

### 3.1 Order 서비스 분리

**목표**: `ipc/order.ts` (907줄)에서 비즈니스 로직 분리

#### 현재 구조

```
ipc/order.ts (907줄)
├── IPC 요청 파싱
├── 파라미터 검증
├── Worktree 생성/관리
├── Order CRUD
├── 실행 관리
├── 이벤트 구독/전파
└── 에러 처리/응답 포맷팅
```

#### 목표 구조

```
desktop/src/main/
├── ipc/
│   └── handlers/
│       └── order.handler.ts      (150줄, IPC 마샬링만)
├── services/
│   ├── order.service.ts          (300줄, Order 비즈니스 로직)
│   ├── worktree.service.ts       (150줄, Worktree 관리)
│   └── execution.service.ts      (200줄, 실행 관리)
└── bridges/
    └── order-event.bridge.ts     (100줄, 이벤트 전파)
```

#### 체크리스트

- [ ] **서비스 레이어 구조 생성**
  - [ ] `main/services/` 디렉토리 생성
  - [ ] `main/bridges/` 디렉토리 생성
  - [ ] `main/ipc/handlers/` 디렉토리 생성

- [ ] **OrderService 추출**
  - [ ] `OrderService` 클래스 생성
  - [ ] `create()`, `get()`, `getAll()`, `delete()` 메서드
  - [ ] `createWithWorktree()` 메서드
  - [ ] 단위 테스트 작성

- [ ] **ExecutionService 추출**
  - [ ] `ExecutionService` 클래스 생성
  - [ ] `execute()`, `cancel()`, `sendInput()` 메서드
  - [ ] 실행 상태 관리
  - [ ] 단위 테스트 작성

- [ ] **OrderEventBridge 추출**
  - [ ] 이벤트 구독 로직 이동
  - [ ] IPC 이벤트 전파 로직 이동
  - [ ] 리스너 정리 로직

- [ ] **IPC Handler 리팩토링**
  - [ ] 각 handler를 서비스 호출로 변경
  - [ ] 요청 파싱 + 응답 포맷팅만 담당
  - [ ] 에러 처리 일관성

- [ ] **검증**
  - [ ] `ipc/order.ts` → `ipc/handlers/order.handler.ts` 이동
  - [ ] 라인 수 150 이하 확인
  - [ ] 기존 IPC 채널 호환성 유지

#### 완료 기준

```bash
wc -l packages/desktop/src/main/ipc/handlers/order.handler.ts
# 결과: 150 이하

wc -l packages/desktop/src/main/services/order.service.ts
# 결과: 300 이하
```

---

### 3.2 Workflow 서비스 분리

**목표**: `ipc/workflow.ts` (614줄) 분리

#### 체크리스트

- [ ] **WorkflowService 추출**
  - [ ] `WorkflowService` 클래스 생성
  - [ ] CRUD 메서드 이동
  - [ ] YAML 파싱/검증 로직 이동

- [ ] **IPC Handler 리팩토링**
  - [ ] `workflow.handler.ts`로 이동
  - [ ] 서비스 호출로 변경

#### 완료 기준

```bash
wc -l packages/desktop/src/main/ipc/handlers/workflow.handler.ts
# 결과: 100 이하
```

---

## 4. Waterfall Async → Promise.all

### 4.1 Skill 로딩 병렬화

**목표**: 순차 파일 로드를 병렬 로드로 변경

#### 체크리스트

- [ ] **barista-engine-v2.ts:354-361 수정**

```typescript
// Before (순차)
for (const skillName of stageConfig.skills) {
  const skillContent = await this.loadSkillContent(skillName, projectRoot);
  if (skillContent) skillContents.push(skillContent);
}

// After (병렬)
const skillContents = (await Promise.all(
  (stageConfig.skills || []).map(name => this.loadSkillContent(name, projectRoot))
)).filter(Boolean);
```

- [ ] **dag-executor.ts 노드 실행 최적화**
  - [ ] 독립 노드 병렬 실행 가능 여부 분석
  - [ ] 의존성 없는 노드들 `Promise.all` 적용

- [ ] **workflow-executor.ts 설정 로드 최적화**
  - [ ] 설정 파일 병렬 로드

- [ ] **성능 측정**
  - [ ] 리팩토링 전/후 실행 시간 비교
  - [ ] 5개 스킬 로드 시 개선율 측정

#### 완료 기준

```typescript
// 성능 테스트
it('should load skills in parallel', async () => {
  const startTime = Date.now();
  await engine.loadStageWithSkills(5); // 5개 스킬
  const duration = Date.now() - startTime;

  // 순차: ~500ms (100ms × 5)
  // 병렬: ~100ms (최대 1개 파일 로드 시간)
  expect(duration).toBeLessThan(200);
});
```

---

## 5. 진행 상황 추적

### 5.1 주간 체크포인트

| 주차 | 목표 | 완료 여부 |
|-----|------|----------|
| Week 1 | Error 타입 정의 + git-worktree/desktop 적용 | [ ] |
| Week 1 | TypedEventEmitter 구현 | [ ] |
| Week 2 | Session/Barista 이벤트 타입 적용 | [ ] |
| Week 2 | Preload 타입 강화 | [ ] |
| Week 2 | Zod YAML 검증 적용 | [ ] |
| Week 3 | OrderService 추출 | [ ] |
| Week 3 | WorkflowService 추출 | [ ] |
| Week 3 | Promise.all 병렬화 + 검증 | [ ] |

### 5.2 완료 검증 체크리스트

- [ ] `catch (error: any)` 패턴 0개
- [ ] EventEmitter에 타입 맵 적용됨
- [ ] `yaml.load() as any` 패턴 0개
- [ ] `ipc/order.ts` 150줄 이하
- [ ] 병렬 로딩 성능 테스트 통과
- [ ] 모든 기존 테스트 통과

---

## 6. 의존성 및 선행 조건

| 태스크 | 선행 조건 |
|--------|----------|
| Error 타입 정의 | 없음 |
| TypedEventEmitter | Phase 1 EventListenerManager 완료 |
| IPC 서비스 추출 | Phase 1 order-session 분할 완료 |
| Zod 검증 | 없음 |
| Promise.all | 없음 |

---

*문서 작성일: 2026-01-27*
*담당자: TBD*
*리뷰어: TBD*
