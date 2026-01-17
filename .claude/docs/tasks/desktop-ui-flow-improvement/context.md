# Desktop UI 플로우 개선 구현 계획

> 프로젝트 규칙: `.claude/PROJECT.md`

## Metadata

- Author: Context Builder Agent
- Created: 2026-01-15
- Branch: main
- Complexity: complex
- Related doc: `.claude/docs/tasks/desktop-ui-flow-improvement/specification.md`
- **Plan Status**: APPROVED (조건부) - Phase 0 추가 필요
- **Review**: [review-v1.md](archives/review-v1.md) - 2026-01-15

## Task Overview

- **Goal**: CodeCafe desktop의 핵심 플로우("카페 선택 → 오더 생성 → 워크트리 자동 생성 → 터미널 모니터링")를 구현하여 사용자 경험 개선
- **Scope**:
  - **포함**: 프론트엔드(UI/UX 개선), 백엔드(IPC 핸들러, 워크트리 통합), 터미널 출력 모니터링
  - **제외**: 워크플로우 실행 엔진 변경, 바리스타 관리 UI, 터미널 풀 아키텍처 변경
- **Impact**: Desktop UI 전반 (뷰 5개 수정/추가, IPC 핸들러 2개 추가, WorktreeManager 확장)

## Target Files

### 신규 파일

- `packages/desktop/src/renderer/components/order/NewOrderDialog.tsx` - 오더 생성 모달 (기존 NewOrder.tsx 기반)
- `packages/desktop/src/renderer/components/terminal/OrderTerminals.tsx` - 오더별 터미널 탭 뷰
- `packages/desktop/src/renderer/components/terminal/TerminalOutputPanel.tsx` - 개별 터미널 출력 패널
- `packages/desktop/src/main/ipc/order.ts` - 오더 관련 IPC 핸들러 (createWithWorktree, subscribeOutput)

### 수정 파일

- `packages/desktop/src/renderer/App.tsx` - VIEW_MAP에 'terminals' 추가
- `packages/desktop/src/renderer/components/layout/Sidebar.tsx` - NAV_ITEMS 수정 (Terminals 추가, New Order 제거)
- `packages/desktop/src/renderer/components/views/CafeDashboard.tsx` - handleNewOrder 구현, Recent Orders UI 개선
- `packages/desktop/src/renderer/components/views/Orders.tsx` - 워크트리 정보 표시, View Terminal 버튼 추가
- `packages/desktop/src/renderer/components/views/Worktrees.tsx` - 오더 정보 표시, View Order 버튼 추가
- `packages/desktop/src/renderer/store/useViewStore.ts` - ViewName 타입에 'terminals' 추가
- `packages/desktop/src/preload/index.cts` - IPC API 확장 (createOrderWithWorktree, subscribeOrderOutput, onOrderOutput)
- `packages/desktop/src/main/index.ts` - registerOrderHandlers 등록
- `packages/git-worktree/src/WorktreeManager.ts` - createWorktree, getUniqueBranchName 메서드 추가

## 현재 상태 / 유사 기능

### 현재 UI 구조
```
GlobalLobby (카페 선택)
  └─> Layout + Sidebar
        ├─> Dashboard (CafeDashboard) - 카페 정보 + 오더 목록
        ├─> New Order - 워크플로우 실행 설정 (독립 뷰)
        ├─> Orders - 전체 오더 목록
        └─> Worktrees - 워크트리 수동 관리
```

### 문제점
1. **워크트리 자동 생성 없음**: 오더 생성 시 워크트리가 자동으로 생성되지 않음
2. **터미널 모니터링 부재**: 오더별 실시간 터미널 출력을 확인할 수 있는 UI 없음
3. **불명확한 플로우**: "New Order"가 독립 뷰로 있어서 플로우가 분산됨
4. **분산된 정보**: 오더, 워크트리, 터미널 정보가 분산되어 있음

