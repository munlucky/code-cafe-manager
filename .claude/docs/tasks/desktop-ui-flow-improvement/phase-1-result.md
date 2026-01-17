# Phase 1 결과: 핵심 플로우 (오더 생성 + 워크트리 자동 생성)

**Date**: 2026-01-15
**Status**: ✅ 완료

## 구현 완료 항목

### 1. WorktreeManager 확장 ✅

**파일**: `packages/git-worktree/src/worktree-manager.ts`

**추가 메서드**:
- `getUniqueBranchName(repoPath, baseName)`: 브랜치 중복 확인 후 고유한 이름 생성
- `listBranches(repoPath)`: 저장소의 모든 브랜치 목록 조회

**변경 내용**:
- `createWorktree` 메서드에 브랜치 중복 확인 로직 추가
- 브랜치가 이미 존재하면 suffix 붙여서 자동 생성 (예: order-123 → order-123-2)

### 2. IPC 핸들러 구현 ✅

**파일**: `packages/desktop/src/main/ipc/order.ts` (신규)

**구현 내용**:
- `order:createWithWorktree` IPC 핸들러
- Cafe 정보 조회 (cafeRegistry 활용)
- Orchestrator를 통한 오더 생성
- WorktreeManager를 통한 워크트리 자동 생성 (선택적)
- 워크트리 생성 실패 시에도 오더는 유지 (resilient design)

**파라미터**:
```typescript
interface CreateOrderWithWorktreeParams {
  cafeId: string;
  workflowId: string;
  workflowName: string;
  provider: string;
  vars?: Record<string, string>;
  createWorktree: boolean;
  worktreeOptions?: {
    baseBranch?: string;
    branchPrefix?: string;
  };
}
```

**응답**:
```typescript
interface CreateOrderWithWorktreeResult {
  order: Order;
  worktree?: {
    path: string;
    branch: string;
  };
}
```

### 3. Preload API 확장 ✅

**파일**: `packages/desktop/src/preload/index.cts`

**추가 API**:
- `window.codecafe.order.createWithWorktree(params)`: 오더 생성 + 워크트리 자동 생성

### 4. TypeScript 타입 정의 ✅

**파일**: `packages/desktop/src/renderer/types/window.d.ts`

**추가 타입**:
- `CreateOrderWithWorktreeParams`
- `CreateOrderWithWorktreeResult`
- `window.codecafe.order` 네임스페이스 (기존 flat API는 하위 호환성 유지)

### 5. NewOrderDialog 컴포넌트 ✅

**파일**: `packages/desktop/src/renderer/components/order/NewOrderDialog.tsx` (신규)

**기능**:
- 워크플로우 선택 (드롭다운)
- Provider 선택
- 워크트리 자동 생성 옵션 (체크박스)
- 모달 UI (Backdrop + Dialog)
- 로딩 상태 표시
- 에러 처리

**UI 구조**:
```
[모달]
  - Workflow 선택 (select)
  - Provider 선택 (select)
  - Auto-create worktree (checkbox)
  - Cancel / Create Order 버튼
```

### 6. CafeDashboard 통합 ✅

**파일**: `packages/desktop/src/renderer/components/views/CafeDashboard.tsx`

**변경 내용**:
- `NewOrderDialog` import 추가
- `showNewOrderDialog` 상태 추가
- `handleNewOrder()`: 모달 오픈
- `handleOrderCreated(orderId)`: 성공 시 오더 목록 새로고침
- 모달 렌더링 추가

### 7. Main Process 등록 ✅

**파일**: `packages/desktop/src/main/index.ts`

**변경 내용**:
- `registerOrderHandlers` import
- `setupIpcHandlers()`에서 `registerOrderHandlers(orchestrator)` 호출

## 검증 결과

### pnpm typecheck ✅

```bash
$ pnpm typecheck
✅ 모든 패키지 타입 체크 통과 (에러 0개)
```

## 파일 변경 요약

### 신규 파일 (2개)
1. `packages/desktop/src/main/ipc/order.ts`
2. `packages/desktop/src/renderer/components/order/NewOrderDialog.tsx`

### 수정 파일 (5개)
1. `packages/git-worktree/src/worktree-manager.ts`
2. `packages/desktop/src/preload/index.cts`
3. `packages/desktop/src/renderer/types/window.d.ts`
4. `packages/desktop/src/renderer/components/views/CafeDashboard.tsx`
5. `packages/desktop/src/main/index.ts`

## 다음 단계

Phase 1 완료로 다음 단계 진행 가능:

**Phase 2**: 터미널 모니터링 (로그 폴링 방식)
- IPC 터미널 출력 구독 (로그 파일 기반)
- TerminalOutputPanel 컴포넌트
- OrderTerminals 뷰
- Sidebar + App 라우팅

## 주요 의사결정

1. **브랜치 중복 처리**: suffix를 붙여서 자동 생성 (order-123-2)
2. **워크트리 생성 실패 처리**: 오더는 유지, 워크트리만 실패 (resilient)
3. **모달 UI**: 별도 UI 라이브러리 없이 직접 구현 (Tailwind CSS 활용)
4. **하위 호환성**: 기존 flat API 유지, order 네임스페이스 추가

## 테스트 시나리오

Phase 1 구현으로 다음 시나리오가 가능:

1. ✅ CafeDashboard에서 "New Order" 버튼 클릭
2. ✅ NewOrderDialog 모달 오픈
3. ✅ 워크플로우 선택
4. ✅ "Auto-create worktree" 체크 (기본값: ON)
5. ✅ "Create Order" 클릭
6. ✅ 오더 생성 + 워크트리 자동 생성
7. ✅ 성공 시 오더 목록 새로고침

---

**Phase 1 완료 ✅**
