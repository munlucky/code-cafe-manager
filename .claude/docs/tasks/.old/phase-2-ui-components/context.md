# Phase 2 UI Components Implementation Plan

## Metadata
- Author: Context Builder Agent
- Created: 2026-01-13
- Branch: main
- Complexity: medium
- Related docs: `.claude/docs/tasks/phase-2-implementation-status.md`, `.claude/docs/tasks/phase-2-split/`

## Task Overview
- Goal: Phase 2 UI Components 구현 완료 (Step 5)
- Scope: Role Manager UI, Terminal IPC, Order Creation with Role selection
- Impact: Phase 2 완료도 90% → 100%, 사용자 인터페이스 완성

## Current State
### 구현된 것
- `packages/desktop/src/main/ipc/role.ts` (임시 구현)

### 미구현된 것
1. Terminal IPC handlers
2. Role UI 컴포넌트 (RoleManager, RoleCard)
3. OrderCreationKiosk with Role selection
4. Zustand stores (useRoleStore, useTerminalStore)
5. Preload API 및 Window 타입 업데이트
6. App.tsx 라우팅 업데이트

## Implementation Plan

### Phase 1: IPC Layer 완성 (Day 1)
#### 목표: 백엔드-프론트엔드 통신 계층 구축

**참조 문서**: `.claude/docs/tasks/phase-2-split/04-ipc-ui-api-contracts.md` (Line 180-400)

**파일 생성/수정:**

1. **`packages/desktop/src/main/ipc/terminal.ts`** - Terminal Pool IPC
   - **IPC 핸들러 구현** (참조 문서 Line 212-353):
     - `terminal:init` - Terminal Pool 초기화 (TerminalPoolConfigSchema validation)
     - `terminal:pool-status` - Pool 상태 조회 (PoolStatus 반환)
     - `terminal:subscribe` - Terminal 데이터 스트림 구독
     - `terminal:unsubscribe` - 구독 해제
     - `terminal:shutdown` - Pool 종료
   - **에러 처리**: TerminalErrorCode enum, ErrorResponse 패턴 적용
   - **타입**: TerminalPoolConfig, PoolStatus import

2. **`packages/desktop/src/main/ipc/role.ts`** - 실제 RoleRegistry 연동으로 업데이트
   - **현재 상태**: 임시 구현 (Line 1-176)
   - **업데이트 항목**:
     - 실제 RoleRegistry import (`@codecafe/orchestrator/role`)
     - RoleManager 대신 RoleRegistry 사용
     - `ensureLoaded()` 로직 실제 구현
     - Zod 스키마 실제 validation 적용

3. **`packages/desktop/src/main/index.ts`** - IPC 핸들러 등록
   - `registerTerminalHandlers()` 호출 추가
   - `registerRoleHandlers()` 호출 확인

4. **`packages/desktop/src/preload/index.ts`** - window.api에 메서드 추가
   - **참조 문서 Line 360-400**:
     - `role.list()`, `role.get()`, `role.listDefault()`, `role.listUser()`, `role.reload()`
     - `terminal.init()`, `terminal.poolStatus()`, `terminal.subscribe()`, `terminal.unsubscribe()`, `terminal.shutdown()`
   - **타입**: IpcResponse<T> 인터페이스 적용

5. **`packages/desktop/src/renderer/types/window.d.ts`** - 타입 정의 업데이트
   - `window.api.role` 타입 정의
   - `window.api.terminal` 타입 정의
   - IpcResponse<T> 제네릭 타입 추가

**검증:**
- `pnpm typecheck` 통과 (packages/desktop)
- IPC 핸들러 등록 확인: `console.log(window.api)`로 메서드 존재 확인
- 기본 에러 처리 테스트: 잘못된 입력 시 ErrorResponse 반환 확인

### Phase 2: 상태 관리 및 UI 컴포넌트 (Day 2-3)
#### 목표: Role 관리 UI 구현

**참조 문서**: `.claude/docs/tasks/phase-2-split/07-implementation-sequence.md` (Line 805-862)

**파일 생성:**

1. **`packages/desktop/src/renderer/store/useRoleStore.ts`** - Role 상태 관리
   - **상태 구조**:
     ```typescript
     interface RoleStoreState {
       roles: Role[];
       loading: boolean;
       error: string | null;
       selectedRoleId: string | null;
     }
     ```
   - **액션**:
     - `loadRoles()`: `window.api.role.list()` 호출
     - `selectRole(id)`: 선택된 Role ID 설정
     - `clearError()`: 에러 초기화
   - **비동기 처리**: loading/error 상태 관리
   - **에러 처리**: ErrorResponse 패턴 처리