### 재사용 가능한 패턴
- `CafeDashboard.tsx` - Order 목록 렌더링 패턴
- `Orders.tsx` - Order 상세 정보 표시
- `Worktrees.tsx` - 워크트리 목록 관리
- `TerminalPoolStatus.tsx` - 터미널 상태 표시 (참고용)

## Implementation Plan

### Phase 1: 핵심 플로우 (오더 생성 + 워크트리 자동 생성)

**목표**: 오더 생성 시 워크트리를 자동으로 생성하는 통합 플로우 구현

#### Step 1.1: WorktreeManager 확장
**파일**: `packages/git-worktree/src/WorktreeManager.ts`

**추가 메서드**:
```typescript
/**
 * 워크트리 생성
 */
static async createWorktree(options: {
  repoPath: string;
  branchName: string;
  baseBranch: string;
  worktreePath: string;
}): Promise<void> {
  // 1. 브랜치 중복 확인 (필요 시 suffix 추가)
  const finalBranchName = await this.getUniqueBranchName(repoPath, branchName);

  // 2. git worktree add 실행
  // 보안: execFileNoThrow 사용 (command injection 방지)
  const args = ['worktree', 'add', '-b', finalBranchName, worktreePath, baseBranch];
  const result = await execFileNoThrow('git', args, { cwd: repoPath });

  if (result.status !== 0) {
    throw new Error(`Failed to create worktree: ${result.stderr}`);
  }
}

/**
 * 중복되지 않는 브랜치명 생성
 */
private static async getUniqueBranchName(repoPath: string, baseName: string): Promise<string> {
  const branches = await this.listBranches(repoPath);
  let candidateName = baseName;
  let suffix = 2;

  while (branches.includes(candidateName)) {
    candidateName = `${baseName}-${suffix}`;
    suffix++;
  }

  return candidateName;
}

private static async listBranches(repoPath: string): Promise<string[]> {
  const result = await execFileNoThrow('git', ['branch', '--format=%(refname:short)'], { cwd: repoPath });
  return result.stdout.trim().split('\n').filter(Boolean);
}
```

**보안 주의사항**:
- `execFileNoThrow` 사용 (프로젝트의 `src/utils/execFileNoThrow.ts`)
- `child_process.exec()` 사용 금지 (command injection 취약점)

**검증**:
- 로컬 git 저장소에서 수동 테스트
- 브랜치 중복 시나리오 테스트 (order-123 이미 존재 시 order-123-2 생성 확인)

#### Step 1.2: IPC 핸들러 구현
**파일**: `packages/desktop/src/main/ipc/order.ts` (신규)

**구현 내용**:
```typescript
import { ipcMain } from 'electron';
import { Orchestrator } from '@codecafe/core';
import { WorktreeManager } from '@codecafe/git-worktree';
import { cafeRegistry } from './cafe';

export function registerOrderHandlers(orchestrator: Orchestrator) {
  /**
   * 오더 생성 + 워크트리 자동 생성
   */
  ipcMain.handle('order:createWithWorktree', async (_, params: CreateOrderWithWorktreeParams) => {
    try {
      const cafe = await cafeRegistry.get(params.cafeId);
      if (!cafe) throw new Error(`Cafe not found: ${params.cafeId}`);

      // 1. 오더 생성
      const order = await orchestrator.createOrder(
        params.workflowId,
        params.workflowName,
        'desktop-ui',
        params.provider,
        params.vars || {}
      );

      let worktreeInfo = null;

      // 2. 워크트리 생성 (선택적)
      if (params.createWorktree) {
        try {
          const baseBranch = params.worktreeOptions?.baseBranch || cafe.settings.baseBranch;
          const branchPrefix = params.worktreeOptions?.branchPrefix || 'order';
          const branchName = `${branchPrefix}-${order.id}`;
          const worktreePath = join(cafe.path, cafe.settings.worktreeRoot, branchName);

          await WorktreeManager.createWorktree({
            repoPath: cafe.path,
            branchName,
            baseBranch,
            worktreePath
          });

          worktreeInfo = { path: worktreePath, branch: branchName };
        } catch (wtError: any) {
          console.error('[Order] Failed to create worktree:', wtError);
          // 워크트리 생성 실패해도 오더는 유지
        }
      }

      return {
        success: true,
        data: { order, worktree: worktreeInfo }
      };
    } catch (error: any) {
      return {
        success: false,
        error: { code: 'ORDER_CREATE_FAILED', message: error.message }
      };
    }
  });
}
```

