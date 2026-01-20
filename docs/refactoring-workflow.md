# 패키지 리팩토링 워크플로우

> **작성일**: 2026-01-20  
> **기준 프로젝트**: code-cafe-manager (desktop 패키지 리팩토링 사례)

---

## 개요

이 문서는 `desktop` 패키지 리팩토링 작업에서 사용된 과정을 정리한 것입니다.  
다른 패키지에도 동일한 방식으로 적용할 수 있습니다.

---

## 1. 리팩토링 워크플로우 (5단계)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. 코드베이스 분석                                              │
│    - 패키지 구조 파악                                          │
│    - 의존성/import 관계 분석                                   │
│    - 실제 사용 여부 확인                                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. UI-코드 매핑                                                 │
│    - UI 탭/뷰 → 실제 컴포넌트 매핑                             │
│    - 접근 가능 여부 확인 (사이드바, 라우팅)                    │
│    - 미사용/접근 불가 항목 식별                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. 실행 흐름 분석                                               │
│    - 핵심 기능의 코드 경로 추적                                │
│    - 불필요한 중간 레이어 식별                                 │
│    - 중복 코드/기능 발견                                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. 미사용 코드 제거                                             │
│    - UI 컴포넌트 제거                                          │
│    - Store/Hook 제거                                            │
│    - IPC 핸들러 제거                                            │
│    - 핵심 모듈 통합/제거                                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. 검증 및 문서화                                               │
│    - 타입체크 (pnpm typecheck)                                 │
│    - 빌드 검증 (pnpm build)                                    │
│    - 문서 현행화                                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Desktop 리팩토링 상세 이력

### Phase 1: 코드베이스 분석
**목적**: 전체 구조 파악 및 미사용 코드 식별

**작업 내용**:
1. 9개 패키지 구조 분석 (core, orchestrator, desktop, cli 등)
2. UI 탭별 실제 연결 확인
3. 실행 흐름 추적 (Order 생성 → 실행 → 완료)

**발견 사항**:
- Roles 탭: 사이드바에 없음 (접근 불가)
- Worktrees 탭: 사이드바에 없음 (접근 불가)
- RecipeExecutor: Desktop에서 미사용
- Workflow Runs 탭: OrderDetail 내 미사용

### Phase 2: UI 컴포넌트 정리
**커밋**: `a643e69`

```
refactor(desktop): 미사용 컴포넌트 제거 (Roles, Worktrees)

제거 파일:
- components/role/RoleManager.tsx (144줄)
- components/role/RoleCard.tsx (109줄)
- components/views/Worktrees.tsx (244줄)
- components/order/OrderCreationKiosk.tsx (332줄)
- store/useRoleStore.ts (55줄)

총: 1,178줄 삭제
```

### Phase 3: 레이블 명확화
**커밋**: `1156724`, `09b3fbb`

```
refactor(desktop): Workflow/Skills 레이블 명확화
- 'Recipes' → 'Workflow Templates' → 'Recipes' (최종)
- 툴팁 추가: "Workflow YAML templates"
- Skills → "Skill Library"

refactor(desktop): Workflow Runs 탭 제거
- OrderDetail 내 미사용 탭 제거
```

### Phase 4: 핵심 모듈 정리
**커밋**: `ee73ac8`, `de7b6ac`

```
refactor(orchestrator): remove unused RecipeExecutor module

제거 파일:
- recipe/recipe-executor.ts (375줄)
- recipe/recipe-context.ts (301줄)
- recipe/index.ts (16줄)

feat(session): add context size management to SharedContext
- RecipeContext 기능을 SharedContext에 통합

총: 694줄 삭제
```

### Phase 5: 타입 에러 수정 및 검증
**커밋**: `bbc38e7`

```
fix: 타입 에러 수정 (order-session, UI 컴포넌트)

수정 파일:
- order-session.ts: failedStageId 타입 에러
- CafeDashboard.tsx: response.data null 체크
- Orders.tsx: response.data null 체크

검증:
- pnpm typecheck ✅
- pnpm build ✅
```

---

## 3. 커밋 이력 요약

| 커밋 | 날짜 | 내용 | 삭제 줄 |
|------|------|------|---------|
| `a643e69` | 01-19 | 미사용 UI 컴포넌트 제거 | 1,178 |
| `1156724` | 01-19 | Workflow/Skills 레이블 명확화 | - |
| `09b3fbb` | 01-19 | Recipe 레이블 복원 | - |
| `70521d9` | 01-19 | Workflow Runs 탭 제거 | - |
| `ee73ac8` | 01-20 | RecipeExecutor 제거 | 694 |
| `de7b6ac` | 01-20 | SharedContext 통합 | - |
| `bbc38e7` | 01-20 | 타입 에러 수정 | - |
| **합계** | | | **1,872** |

---

## 4. 다른 패키지에 적용하기

### Step 1: 분석
```bash
# 패키지 구조 확인
ls packages/<package-name>/src/

# 의존성 확인
grep -r "import.*from" packages/<package-name>/src/

# export 확인
cat packages/<package-name>/src/index.ts
```

### Step 2: 사용 여부 확인
```bash
# 특정 함수/클래스 사용처 검색
grep -r "ClassName" packages/

# import 검색
grep -r "from '@codecafe/<package>'" packages/
```

### Step 3: 제거 및 검증
```bash
# 파일 제거 후 타입체크
pnpm typecheck

# 빌드 검증
pnpm build
```

### Step 4: 커밋
```bash
git add -A
git commit -m "refactor(<package>): 미사용 코드 제거

- 제거된 파일 목록
- 이유 설명"
```

---

## 5. 체크리스트 템플릿

### 분석 단계
- [ ] 패키지 디렉토리 구조 파악
- [ ] index.ts export 목록 확인
- [ ] 다른 패키지에서 import 사용 확인
- [ ] 실제 실행 흐름에서 사용 여부 확인

### 정리 단계
- [ ] 미사용 컴포넌트/함수 식별
- [ ] 미사용 Store/Hook 식별
- [ ] 미사용 타입 정의 식별
- [ ] 중복 기능 식별

### 제거 단계
- [ ] 미사용 파일 제거
- [ ] index.ts에서 export 제거
- [ ] 관련 import 제거
- [ ] 타입 정의 정리

### 검증 단계
- [ ] pnpm typecheck 통과
- [ ] pnpm build 통과
- [ ] pnpm test 통과 (있는 경우)
- [ ] 문서 현행화

---

## 6. 결과

### Desktop 패키지 개선 효과

| 항목 | Before | After | 개선 |
|------|--------|-------|------|
| 코드 줄 수 | ~12,000 | ~10,100 | -16% |
| UI 탭 수 | 9개 | 4개 | -56% |
| 미사용 코드 | 있음 | 없음 | ✅ |

### 최종 UI 구조
```
Dashboard  → Cafe 개요
Orders     → Order 생성/실행/관리
Recipes    → Workflow YAML 관리
Skills     → Skill 라이브러리
```

---

**문서 버전**: 1.0  
**작성일**: 2026-01-20
