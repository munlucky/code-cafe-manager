# Desktop 기능 비교표 (기존 vs 리팩토링)

> **Date**: 2026-01-21
> **목적**: UI 스타일이 아닌 **실제 동작하는 기능**(버튼 클릭 → API 호출)만 비교

---

## 1. CafeDashboard 기능 비교

### 기존: `CafeDashboard.tsx` (559 lines)

| # | 기능 | 핸들러/로직 | API 호출 |
|---|-----|-----------|---------|
| 1 | Lobby로 돌아가기 | `handleBackToLobby` | setView('cafes') |
| 2 | 새 주문 다이얼로그 열기 | `handleNewOrder` | - |
| 3 | 주문 생성 완료 처리 | `handleOrderCreated` | getAllOrders() |
| 4 | 주문 상세 모달 열기 | `handleViewModal` | - |
| 5 | **주문 취소** | `handleCancelOrder` | `order.cancel(orderId)` |
| 6 | 주문 실행 다이얼로그 | `handleExecuteOrder` | - |
| 7 | 주문 실행 제출 | `handleExecuteSubmit` | `order.execute(orderId, prompt, vars)` |
| 8 | 주문 삭제 | `handleDeleteOrder` | `order.delete(orderId)` |
| 9 | **완료된 주문 일괄 삭제** | `handleClearFinished` | `order.deleteMany(orderIds)` |
| 10 | 실시간 Order 이벤트 구독 | `onOrderEvent`, `onOrderAssigned`, `onOrderCompleted` | 이벤트 리스너 |
| 11 | **Stage 이벤트 구독** | `onStageStarted`, `onStageCompleted`, `onStageFailed` | 이벤트 리스너 |
| 12 | **Stage 정보 생성** | `getStagesForOrder()` | workflow.get() |
| 13 | **Timeline 이벤트 생성** | `getTimelineForOrder()` | - |
| 14 | **보기 모드 전환** | `viewMode (grid/kanban)` | - |
| 15 | 모달에서 입력 전송 | `onSendInput` | `order.sendInput()` |

### 새: `NewCafeDashboard.tsx` (369 lines)

| # | 기능 | 핸들러/로직 | API 호출 |
|---|-----|-----------|---------|
| 1 | 새 주문 생성 | `handleCreate` | props.onCreateOrder() |
| 2 | 터미널 입력 전송 | `handleTerminalSubmit` | props.onSendInput() |
| 3 | 주문 삭제 | `onDeleteOrder` (props) | props.onDeleteOrder() |
| 4 | 주문 선택 | `setActiveOrderId` | - |
| 5 | 생성 모달 토글 | `setShowCreateModal` | - |

### 비교 결과

| 기능 | 기존 | 새 | 상태 |
|-----|-----|---|------|
| Lobby 이동 | ✅ | - | ⚠️ NewSidebar에서 처리 |
| 주문 생성 | ✅ | ✅ | ✅ |
| 주문 삭제 | ✅ | ✅ | ✅ |
| 주문 실행 (수동) | ✅ | - | ⚠️ 자동 실행으로 대체 |
| **주문 취소** | ✅ | ❌ | **❌ 누락** |
| **완료 주문 일괄 삭제** | ✅ | ❌ | **❌ 누락** |
| 입력 전송 | ✅ | ✅ | ✅ |
| **Stage 이벤트 구독** | ✅ | ❌ | **❌ 누락** |
| **Stage 진행률 표시** | ✅ | ❌ | **❌ 누락** |
| **Timeline 표시** | ✅ | ❌ | **❌ 누락** |
| **보기 모드 전환** | ✅ | ❌ | **❌ 누락** |
| 상세 모달 | ✅ | ❌ | **❌ 누락** (인라인 뷰로 대체) |

---

## 2. GlobalLobby 기능 비교

### 기존: `GlobalLobby.tsx`

| # | 기능 | 핸들러 | API 호출 |
|---|-----|-------|---------|
| 1 | Cafe 선택 | `handleCafeClick` | setCurrentCafe() |
| 2 | Cafe 추가 | `handleAddCafe` | cafe.create() |
| 3 | **Cafe 삭제** | `handleDeleteCafe` | cafe.delete() |

### 새: `NewGlobalLobby.tsx`

| # | 기능 | 핸들러 | API 호출 |
|---|-----|-------|---------|
| 1 | Cafe 선택 | `onSelectCafe` (props) | - |
| 2 | Cafe 추가 | `onCreateCafe` (props) | - |