**검증**:
- `orchestrator.createOrder` API 호출 확인
- 워크트리 생성 성공/실패 시나리오 테스트

#### Step 1.3: Preload API 확장
**파일**: `packages/desktop/src/preload/index.cts`

**추가 API**:
```typescript
export const api = {
  // ... 기존 API

  // 새로운 Order API
  createOrderWithWorktree: (params: CreateOrderWithWorktreeParams) =>
    ipcRenderer.invoke('order:createWithWorktree', params),
};
```

**타입 정의** (renderer/types/ipc.d.ts 또는 별도 파일):
```typescript
interface CreateOrderWithWorktreeParams {
  cafeId: string;
  workflowId: string;
  workflowName: string;
  provider: string;
  vars?: Record<string, any>;
  createWorktree: boolean;
  worktreeOptions?: {
    baseBranch?: string;
    branchPrefix?: string;
  };
}

interface CreateOrderWithWorktreeResult {
  order: Order;
  worktree?: {
    path: string;
    branch: string;
  };
}
```

#### Step 1.4: NewOrderDialog 컴포넌트
**파일**: `packages/desktop/src/renderer/components/order/NewOrderDialog.tsx` (신규)

**구조**:
```tsx
import { useState } from 'react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Checkbox } from '../ui/Checkbox';

interface NewOrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cafeId: string;
  onSuccess: (orderId: string) => void;
}

export function NewOrderDialog({ isOpen, onClose, cafeId, onSuccess }: Props) {
  const [workflowId, setWorkflowId] = useState('');
  const [createWorktree, setCreateWorktree] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const result = await window.codecafe.createOrderWithWorktree({
        cafeId,
        workflowId,
        workflowName: 'feature-workflow', // TODO: 실제 이름
        provider: 'claude-code',
        createWorktree,
        worktreeOptions: {
          baseBranch: 'main',
          branchPrefix: 'order'
        }
      });

      if (result.success) {
        onSuccess(result.data.order.id);
        onClose();
      } else {
        // 에러 처리
        alert(`Failed: ${result.error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <Dialog.Title>Create New Order</Dialog.Title>
      <Dialog.Content>
        {/* 워크플로우 선택 */}
        <Select label="Workflow" value={workflowId} onChange={setWorkflowId}>
          {/* 워크플로우 목록 */}
        </Select>

        {/* 워크트리 옵션 */}
        <Checkbox
          checked={createWorktree}
          onChange={setCreateWorktree}
          label="Auto-create worktree"
        />

        {/* Provider 설정 (Advanced, 접을 수 있게) */}
      </Dialog.Content>
      <Dialog.Actions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={loading}>
          Create Order
        </Button>
      </Dialog.Actions>
    </Dialog>
  );
}
```

**주의사항**:
- UI 컴포넌트(Dialog, Select 등)가 없으면 간단히 구현 또는 기존 스타일 재사용
- 워크플로우 목록은 `window.codecafe.workflow.list()` 호출

#### Step 1.5: CafeDashboard 통합
**파일**: `packages/desktop/src/renderer/components/views/CafeDashboard.tsx`

**수정 내용**:
```tsx
import { NewOrderDialog } from '../order/NewOrderDialog';

