# Architecture Refactor Plan

> 생성일: 2026-01-28
> 상태: Planning

## 1. 개요

CodeCafe 아키텍처 분석 결과 발견된 구조적 문제점을 해결하기 위한 리팩토링 계획.

### 1.1 목표

- 레이어 간 의존성 방향 정리
- 중복 추상화 제거
- 패키지 의존성 선언/사용 일치

### 1.2 범위

| 패키지 | 변경 유형 |
|--------|----------|
| core | Orchestrator deprecated 처리 |
| orchestrator | IProviderAdapter 통합 검토 |
| provider-claude-code | 불필요 의존성 제거 |
| cli | 의존성 방향 수정 |
| desktop | 단일 Orchestrator 사용 |

---

## 2. 발견된 문제

### 2.1 Dual Orchestrator (Critical)

**현황:**
```
core.Orchestrator (Phase 1) ← cli, desktop 사용
orchestrator.ExecutionFacade (Phase 2/3) ← desktop 사용
```

**문제:**
- desktop이 두 Orchestrator를 동시에 사용
- 상태 동기화 불명확
- 코드 이해도 저하

**파일:**
- `packages/desktop/src/main/execution-manager.ts`
- `packages/desktop/src/main/index.ts`
- `packages/cli/src/commands/status.ts`

### 2.2 의존성 선언/사용 불일치 (Critical)

| 패키지 | 선언 | 실제 사용 |
|--------|------|----------|
| provider-claude-code | @codecafe/core | 미사용 |
| orchestrator | @codecafe/providers-common | 미사용 |

### 2.3 Provider 이중 인터페이스 (High)

**현황:**
```
providers-common: IProvider (정의)
orchestrator: IProviderAdapter (별도 정의)
```

**문제:**
- 역할 중복
- orchestrator가 providers-common의 IProvider를 직접 사용하지 않음

### 2.4 UI → Domain 직접 의존 (High)

**현황:**
```typescript
// cli/src/commands/status.ts
import { Orchestrator } from '@codecafe/core';  // Domain 직접 참조
```

**문제:**
- UI Layer가 Application Layer를 건너뛰고 Domain에 직접 의존
- 레이어 원칙 위반

### 2.5 Schema 패키지 비활성 (Medium)

**현황:**
- `@codecafe/schema` 선언되었으나 비어있음
- 스키마가 `core/schema/`에 산재

---

## 3. 구현 계획

### Phase A: 의존성 정리 (즉시)

#### A-1: provider-claude-code에서 core 의존성 제거

**파일:** `packages/providers/claude-code/package.json`

```diff
{
  "dependencies": {
-   "@codecafe/core": "workspace:*",
    "@codecafe/providers-common": "workspace:*",
    "node-pty": "^1.0.0"
  }
}
```

**검증:**
- [ ] `pnpm build` 성공
- [ ] 타입체크 통과

#### A-2: orchestrator의 providers-common 의존성 검토

**옵션 1:** 실제 사용하도록 수정
- IProviderAdapter를 제거하고 IProvider 직접 사용

**옵션 2:** 선언 제거
- providers-common 의존성을 package.json에서 제거

**결정 필요:** 옵션 1 권장 (중복 제거)

---

### Phase B: Orchestrator 통합 (단기)

#### B-1: core.Orchestrator deprecated 처리

**파일:** `packages/core/src/orchestrator.ts`

```typescript
/**
 * @deprecated Use ExecutionFacade from @codecafe/orchestrator instead.
 * This class will be removed in v0.2.0.
 */
export class Orchestrator { ... }
```

#### B-2: CLI 마이그레이션

**파일:** `packages/cli/src/commands/status.ts`

```diff
- import { Orchestrator } from '@codecafe/core';
+ import { ExecutionFacade } from '@codecafe/orchestrator';
```

#### B-3: Desktop 마이그레이션

**파일:** `packages/desktop/src/main/execution-manager.ts`

- core.Orchestrator 사용 부분 제거
- ExecutionFacade로 통일

**파일:** `packages/desktop/src/main/index.ts`

- Orchestrator import 제거

**검증:**
- [ ] Desktop 앱 정상 동작
- [ ] Order 생성/실행 테스트
- [ ] CLI status 명령 테스트

---

### Phase C: Provider 패턴 통합 (중기)

#### C-1: IProviderAdapter 역할 분석

**현재 구조:**
```
IProvider (providers-common)
  - run(), write(), stop(), isActive()

IProviderAdapter (orchestrator)
  - execute(), sendInput(), stop(), getOutput()
```

**통합 방안:**
1. IProvider를 확장하여 IProviderAdapter 기능 포함
2. 또는 IProviderAdapter를 IProvider 구현체로 래핑

#### C-2: Adapter 패턴 유지 여부 결정

**유지 이유:**
- Provider 구현체와 Orchestrator 간 결합도 낮춤
- 다양한 Provider 추가 시 유연성

**제거 이유:**
- 이중 추상화로 인한 복잡도
- providers-common 의존성 미사용 문제

**권장:** Adapter 유지, 단 IProvider를 실제 사용하도록 수정

---

### Phase D: Schema 패키지 활성화 (중기)

#### D-1: core/schema → schema 마이그레이션

**이동 대상:**
- `core/schema/cafe.ts`
- `core/schema/workflow.ts`
- `core/schema/role.ts`

**영향 패키지:**
- core: schema import 경로 변경
- orchestrator: schema import 경로 변경

---

## 4. 검증 체크리스트

### Phase A 완료 조건
- [ ] `pnpm build` 전체 성공
- [ ] `pnpm typecheck` 통과
- [ ] provider-claude-code에서 core import 없음

### Phase B 완료 조건
- [ ] CLI status 명령 동작
- [ ] Desktop Order 생성/실행 동작
- [ ] core.Orchestrator에 @deprecated JSDoc

### Phase C 완료 조건
- [ ] orchestrator가 IProvider 직접 사용
- [ ] providers-common 의존성 실제 사용 또는 제거

### Phase D 완료 조건
- [ ] schema 패키지에 Zod 스키마 존재
- [ ] core에서 schema 참조 제거

---

## 5. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| Desktop 기능 장애 | High | 단계별 검증, 롤백 계획 |
| 빌드 실패 | Medium | 패키지별 순차 작업 |
| 타입 불일치 | Medium | 점진적 마이그레이션 |

---

## 6. 우선순위 요약

| Phase | 우선순위 | 예상 복잡도 | 의존성 |
|-------|----------|-------------|--------|
| A-1 | Critical | Low | 없음 |
| A-2 | Critical | Medium | A-1 |
| B-1 | High | Low | 없음 |
| B-2 | High | Medium | B-1 |
| B-3 | High | Medium | B-1 |
| C-1 | Medium | High | B 완료 |
| C-2 | Medium | High | C-1 |
| D-1 | Low | Medium | B 완료 |

---

## 7. 다음 단계

1. Phase A 착수 (의존성 정리)
2. 각 Phase 완료 시 검증 수행
3. 문제 발생 시 롤백 후 원인 분석