### 비교 결과

| 기능 | 기존 | 새 | 상태 |
|-----|-----|---|------|
| Cafe 선택 | ✅ | ✅ | ✅ |
| Cafe 추가 | ✅ | ✅ | ✅ |
| **Cafe 삭제** | ✅ | ❌ | **❌ 누락** |

---

## 3. Skills 기능 비교

### 기존: `Skills.tsx`

| # | 기능 | 핸들러 | API 호출 |
|---|-----|-------|---------|
| 1 | Skill 목록 로드 | `loadSkills` | skill.list() |
| 2 | Skill 생성 | `handleNewSkill` | - (다이얼로그) |
| 3 | Skill 수정 | `handleEditSkill` | - (다이얼로그) |
| 4 | Skill 삭제 | `handleDeleteSkill` | skill.delete() |
| 5 | **Skill 복제** | `handleDuplicateSkill` | skill.create() |
| 6 | Skill 보기 | `handleViewSkill` | - |
| 7 | 카테고리 필터 | `setCategoryFilter` | - |

### 새: `NewSkills.tsx`

| # | 기능 | 핸들러 | API 호출 |
|---|-----|-------|---------|
| 1 | Skill 생성 | `handleCreate` → `handleSubmit` | props.onAddSkill() |
| 2 | Skill 수정 | `handleEdit` → `handleSubmit` | props.onUpdateSkill() |
| 3 | Skill 삭제 | `onDeleteSkill` (props) | props.onDeleteSkill() |
| 4 | 검색 | `setSearchTerm` | - |

### 비교 결과

| 기능 | 기존 | 새 | 상태 |
|-----|-----|---|------|
| Skill 생성 | ✅ | ✅ | ✅ |
| Skill 수정 | ✅ | ✅ | ✅ |
| Skill 삭제 | ✅ | ✅ | ✅ |
| **Skill 복제** | ✅ | ❌ | **❌ 누락** |
| Skill 보기 | ✅ | ⚠️ | ⚠️ 인라인 편집으로 대체 |
| **카테고리 필터** | ✅ | ❌ | **❌ 누락** (검색만 있음) |

---

## 4. Workflows 기능 비교

### 기존: `Workflows.tsx` (추정 - NewWorkflows 기반)

| # | 기능 | 설명 |
|---|-----|-----|
| 1 | Recipe 목록 | 목록 표시 |
| 2 | Recipe 생성 | 새 레시피 추가 |
| 3 | Recipe 수정 | 레시피 편집 |
| 4 | Recipe 삭제 | 레시피 삭제 |
| 5 | Stage 추가/삭제 | 단계 관리 |
| 6 | Skill 할당 | 단계에 스킬 할당 |

### 새: `NewWorkflows.tsx`

| # | 기능 | 핸들러 | API 호출 |
|---|-----|-------|---------|
| 1 | Recipe 생성 | `handleSave` (새 레시피) | props.onAddRecipe() |
| 2 | Recipe 수정 | `handleSave` (기존 레시피) | props.onUpdateRecipe() |
| 3 | Recipe 삭제 | `onDeleteRecipe` (props) | props.onDeleteRecipe() |
| 4 | **Protected Recipe 복사** | `handleConfirmCopy` | props.onAddRecipe() |
| 5 | Stage 추가 | `addStage` | - |
| 6 | Stage 삭제 | `removeStage` | - |
| 7 | Skill 할당 | `addSkillToStage` | - |
| 8 | Skill 제거 | `removeSkillFromStage` | - |
| 9 | 검색 | `setSearchTerm` | - |

### 비교 결과

| 기능 | 기존 | 새 | 상태 |
|-----|-----|---|------|
| Recipe CRUD | ✅ | ✅ | ✅ |
| Stage 관리 | ✅ | ✅ | ✅ |
| Skill 할당 | ✅ | ✅ | ✅ |
| Protected Copy | ? | ✅ | ✅ 개선됨 |

---

## 5. Sidebar 기능 비교

### 기존: `Sidebar.tsx`

| # | 기능 | 설명 |
|---|-----|-----|
| 1 | Global 메뉴 (Lobby, Recipes, Skills) | 네비게이션 |
| 2 | Cafe 목록 | Cafe 선택 |
| 3 | Settings | 설정 페이지 |

### 새: `NewSidebar.tsx`