export function CafeDashboard() {
  const [showNewOrderDialog, setShowNewOrderDialog] = useState(false);
  const cafe = useCafeStore(s => s.currentCafe);
  const navigate = useViewStore(s => s.setView);

  const handleNewOrder = () => {
    setShowNewOrderDialog(true);
  };

  const handleOrderCreated = (orderId: string) => {
    // 성공 토스트 표시 (선택사항)
    // Terminals 뷰로 이동
    navigate('terminals');
  };

  return (
    <div>
      {/* 기존 UI */}
      <Button onClick={handleNewOrder}>New Order</Button>

      {/* 모달 */}
      <NewOrderDialog
        isOpen={showNewOrderDialog}
        onClose={() => setShowNewOrderDialog(false)}
        cafeId={cafe.id}
        onSuccess={handleOrderCreated}
      />
    </div>
  );
}
```

#### Step 1.6: Main Process 등록
**파일**: `packages/desktop/src/main/index.ts`

**수정 내용**:
```typescript
import { registerOrderHandlers } from './ipc/order';

// ... 기존 코드

registerOrderHandlers(orchestrator);
```

**검증**:
- `pnpm typecheck` (전체 프로젝트)
- `cd packages/desktop && pnpm build`
- 수동 테스트: Dashboard → "New Order" → 모달 오픈 → 오더 생성 → Worktrees 뷰에서 워크트리 확인

---

### Phase 2: 터미널 모니터링

**목표**: 오더별 실시간 터미널 출력을 탭 방식으로 표시

#### Step 2.1: IPC 터미널 출력 구독
**파일**: `packages/desktop/src/main/ipc/order.ts` (Step 1.2에서 생성)

**추가 핸들러**:
```typescript
export function registerOrderHandlers(orchestrator: Orchestrator) {
  // ... 기존 createWithWorktree

  /**
   * 오더 터미널 출력 구독
   */
  ipcMain.handle('order:subscribeOutput', async (event, orderId: string) => {
    try {
      // Terminal Pool에서 해당 오더의 터미널 출력 스트림 구독
      // 이 부분은 Orchestrator API에 따라 구현 필요
      const terminal = await orchestrator.getOrderTerminal(orderId);
      if (!terminal) {
        throw new Error(`Terminal not found for order: ${orderId}`);
      }

      terminal.on('data', (data: string) => {
        event.sender.send('order:output', {
          orderId,
          timestamp: new Date().toISOString(),
          type: 'stdout',
          content: data
        });
      });

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: { code: 'SUBSCRIBE_FAILED', message: error.message }
      };
    }
  });
}
```

**검증**:
- Orchestrator의 `getOrderTerminal` API 존재 여부 확인 (없으면 구현 필요)
- Terminal Pool 아키텍처 리뷰 필요

**리스크**: Terminal Pool API가 불명확하면 구현 지연 가능

#### Step 2.2: Preload API 확장
**파일**: `packages/desktop/src/preload/index.cts`

**추가 API**:
```typescript
export const api = {
  // ... 기존 API

  subscribeOrderOutput: (orderId: string) =>
    ipcRenderer.invoke('order:subscribeOutput', orderId),

  onOrderOutput: (callback: (event: OrderOutputEvent) => void) => {
    ipcRenderer.on('order:output', (_, event) => callback(event));
  },

  unsubscribeOrderOutput: (orderId: string) => {
    ipcRenderer.removeAllListeners(`order:output:${orderId}`);
  }
};
```

**타입 정의**:
```typescript
interface OrderOutputEvent {
  orderId: string;
  timestamp: string;
  type: 'stdout' | 'stderr' | 'system';
  content: string;
}
```

#### Step 2.3: TerminalOutputPanel 컴포넌트
**파일**: `packages/desktop/src/renderer/components/terminal/TerminalOutputPanel.tsx` (신규)

**구현**:
```tsx
import { useEffect, useState, useRef } from 'react';

interface TerminalOutputPanelProps {
  orderId: string;
}

