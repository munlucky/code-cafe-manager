# Desktop UI 구조 최종 문서 (현행화 완료)

> **최종 업데이트**: 2026-01-20  
> **기준 커밋**: 1f1348c (RecipeExecutor 제거 완료)

---

## ✅ 완료된 개선 작업

### 2026-01-19 커밋
- ✅ **a643e69**: Roles, Worktrees 탭 제거 (1,178줄 삭제)
- ✅ **1156724**: Workflow/Skills 레이블 명확화
- ✅ **09b3fbb**: Recipe 레이블 복원 + 툴팁 추가
- ✅ **70521d9**: Workflow Runs 탭 제거

### 2026-01-20 커밋
- ✅ **1f1348c**: RecipeExecutor 제거 (694줄 삭제, SharedContext에 통합)

**총 제거**: **1,872줄**

---

## 1. 현재 UI 구조

### 1.1 사이드바 구성 (최종)

```typescript
// Cafe별 네비게이션
const CAFE_NAV_ITEMS = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'orders', label: 'Orders', icon: List },
];

// 전역 설정
const GLOBAL_NAV_ITEMS = [
  { view: 'workflows', label: 'Recipes', icon: ChefHat, 
    tooltip: 'Workflow YAML templates' },
  { view: 'skills', label: 'Skill Library', icon: Zap, 
    tooltip: 'Individual skill definitions' },
];
```

### 1.2 UI 탭별 역할

| 탭 | 위치 | 기능 | 상태 |
|----|------|------|------|
| **Dashboard** | Cafe별 | Cafe 개요, Order 통계 | ✅ 활성 |
| **Orders** | Cafe별 | Order 생성/실행/관리 | ✅ 활성 |
| **Recipes** | Global | Workflow YAML 템플릿 관리 | ✅ 활성 |
| **Skills** | Global | Skill 라이브러리 관리 | ✅ 활성 |
| ~~Roles~~ | - | ~~Role 관리~~ | ❌ 제거 |
| ~~Worktrees~~ | - | ~~Worktree 관리~~ | ❌ 제거 |

---

## 2. Recipe ↔ Skills 아키텍처

### 2.1 개념

```
Recipe (Workflow YAML)
  └─ Skills 조합을 정의하는 템플릿
  
Skills (JSON)
  └─ 개별 작업 단위 (instructions 포함)
```

**예시**:
```yaml
# moon.workflow.yml
analyze:
  provider: claude-code
  skills:
    - classify-task
    - evaluate-complexity
```

### 2.2 실행 흐름

```
Order 생성 → Recipe 선택
  ↓
BaristaEngineV2 → Recipe YAML 로드
  ↓
각 Stage의 Skills 로드 (JSON)
  ↓
Skills Instructions → Prompt 포함
  ↓
OrderSession 실행
```

**디자인 의도**:
- ✅ 재사용성: Skills를 여러 Recipe에서 재사용
- ✅ 조합 가능성: Recipe로 다양한 Skills 조합
- ✅ 유지보수성: Skill 수정 시 모든 Recipe에 반영

---

## 3. Order 실행 흐름

### 3.1 코드 경로

```
[UI: Orders.tsx]
  ↓
window.codecafe.order.execute()
  ↓
[Main: order.ts]
  ↓
Orchestrator.executeOrder()
  ↓
[ExecutionManager]
  ↓
BaristaEngineV2.executeOrder()
  - loadDefaultWorkflow() ← YAML
  - loadSkillContent() ← Skills
  - buildStagePrompt()
  - session.execute()
  ↓
[OrderSession]
  Loop Stages:
    - terminalPool.acquireLease()
    - provider.execute()
    - SignalParser.parse()
    - handleSignals()
  ↓
[UI] Status update
```

---

## 4. 제거된 코드

### 4.1 UI 컴포넌트 (1,178줄)
- ❌ RoleManager.tsx
- ❌ Worktrees.tsx  
- ❌ OrderCreationKiosk.tsx
- ❌ useRoleStore.ts

### 4.2 RecipeExecutor (694줄)
- ❌ recipe-executor.ts
- ❌ recipe-context.ts
- ✅ SharedContext에 통합

---

## 5. 현재 아키텍처

```
orchestrator/src/
├── barista/              # BaristaEngineV2
├── session/              # OrderSession, SharedContext
├── terminal/             # TerminalPool, Providers
├── workflow/             # Workflow 로더
└── index.ts

❌ recipe/                # 제거됨!
```

---

## 6. 개선 효과

| 항목 | Before | After | 개선 |
|------|--------|-------|------|
| 코드 | ~12,000줄 | ~10,100줄 | **-16%** |
| UI 탭 | 9개 | 4개 | **-56%** |

**명확성**:
- ✅ Recipe = Workflow YAML (Skills 조합)
- ✅ Skills = 개별 작업 단위
- ✅ 단일 실행 경로

---

## 7. 사용 가이드

### Order 생성/실행
```
1. Cafe 등록 → 프로젝트 경로
2. Order 생성 → Recipe 선택
3. Order 실행 → Execute 버튼
4. 결과 확인 → Worktree
```

### Recipe/Skills 관리
```
Recipes: Stages 정의, Skills 할당
Skills: Instructions 작성
```

---

## 8. 결론

✅ **달성**: 1,872줄 제거, UI 단순화 (9→4개)  
✅ **명확화**: Recipe-Skills 아키텍처 확립  
✅ **완료**: 모든 정리 작업 완료

**현재 상태**: 안정적, 추가 작업 불필요

---

**문서 버전**: 2.0 (최종)  
**작성일**: 2026-01-20  
**상태**: ✅ 완료