| # | 기능 | 핸들러 | 동작 |
|---|-----|-------|-----|
| 1 | Global 메뉴 | `onMenuSelect` | Lobby/Recipes/Skills 이동 |
| 2 | Cafe 목록 | `onSelectCafe` | Cafe 대시보드 이동 |
| 3 | Cafe 추가 | `onAddCafe` | Lobby의 추가 폼으로 연결 |
| 4 | Settings | - | **UI만 존재 (기능 없음)** |

### 비교 결과

| 기능 | 기존 | 새 | 상태 |
|-----|-----|---|------|
| Global 메뉴 | ✅ | ✅ | ✅ |
| Cafe 선택 | ✅ | ✅ | ✅ |
| **Settings** | ✅ | ⚠️ | **⚠️ UI만 존재** |

---

## 6. 누락 기능 요약

### 🔴 Critical (핵심 기능 누락)

| 컴포넌트 | 누락 기능 | 영향 |
|---------|---------|-----|
| NewCafeDashboard | **Order 취소** (`order.cancel`) | 실행 중인 주문 제어 불가 |
| NewCafeDashboard | **Stage 이벤트 구독** | 진행 상황 추적 불가 |
| NewCafeDashboard | **Stage 진행률 표시** | 사용자가 현재 단계 파악 불가 |
| NewGlobalLobby | **Cafe 삭제** | Cafe 정리 불가 |

### 🟡 Medium (사용성 저하)

| 컴포넌트 | 누락 기능 | 영향 |
|---------|---------|-----|
| NewCafeDashboard | 완료 주문 일괄 삭제 | 정리 불편 |
| NewCafeDashboard | Grid/Kanban 모드 전환 | 보기 옵션 제한 |
| NewCafeDashboard | Timeline 표시 | 이벤트 추적 제한 |
| NewSkills | Skill 복제 | 빠른 생성 불가 |
| NewSkills | 카테고리 필터 | 검색 효율 저하 |

### 🟢 Low (기능 대체됨)

| 컴포넌트 | 변경 | 설명 |
|---------|-----|-----|
| NewCafeDashboard | 수동 실행 → 자동 실행 | 생성 시 바로 실행 |
| NewCafeDashboard | 모달 → 인라인 뷰 | 패널 기반 UI |
| NewSidebar | Lobby 버튼 → 메뉴 | Sidebar에서 직접 이동 |

---

## 7. 권장 조치

### 즉시 추가 필요

```tsx
// NewCafeDashboard.tsx에 추가 필요
interface NewCafeDashboardProps {
  // ... 기존 props
  onCancelOrder: (orderId: string) => void;     // 추가
  onClearFinished: () => void;                  // 추가
}

// NewGlobalLobby.tsx에 추가 필요
interface NewGlobalLobbyProps {
  // ... 기존 props
  onDeleteCafe: (id: string) => void;           // 추가
}
```

### App.tsx 핸들러 추가 필요

```tsx
// App.tsx에서 구현 필요
const handleCancelOrder = async (orderId: string) => {
  await window.codecafe.order.cancel(orderId);
  // orders 상태 업데이트
};

const handleClearFinished = async () => {
  const finishedIds = orders
    .filter(o => ['COMPLETED', 'FAILED', 'CANCELLED'].includes(o.status))
    .map(o => o.id);
  await window.codecafe.order.deleteMany(finishedIds);
};

const handleDeleteCafe = async (cafeId: string) => {
  await window.codecafe.cafe.delete(cafeId);
  // cafes 상태 업데이트
};
```

---

## 8. 기능 구현 체크리스트

### Order 관리
- [x] Order 생성
- [x] Order 삭제
- [x] Order 실행 (자동)
- [ ] **Order 취소**
- [ ] **완료 주문 일괄 삭제**
- [x] 입력 전송 (WAITING_INPUT)
- [ ] **Stage 진행률 표시**
- [ ] **Timeline 이벤트 표시**
- [ ] **Stage 이벤트 구독**
- [ ] **Grid/Kanban 보기 모드**

### Cafe 관리
- [x] Cafe 목록
- [x] Cafe 생성
- [x] Cafe 선택
- [ ] **Cafe 삭제**

### Recipe 관리
- [x] Recipe CRUD
- [x] Stage 관리
- [x] Skill 할당
- [x] Protected Recipe 복사

### Skill 관리
- [x] Skill CRUD
- [ ] **Skill 복제**
- [ ] **카테고리 필터**

### 기타
- [ ] **Settings 페이지 연결**

---

**Generated**: 2026-01-21