export function TerminalOutputPanel({ orderId }: Props) {
  const [output, setOutput] = useState<OrderOutputEvent[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const outputRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    // 구독
    window.codecafe.subscribeOrderOutput(orderId);

    const unsubscribe = window.codecafe.onOrderOutput((event) => {
      if (event.orderId === orderId) {
        setOutput(prev => [...prev, event]);
      }
    });

    return () => {
      window.codecafe.unsubscribeOrderOutput(orderId);
      // unsubscribe();
    };
  }, [orderId]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, autoScroll]);

  return (
    <div className="flex flex-col h-full">
      <pre
        ref={outputRef}
        className="flex-1 overflow-auto bg-gray-900 text-white p-4 font-mono text-sm"
      >
        {output.map((e, i) => (
          <div key={i}>{e.content}</div>
        ))}
      </pre>

      <div className="p-2 border-t">
        <button onClick={() => setAutoScroll(!autoScroll)}>
          {autoScroll ? 'Pause' : 'Resume'} Auto-scroll
        </button>
      </div>
    </div>
  );
}
```

#### Step 2.4: OrderTerminals 뷰
**파일**: `packages/desktop/src/renderer/components/terminal/OrderTerminals.tsx` (신규)

**구현**:
```tsx
import { useState, useEffect } from 'react';
import { TerminalOutputPanel } from './TerminalOutputPanel';
import { EmptyState } from '../ui/EmptyState';

export function OrderTerminals() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  useEffect(() => {
    // RUNNING 상태 오더만 가져오기
    const fetchOrders = async () => {
      const allOrders = await window.codecafe.order.getAll();
      const runningOrders = allOrders.filter(o => o.status === 'RUNNING');
      setOrders(runningOrders);

      if (runningOrders.length > 0 && !activeOrderId) {
        setActiveOrderId(runningOrders[0].id);
      }
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 3000); // 3초마다 갱신

    return () => clearInterval(interval);
  }, []);

  if (orders.length === 0) {
    return <EmptyState message="No running orders" />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* 탭 */}
      <div className="flex border-b">
        {orders.map(order => (
          <button
            key={order.id}
            onClick={() => setActiveOrderId(order.id)}
            className={cn(
              'px-4 py-2',
              activeOrderId === order.id
                ? 'border-b-2 border-coffee bg-coffee/10'
                : 'hover:bg-gray-100'
            )}
          >
            Order #{order.id}
          </button>
        ))}
      </div>

      {/* 터미널 출력 */}
      {activeOrderId && (
        <TerminalOutputPanel orderId={activeOrderId} />
      )}
    </div>
  );
}
```

#### Step 2.5: Sidebar 및 App 라우팅
**파일 1**: `packages/desktop/src/renderer/components/layout/Sidebar.tsx`

**수정**:
```tsx
const NAV_ITEMS: Array<{ view: ViewName; label: string }> = [
  { view: 'dashboard', label: 'Dashboard' },
  { view: 'orders', label: 'Orders' },
  { view: 'terminals', label: 'Terminals' }, // 추가
  { view: 'worktrees', label: 'Worktrees' },
  // 'new-order' 제거
];
```

**파일 2**: `packages/desktop/src/renderer/App.tsx`

**수정**:
```tsx
import { OrderTerminals } from './components/terminal/OrderTerminals';

const VIEW_MAP: Record<string, React.ComponentType> = {
  dashboard: Dashboard,
  orders: OrderDetail,
  terminals: OrderTerminals, // 추가
  worktrees: Worktrees,
  roles: RoleManager,
  // 'new-order' 제거 (모달로 대체)
};
```

**파일 3**: `packages/desktop/src/renderer/store/useViewStore.ts`

**수정**:
```typescript
export type ViewName =
  | 'dashboard'
  | 'orders'
  | 'terminals' // 추가
  | 'worktrees'
  | 'roles';