2. **`packages/desktop/src/renderer/components/role/RoleManager.tsx`** - Role 관리 UI
   - **참조 문서 Line 805-862**:
     - Default Roles / User Roles 구분 표시
     - Grid 레이아웃 (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
     - Loading/Error/Empty 상태 처리
     - Create Role 버튼 (기능 미구현)
   - **UI 동작**:
     - `useEffect`로 마운트 시 `loadRoles()` 호출
     - RoleCard 클릭 시 alert (TODO)
     - 에러 발생 시 사용자에게 표시

3. **`packages/desktop/src/renderer/components/role/RoleCard.tsx`** - Role 카드 컴포넌트
   - **참조 문서 Line 775-803**:
     - Role 이름, 설명, skills 표시
     - Provider badge 표시
     - 클릭 이벤트 핸들러
     - Hover 효과
   - **프롭스**:
     ```typescript
     interface RoleCardProps {
       role: Role;
       onClick: () => void;
     }
     ```

4. **`packages/desktop/src/renderer/App.tsx`** - 라우팅 업데이트
   - **현재 구조 확인 필요**: Phase 1 UI와의 통합 방식 결정
   - **라우팅 옵션**:
     - Option A: `/roles` 경로 추가 (기존 라우팅에 통합)
     - Option B: Phase 2 전용 레이아웃 생성
   - **통합 전략**: 기존 `NewOrder.tsx`와 `OrderCreationKiosk.tsx` 공존 또는 교체

**검증:**
- `/roles` 경로 접근 가능: 브라우저에서 `http://localhost:5173/roles` 접속 확인
- Role 목록 표시 확인: 5개 기본 Role (generic-agent, planner, coder, tester, reviewer) 표시
- 에러 처리 확인: 네트워크 끊김 시 에러 메시지 표시
- Loading 상태 확인: 데이터 로딩 중 로딩 인디케이터 표시

### Phase 3: Order Creation 통합 (Day 4)
#### 목표: Role 선택 기능이 있는 Order 생성 UI

**참조 문서**: `.claude/docs/tasks/phase-2-split/07-implementation-sequence.md` (Line 864-965)

**파일 생성:**

1. **`packages/desktop/src/renderer/components/order/OrderCreationKiosk.tsx`** - Role 선택 기능이 있는 Order 생성 UI
   - **참조 문서 Line 864-965**:
     - Stage 구성: stageName, roleId, baristaCount, variables
     - 동적 Stage 추가/수정 기능
     - Role 선택 드롭다운 (모든 Role 목록)
     - Barista Count 숫자 입력 (1-10)
     - Create Order 버튼 (기능 미구현)
   - **UI 동작**:
     - `useRoleStore`로 Role 목록 로드
     - Stage 추가/삭제/수정 기능
     - Role 선택 시 해당 Role의 variables 표시 (미구현)
     - Order 생성 시 console.log 출력 (TODO: IPC 연동)

2. **`packages/desktop/src/renderer/store/useTerminalStore.ts`** (옵션) - Terminal 상태 관리
   - **상태 구조**:
     ```typescript
     interface TerminalStoreState {
       poolStatus: PoolStatus | null;
       loading: boolean;
       error: string | null;
       subscribedTerminals: string[];
     }
     ```
   - **액션**:
     - `initPool(config)`: `window.api.terminal.init()` 호출
     - `getPoolStatus()`: `window.api.terminal.poolStatus()` 호출
     - `subscribeToTerminal(id)`: `window.api.terminal.subscribe()` 호출
     - `unsubscribeFromTerminal(id)`: `window.api.terminal.unsubscribe()` 호출
   - **비동기 처리**: loading/error 상태 관리

**통합 전략:**
- **Phase 1 `NewOrder.tsx`와의 관계**:
  - Option A: `OrderCreationKiosk.tsx`로 완전 교체
  - Option B: `NewOrder.tsx`는 Legacy UI로 유지, `OrderCreationKiosk.tsx`는 Phase 2 전용
  - **권장**: Option A (Phase 2 기능 완전 통합)

**검증:**
- `/orders/new` 경로 접근 가능: 브라우저에서 `http://localhost:5173/orders/new` 접속 확인
- Role 선택 드롭다운 작동 확인: 모든 Role 목록 표시, 선택 가능
- Stage 구성 확인: Stage 추가/수정/삭제 기능 작동
- UI 레이아웃 확인: Grid 레이아웃, Responsive 디자인

### Phase 4: 통합 및 검증 (Day 5)
#### 목표: 전체 통합 테스트

**검증 항목:**

1. **모든 UI 컴포넌트 렌더링 확인**
   - `/roles` 페이지: RoleManager, RoleCard 렌더링 확인
   - `/orders/new` 페이지: OrderCreationKiosk 렌더링 확인
   - Loading/Error/Empty 상태 UI 확인

2. **IPC 통신 정상 작동**
   - `window.api.role.list()` 호출 → Role 목록 반환 확인
   - `window.api.terminal.poolStatus()` 호출 → PoolStatus 반환 확인
   - 에러 처리: 잘못된 입력 시 ErrorResponse 반환 확인

3. **Type check 통과**
   - `cd packages/desktop && pnpm typecheck` 실행
   - TypeScript 컴파일 에러 없음 확인

4. **Build 성공**
   - `cd packages/desktop && pnpm build` 실행
   - Production 빌드 성공 확인

5. **기본 기능 테스트**
   - Role 목록 로드: 5개 기본 Role 표시 확인
   - Role 선택: RoleCard 클릭 시 반응 확인
   - Order Creation: Stage 추가/수정/삭제 기능 확인
   - 에러 처리: 네트워크 오류 시 사용자 피드백 확인

6. **통합 테스트 시나리오**
   ```bash
   # 1. 개발 서버 시작
   cd packages/desktop && pnpm dev

   # 2. 브라우저에서 테스트
   #    - http://localhost:5173/roles 접속 → Role 목록 확인
   #    - http://localhost:5173/orders/new 접속 → Order 생성 UI 확인
   #    - Role 선택 드롭다운 작동 확인
   #    - Stage 추가/수정 기능 확인

   # 3. 타입 체크 및 빌드
   pnpm typecheck
   pnpm build
   ```

**검증 명령어 요약:**
```bash
# Type check
cd packages/desktop && pnpm typecheck

# Build
cd packages/desktop && pnpm build

# Dev server (수동 테스트)
cd packages/desktop && pnpm dev
```

## Dependencies
- Zustand: 이미 설치됨
- Zod: 이미 설치됨
- Tailwind CSS: 이미 설치됨

## Risks and Mitigations
1. **기존 UI와의 통합 문제**: Phase 1과 Phase 2 UI 통합 전략 필요
2. **API 호환성**: window.codecafe와 window.api 통합 필요
3. **타입 안전성**: Zod validation 실제 구현 필요

## Verification Checklist

### Phase 1: IPC Layer
- [ ] `pnpm typecheck` 통과 (packages/desktop)
- [ ] `window.api.role` 메서드 존재 확인
- [ ] `window.api.terminal` 메서드 존재 확인
- [ ] IPC 핸들러 등록 확인 (main/index.ts)
- [ ] 에러 처리: 잘못된 입력 시 ErrorResponse 반환 확인

### Phase 2: Role Management UI
- [ ] `/roles` 경로 접근 가능
- [ ] 5개 기본 Role 표시 확인 (generic-agent, planner, coder, tester, reviewer)
- [ ] Loading 상태 표시 확인
- [ ] 에러 상태 표시 확인 (네트워크 끊김 테스트)
- [ ] RoleCard 클릭 반응 확인

### Phase 3: Order Creation UI
- [ ] `/orders/new` 경로 접근 가능
- [ ] Role 선택 드롭다운 작동 확인
- [ ] Stage 추가/수정/삭제 기능 확인
- [ ] Barista Count 입력 확인 (1-10)
- [ ] Create Order 버튼 클릭 반응 확인

### Phase 4: Integration
- [ ] `pnpm build` 성공 (packages/desktop)
- [ ] 모든 UI 컴포넌트 렌더링 확인
- [ ] IPC 통신 정상 작동 (실제 데이터 주고받기)
- [ ] 에러 처리 end-to-end 확인

### Overall
- [ ] TypeScript 컴파일 에러 없음
- [ ] Production 빌드 성공
- [ ] 기본 기능 테스트 통과
- [ ] 문서화 업데이트 (README 등)

## References
- `.claude/docs/tasks/phase-2-split/04-ipc-ui-api-contracts.md`
- `.claude/docs/tasks/phase-2-split/07-implementation-sequence.md`
- `.claude/docs/tasks/phase-2-implementation-status.md`