```

**검증**:
- `pnpm typecheck`
- Sidebar에서 "Terminals" 클릭 시 OrderTerminals 뷰 렌더링 확인
- 오더 생성 후 터미널 출력이 실시간으로 표시되는지 확인

---

### Phase 3: UI 개선

**목표**: Orders 및 Worktrees 뷰에 연관 정보 표시 및 네비게이션 추가

#### Step 3.1: Orders 뷰 개선
**파일**: `packages/desktop/src/renderer/components/views/Orders.tsx`

**추가 내용**:
1. **워크트리 정보 표시**:
   ```tsx
   {order.worktree && (
     <div className="text-sm text-gray-500">
       <div>Branch: {order.worktree.branch}</div>
       <div>Path: {order.worktree.path}</div>
     </div>
   )}
   ```

2. **"View Terminal" 버튼**:
   ```tsx
   <Button
     onClick={() => {
       navigate('terminals');
       // TODO: activeOrderId 설정 (전역 상태 또는 URL param)
     }}
   >
     View Terminal
   </Button>
   ```

3. **"View Logs" 모달** (선택사항):
   - alert 제거
   - 모달 또는 사이드 패널로 로그 표시

**검증**:
- 워크트리 정보가 있는 오더와 없는 오더 모두 확인
- "View Terminal" 클릭 시 Terminals 뷰로 이동 확인

#### Step 3.2: Worktrees 뷰 개선
**파일**: `packages/desktop/src/renderer/components/views/Worktrees.tsx`

**추가 내용**:
1. **오더 정보 표시**:
   - 워크트리 목록 조회 시 브랜치명에서 orderId 추출 (order-123 → 123)
   - 해당 오더 정보를 `window.codecafe.order.get(orderId)` 로 조회
   - UI에 표시:
     ```tsx
     {worktree.order && (
       <div className="text-sm text-gray-500">
         Order: #{worktree.order.id} - {worktree.order.workflowName}
         Status: {worktree.order.status}
       </div>
     )}
     ```

2. **"View Order" 버튼**:
   ```tsx
   <Button
     onClick={() => {
       navigate('orders');
       // TODO: 특정 오더로 스크롤 또는 필터
     }}
   >
     View Order
   </Button>
   ```

3. **삭제 시 경고**:
   - 오더가 RUNNING 상태면 삭제 시 경고 표시
   ```tsx
   const handleDelete = (worktree) => {
     if (worktree.order?.status === 'RUNNING') {
       const confirmed = confirm('Order is still running. Delete anyway?');
       if (!confirmed) return;
     }
     // 삭제 진행
   };
   ```

**검증**:
- 오더가 있는 워크트리와 없는 워크트리 모두 확인
- RUNNING 오더의 워크트리 삭제 시도 → 경고 표시 확인

#### Step 3.3: CafeDashboard Recent Orders 개선
**파일**: `packages/desktop/src/renderer/components/views/CafeDashboard.tsx`

**추가 내용**:
1. **"View Terminal" 버튼**:
   ```tsx
   <Button onClick={() => navigate('terminals')}>
     View Terminal
   </Button>
   ```

2. **Quick Stats** (선택사항):
   ```tsx
   <div className="mt-4">
     <h3>Quick Stats</h3>
     <div>Terminal Pool: {terminalPoolStatus.idle} idle / {terminalPoolStatus.total} total</div>
     <div>Worktrees: {worktrees.length} active</div>
   </div>
   ```

**검증**:
- Recent Orders에서 "View Terminal" 클릭 시 Terminals 뷰로 이동 확인

---

## Risks and Alternatives

### Risk 1: Terminal Pool 아키텍처 불명확
- **설명**: Orchestrator의 `getOrderTerminal` API가 존재하지 않거나 터미널 출력을 구독하는 메커니즘이 명확하지 않음
- **영향**: Phase 2 구현 지연 또는 차단
- **완화책**:
  - Orchestrator 코드 리뷰를 통해 Terminal Pool API 확인
  - 필요 시 Orchestrator에 API 추가 (별도 작업)
  - 임시로 로그 파일 폴링으로 대체 (성능 저하 감수)
- **대안**:
  - Order 로그 파일을 주기적으로 읽어서 표시 (실시간성 떨어짐)
  - WebSocket 기반 출력 스트림 구현 (추가 개발 필요)

### Risk 2: 워크트리 생성 성능
- **설명**: 대용량 저장소에서 `git worktree add`가 느릴 수 있음
- **영향**: 오더 생성 시 UI 응답 지연
- **완화책**:
  - 비동기 처리로 백그라운드에서 실행
  - 로딩 상태 표시 (Spinner 등)
  - Toast 알림으로 진행 상황 표시
- **대안**:
  - 워크트리 생성을 선택사항으로 유지 (기본값: ON)
  - 사용자가 원하면 수동으로 Worktrees 뷰에서 생성 가능

### Risk 3: 브랜치 정리 정책 부재
- **설명**: 오더 완료 후 워크트리/브랜치를 자동 삭제할지 수동 삭제할지 정책 미정
- **영향**: 시간이 지나면 워크트리가 누적되어 디스크 공간 소비
- **완화책**:
  - 초기에는 수동 삭제만 지원
  - Worktrees 뷰에서 쉽게 삭제 가능하도록 UI 개선
- **대안**:
  - 향후 자동 정리 옵션 추가 (오더 완료 후 N일 경과 시 자동 삭제)
  - Settings 뷰에서 정책 설정 가능하게 확장

### Risk 4: UI 컴포넌트 부재
- **설명**: Dialog, Select, Checkbox 등 UI 컴포넌트가 현재 프로젝트에 없을 수 있음
- **영향**: NewOrderDialog 구현 시 추가 작업 필요
- **완화책**:
  - 기존 스타일을 재사용하여 간단히 구현
  - 또는 headless UI 라이브러리 사용 (Radix UI, Headless UI)
- **대안**:
  - 모달 없이 기존 NewOrder.tsx를 그대로 사용 (플로우는 개선되지 않음)

---

## Dependencies

### 내부 의존성
- **Orchestrator API**:
  - `orchestrator.createOrder()` - 확인 필요
  - `orchestrator.getOrderTerminal()` - **미확인**, Orchestrator 코드 리뷰 필요
- **WorktreeManager API**:
  - 기존 `listWorktrees`, `exportPatch`, `removeWorktree` 존재
  - `createWorktree` 신규 구현 필요 (Phase 1.1)
- **Cafe Registry**:
  - `cafeRegistry.get(cafeId)` - 기존 API 사용

### 외부 의존성
- **Git**: `git worktree add` 명령어 사용 (Git 2.5+)
- **Node.js**: `execFileNoThrow` 유틸리티 (프로젝트에 존재)

### API 확인 필요 사항
- [ ] Orchestrator의 `getOrderTerminal()` API 존재 여부
- [ ] Terminal Pool에서 오더별 출력 스트림 구독 방법
- [ ] Cafe 설정에 `worktreeRoot` 필드 존재 여부 (`cafe.settings.worktreeRoot`)

---

## Checkpoints

### Phase 1 체크포인트
- [ ] WorktreeManager.createWorktree 구현 완료
- [ ] order:createWithWorktree IPC 핸들러 구현 완료
- [ ] Preload API 확장 완료
- [ ] NewOrderDialog 컴포넌트 구현 완료
- [ ] CafeDashboard 통합 완료
- [ ] Main Process 등록 완료
- [ ] **검증**:
  - [ ] `pnpm typecheck` 통과
  - [ ] `pnpm build` 성공
  - [ ] 수동 테스트: Dashboard → "New Order" → 오더 생성 → Worktrees 뷰에서 워크트리 확인

### Phase 2 체크포인트
- [ ] order:subscribeOutput IPC 핸들러 구현 완료
- [ ] Preload API 확장 (터미널 출력 구독) 완료
- [ ] TerminalOutputPanel 컴포넌트 구현 완료
- [ ] OrderTerminals 뷰 구현 완료
- [ ] Sidebar 및 App 라우팅 수정 완료
- [ ] **검증**:
  - [ ] `pnpm typecheck` 통과
  - [ ] `pnpm build` 성공
  - [ ] 수동 테스트: 오더 생성 → Terminals 뷰에서 실시간 출력 확인

### Phase 3 체크포인트
- [ ] Orders 뷰 개선 완료
- [ ] Worktrees 뷰 개선 완료
- [ ] CafeDashboard Recent Orders 개선 완료
- [ ] **검증**:
  - [ ] `pnpm typecheck` 통과
  - [ ] `pnpm build` 성공
  - [ ] 전체 플로우 통합 테스트: 카페 선택 → 오더 생성 → 터미널 모니터링 → 워크트리 확인

### 최종 검증
- [ ] 모든 Phase 완료
- [ ] 수동 테스트 시나리오 1-4 모두 통과 (specification.md 참고)
- [ ] 에러 시나리오 테스트 (워크트리 생성 실패, 터미널 구독 실패 등)
- [ ] 코드 리뷰 (선택사항)

---

## Open Questions

1. **Orchestrator의 Terminal 출력 API 확인**:
   - `orchestrator.getOrderTerminal(orderId)` API가 존재하는가?
   - 터미널 출력을 스트림으로 구독하는 메커니즘이 있는가?
   - 없다면 구현이 필요한가? (Phase 2 진행 전 확인 필요)

2. **Cafe 설정의 worktreeRoot 필드**:
   - `cafe.settings.worktreeRoot` 필드가 존재하는가?
   - 없다면 기본값은 어떻게 설정하는가? (예: `.worktrees` 디렉토리)

3. **UI 컴포넌트 라이브러리**:
   - Dialog, Select, Checkbox 등 UI 컴포넌트가 현재 프로젝트에 있는가?
   - 없다면 새로 구현하는가 아니면 라이브러리를 사용하는가?

4. **워크트리 자동 정리 정책**:
   - 오더 완료 후 워크트리를 자동으로 삭제하는가?
   - 수동 삭제만 지원하는가?
   - 향후 설정 가능하게 할 계획인가?

5. **터미널 출력 저장**:
   - 오더 완료 후 터미널 출력을 파일로 저장하는가?
   - 저장한다면 어디에 저장하는가? (`.orch/orders/{orderId}/terminal.log`)

6. **ANSI 색상 지원**:
   - TerminalOutputPanel에서 ANSI 이스케이프 시퀀스를 렌더링하는가?
   - 지원한다면 어떤 라이브러리를 사용하는가? (예: ansi-to-html)

---

## 추가 참고 사항

### 예상 작업 시간
- **Phase 1**: 2-3일 (워크트리 통합 및 오더 생성 플로우)
- **Phase 2**: 2-3일 (터미널 모니터링, Orchestrator API 확인 시간 포함)
- **Phase 3**: 1-2일 (UI 개선)
- **검증 및 테스트**: 1일
- **총 예상**: 6-9일

### 마일스톤 (Specification.md 참고)
- **M1 (1주)**: Phase 1 완료
- **M2 (1주)**: Phase 2 완료
- **M3 (3일)**: Phase 3 완료

### 후속 작업 (향후 개선 사항)
- 자동 워크트리 정리
- 터미널 기록 저장 및 과거 로그 확인
- 워크트리 상태 동기화 (Dirty 상태 표시)
- 오더 재시작 기능
- 다중 카페 동시 작업
- ANSI 색상 지원
- 터미널 검색 기능 (Ctrl+F)

---

**문서 버전**: 1.0
**작성일**: 2026-01-15
**작성자**: Context Builder Agent
**참고 문서**: `.claude/docs/tasks/desktop-ui-flow-improvement/specification.md`
