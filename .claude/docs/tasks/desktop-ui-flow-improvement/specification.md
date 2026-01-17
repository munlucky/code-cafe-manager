# Desktop UI 플로우 개선 명세서

## 1. 개요

### 목적
CodeCafe desktop 애플리케이션의 사용자 플로우를 재설계하여 핵심 기능인 "카페 선택 → 오더 생성 → 워크트리 자동 생성 → 터미널 모니터링" 플로우를 직관적이고 효율적으로 만듭니다.

### 범위
- 프론트엔드: UI 컴포넌트, 뷰, 라우팅, 상태 관리
- 백엔드: IPC 핸들러, 워크트리 통합, 오더 생성 로직
- 예외 처리: 워크트리 생성 실패, 터미널 오류 등

### 제외 사항
- 워크플로우 실행 엔진 자체의 변경
- 바리스타(Barista) 관리 UI (현재 기능 유지)
- 터미널 풀 아키텍처 변경

---

## 2. 현재 상태 분석

### 2.1 현재 UI 구조

```
GlobalLobby (카페 선택)
  └─> Layout + Sidebar
        ├─> Dashboard (CafeDashboard) - 카페 정보 + 오더 목록
        ├─> New Order - 워크플로우 실행 설정
        ├─> Orders - 전체 오더 목록
        └─> Worktrees - 워크트리 수동 관리
```

**파일 위치:**
- `packages/desktop/src/renderer/App.tsx` - 메인 라우팅
- `packages/desktop/src/renderer/components/layout/Sidebar.tsx` - 사이드바 네비게이션
- `packages/desktop/src/renderer/components/views/GlobalLobby.tsx` - 카페 선택 화면
- `packages/desktop/src/renderer/components/views/CafeDashboard.tsx` - 카페 대시보드
- `packages/desktop/src/renderer/components/views/NewOrder.tsx` - 워크플로우 실행
- `packages/desktop/src/renderer/components/views/Orders.tsx` - 오더 목록
- `packages/desktop/src/renderer/components/views/Worktrees.tsx` - 워크트리 관리
- `packages/desktop/src/renderer/components/terminal/TerminalPoolStatus.tsx` - 터미널 풀 상태

### 2.2 현재 데이터 흐름

```
[사용자] → GlobalLobby: 카페 선택
         → useCafeStore.selectCafe(cafeId)
         → App.tsx: currentCafeId 기반 Layout 렌더링

[사용자] → NewOrder: 워크플로우 설정
         → window.codecafe.runWorkflow(workflowId, options)
         → Orchestrator.runWorkflow()
         → (워크트리 자동 생성 없음)

[사용자] → Worktrees: 수동 워크트리 관리
         → window.codecafe.listWorktrees(repoPath)
         → WorktreeManager.listWorktrees()
```

### 2.3 현재 IPC API

**Cafe 관련:**
- `cafe:list` - 전체 카페 목록
- `cafe:get` - 특정 카페 조회
- `cafe:create` - 카페 생성 (git 프로젝트 등록)
- `cafe:update` - 카페 정보 업데이트
- `cafe:delete` - 카페 삭제
- `cafe:setLastAccessed` - 마지막 접근 카페 설정
- `cafe:getLastAccessed` - 마지막 접근 카페 조회

**Order 관련:**
- `createOrder` - 오더 생성
- `getAllOrders` - 전체 오더 목록
- `getOrder` - 특정 오더 조회
- `getOrderLog` - 오더 로그 조회
- `cancelOrder` - 오더 취소

**Worktree 관련:**
- `listWorktrees` - 워크트리 목록 조회
- `exportPatch` - 워크트리 패치 내보내기
- `removeWorktree` - 워크트리 삭제
- `openWorktreeFolder` - 워크트리 폴더 열기

**Terminal 관련:**
- `getTerminalPoolStatus` - 터미널 풀 상태 조회
- (오더별 터미널 출력 API 없음)

### 2.4 문제점

#### 핵심 문제
1. **워크트리 자동 생성 없음**: 오더 생성 시 워크트리가 자동으로 생성되지 않음
2. **터미널 모니터링 부재**: 오더별 실시간 터미널 출력을 확인할 수 있는 UI 없음
3. **불명확한 플로우**: "New Order"가 워크플로우 실행인지 오더 생성인지 혼란스러움
4. **분산된 정보**: 오더 정보(Orders), 워크트리(Worktrees), 터미널(Dashboard?) 정보가 분산되어 있음

#### UI/UX 문제
- Dashboard에서 "New Order" 버튼이 있지만 실제로는 아무 동작 안 함 (handleNewOrder가 placeholder)
- Orders 뷰에서 로그 확인이 alert으로만 가능
- Worktrees 뷰가 완전히 독립적이어서 오더와의 연관성이 보이지 않음
- TerminalPoolStatus는 provider별 통계만 보여주고 개별 오더 출력은 안 보여줌

#### 기술적 문제
- NewOrder 컴포넌트가 워크플로우 설정(provider, role, profile)에만 집중
- 오더 생성과 워크트리 생성이 통합되지 않음
- 터미널 출력을 오더별로 구독/표시하는 메커니즘 없음

---

## 3. 제안된 사용자 플로우

### 3.1 목표 플로우

```
1. [카페 선택] GlobalLobby
   ↓
2. [카페 대시보드] 카페 정보 + 오더 개요
   ↓
3. [오더 생성] 워크플로우 선택 + 설정
   ↓ (자동)
4. [워크트리 생성] order-{orderId} 브랜치 자동 생성
   ↓
5. [터미널 모니터링] 오더별 터미널 출력 실시간 확인 (N개 탭)
```

### 3.2 상세 플로우

#### 플로우 1: 카페 만들기
```
[사용자] → GlobalLobby
         → "Add Cafe" 버튼 클릭
         → 로컬 git 프로젝트 경로 입력
         → cafe:create IPC 호출
         → 카페 등록 완료
         → (자동) 해당 카페로 진입
```

**변경 사항:**
- 현재 구현되어 있음 (유지)
- 카페 생성 후 자동 진입 동작 추가

#### 플로우 2: 오더 생성 + 워크트리 자동 생성
```
[사용자] → CafeDashboard
         → "New Order" 버튼 클릭
         → NewOrderDialog 모달 표시
            - 워크플로우 선택
            - Provider/Role/Profile 설정 (선택사항)
            - 워크트리 자동 생성 옵션 (기본 ON)
         → "Create Order" 버튼 클릭
         → 백엔드 처리:
            1. createOrder 호출
            2. (조건부) 워크트리 생성
               - 브랜치명: order-{orderId}
               - Base: main (또는 설정된 baseBranch)
               - 경로: {worktreeRoot}/order-{orderId}
               - 중복 시 suffix 추가: order-{orderId}-2
            3. 오더 시작 (워크플로우 실행)
         → 성공 시:
            - Toast 알림
            - Terminals 뷰로 자동 이동 (해당 오더 탭 활성화)
         → 실패 시:
            - 에러 Toast 알림
            - 오더는 생성되지만 FAILED 상태로 기록
```

**새로운 컴포넌트:**
- `NewOrderDialog.tsx` - 오더 생성 모달 (현재 NewOrder.tsx를 모달로 변환)

**새로운 IPC API:**
- `order:createWithWorktree` - 오더 생성 + 워크트리 자동 생성 통합 API
  ```typescript
  interface CreateOrderWithWorktreeParams {
    cafeId: string;
    workflowId: string;
    workflowName: string;
    provider: string;
    vars?: Record<string, any>;
    createWorktree: boolean; // 워크트리 생성 여부
    worktreeOptions?: {
      baseBranch?: string; // 기본: cafe.settings.baseBranch
      branchPrefix?: string; // 기본: 'order'
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

#### 플로우 3: 오더별 터미널 모니터링
```
[사용자] → Sidebar "Terminals" 메뉴 클릭
         → Terminals 뷰 표시
            - 탭 목록: 현재 실행 중인 오더들 (RUNNING 상태)
            - 각 탭:
              - 헤더: Order #{orderId} - {workflowName}
              - 내용: 실시간 터미널 출력 (read-only)
              - 액션: Cancel 버튼, View Details 버튼
         → 탭 클릭 → 해당 오더의 터미널 출력 확인
         → (자동 스크롤) 새 출력 발생 시 자동으로 스크롤
```

**새로운 컴포넌트:**
- `OrderTerminals.tsx` - 오더별 터미널 탭 뷰
- `TerminalOutputPanel.tsx` - 개별 터미널 출력 패널

**새로운 IPC API / Event:**
- `order:subscribeOutput` - 특정 오더의 터미널 출력 구독
- `order:output` (event) - 터미널 출력 스트림 이벤트
  ```typescript
  interface OrderOutputEvent {
    orderId: string;
    timestamp: string;
    type: 'stdout' | 'stderr' | 'system';
    content: string;
  }
  ```

---

## 4. UI 변경 사항

### 4.1 메뉴 구조 개선

**현재:**
```
Sidebar
├─ Dashboard
├─ New Order
├─ Orders
└─ Worktrees
```

**개선안:**
```
Sidebar
├─ Dashboard (카페 개요)
├─ Orders (오더 목록 및 상세)
├─ Terminals (오더별 터미널 출력)
├─ Worktrees (워크트리 관리)
└─ Settings (카페 설정 - 선택사항)
```

**변경 이유:**
- "New Order"를 별도 메뉴에서 제거 → Dashboard의 액션 버튼으로 변경
- "Terminals"를 추가하여 오더별 터미널 모니터링 제공
- 정보 계층을 명확하게: Dashboard(개요) → Orders(상세) → Terminals(실행)

### 4.2 뷰별 상세 설계

#### 4.2.1 Dashboard (CafeDashboard.tsx)

**목적:** 카페 전체 상태 개요 제공

**구성:**
```
┌─────────────────────────────────────────────┐
│ [← Back]  Cafe Name                         │
│           /path/to/repo                     │
│                          [New Order] 버튼    │
├─────────────────────────────────────────────┤
│ Branch: main  Active Orders: 3  Base: main │
├─────────────────────────────────────────────┤
│ Recent Orders (최근 5개)                      │
│ ┌─────────────────────────────────────────┐ │
│ │ Order #123 - feature-workflow           │ │
│ │ Status: RUNNING  Started: 2m ago        │ │
│ │ [View Terminal] [Details]               │ │
│ └─────────────────────────────────────────┘ │
│ ...                                         │
│                                             │
│ Quick Stats                                 │
│ - Terminal Pool: 3 idle / 5 total          │
│ - Worktrees: 7 active                       │
└─────────────────────────────────────────────┘
```

**변경 사항:**
- "New Order" 버튼 실제 동작 연결 → NewOrderDialog 모달 오픈
- Recent Orders에 "View Terminal" 버튼 추가 → Terminals 뷰로 이동
- Quick Stats 추가 (Terminal Pool, Worktrees 요약)

#### 4.2.2 NewOrderDialog (신규)

**목적:** 오더 생성 설정

**구성:**
```
┌─────────────────────────────────────────────┐
│ Create New Order                      [X]   │
├─────────────────────────────────────────────┤
│ Workflow:                                   │
│ [v] feature-development                     │
│                                             │
│ Provider Settings (Advanced)                │
│ ┌─────────────────────────────────────────┐ │
│ │ Stage: plan                             │ │
│ │ Provider: [v] claude-code               │ │
│ │ Role: [v] planner                       │ │
│ │ Profile: [v] simple                     │ │
│ └─────────────────────────────────────────┘ │
│ (반복: code, test, check)                   │
│                                             │
│ Worktree Options                            │
│ [v] Auto-create worktree                    │
│     Branch: order-{auto}                    │
│     Base: main                              │
│                                             │
│                    [Cancel] [Create Order]  │
└─────────────────────────────────────────────┘
```

**새로운 Props:**
```typescript
interface NewOrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cafeId: string;
  onSuccess: (orderId: string) => void;
}
```

#### 4.2.3 Orders (Orders.tsx 개선)

**목적:** 전체 오더 목록 및 상세 정보

**구성:**
```
┌─────────────────────────────────────────────┐
│ All Orders                [Filter: All v]   │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ Order #123 - feature-workflow           │ │
│ │ Status: [RUNNING]  Provider: claude-code│ │
│ │ Branch: order-123                       │ │
│ │ Worktree: /path/to/worktree/order-123   │ │
│ │ Created: 10m ago  Started: 8m ago       │ │
│ │                                         │ │
│ │ [View Terminal] [View Logs] [Cancel]   │ │
│ └─────────────────────────────────────────┘ │
│ ...                                         │
└─────────────────────────────────────────────┘
```

**변경 사항:**
- 워크트리 정보 표시 (브랜치명, 경로)
- "View Terminal" 버튼 추가 → Terminals 뷰로 이동
- "View Logs" 버튼 개선 → 모달 또는 사이드 패널로 로그 표시 (alert 제거)

#### 4.2.4 Terminals (신규 - OrderTerminals.tsx)

**목적:** 오더별 실시간 터미널 출력 모니터링

**구성:**
```
┌─────────────────────────────────────────────┐
│ Order Terminals                             │
├─────────────────────────────────────────────┤
│ [Order #123] [Order #124] [Order #125]     │
│  ─────────                                  │
├─────────────────────────────────────────────┤
│ Order #123 - feature-workflow               │
│ Status: RUNNING  Started: 8m ago            │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ $ codecafe run feature-workflow         │ │
│ │ [INFO] Starting workflow...             │ │
│ │ [plan] Running stage...                 │ │
│ │ [plan] > Analyzing requirements...      │ │
│ │ [plan] ✓ Complete                       │ │
│ │ [code] Running stage...                 │ │
│ │ ...                                     │ │
│ │ ▊ (cursor - auto scroll)                │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [Pause Auto-scroll] [Copy Output] [Cancel] │
└─────────────────────────────────────────────┘
```

**기능:**
- 탭 방식으로 여러 오더의 터미널 출력 표시
- 실시간 스트림 (WebSocket 또는 IPC event 구독)
- 자동 스크롤 (토글 가능)
- ANSI 색상 지원 (선택사항)
- 오더 완료/실패 시 탭에 상태 표시

**새로운 컴포넌트:**
```typescript
// OrderTerminals.tsx
export function OrderTerminals(): JSX.Element {
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const runningOrders = useRunningOrders(); // RUNNING 상태 오더만

  return (
    <div>
      <Tabs>
        {runningOrders.map(order => (
          <Tab key={order.id} active={activeOrderId === order.id}>
            Order #{order.id}
          </Tab>
        ))}
      </Tabs>

      {activeOrderId && (
        <TerminalOutputPanel orderId={activeOrderId} />
      )}
    </div>
  );
}

// TerminalOutputPanel.tsx
interface TerminalOutputPanelProps {
  orderId: string;
}

export function TerminalOutputPanel({ orderId }: Props): JSX.Element {
  const [output, setOutput] = useState<OrderOutputEvent[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    // Subscribe to order output
    window.codecafe.subscribeOrderOutput(orderId, (event) => {
      setOutput(prev => [...prev, event]);
    });

    return () => {
      window.codecafe.unsubscribeOrderOutput(orderId);
    };
  }, [orderId]);

  // Auto-scroll logic
  useEffect(() => {
    if (autoScroll) {
      scrollToBottom();
    }
  }, [output, autoScroll]);

  return (
    <div>
      <pre>{output.map(e => e.content).join('\n')}</pre>
      <button onClick={() => setAutoScroll(!autoScroll)}>
        {autoScroll ? 'Pause' : 'Resume'} Auto-scroll
      </button>
    </div>
  );
}
```

#### 4.2.5 Worktrees (Worktrees.tsx 개선)

**목적:** 워크트리 수동 관리 (기존 기능 유지)

**변경 사항:**
- 워크트리 목록에 연결된 오더 정보 표시
  ```
  Branch: order-123
  Path: /path/to/worktree/order-123
  Order: #123 (feature-workflow) [RUNNING]
  ```
- 오더가 있는 워크트리는 삭제 시 경고 표시
- "View Order" 버튼 추가 → Orders 뷰의 해당 오더로 이동

---

## 5. 백엔드 변경 사항

### 5.1 새로운 IPC 핸들러

**파일:** `packages/desktop/src/main/ipc/order.ts` (신규)

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
      if (!cafe) {
        throw new Error(`Cafe not found: ${params.cafeId}`);
      }

      // 1. 오더 생성
      const order = await orchestrator.createOrder(
        params.workflowId,
        params.workflowName,
        'desktop-ui', // counter
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

          worktreeInfo = {
            path: worktreePath,
            branch: branchName
          };

          console.log(`[Order] Worktree created: ${branchName} at ${worktreePath}`);
        } catch (wtError: any) {
          console.error('[Order] Failed to create worktree:', wtError);
          // 워크트리 생성 실패해도 오더는 유지
          // 에러 정보를 오더에 기록할 수 있음 (선택사항)
        }
      }

      return {
        success: true,
        data: {
          order,
          worktree: worktreeInfo
        }
      };
    } catch (error: any) {
      console.error('[Order] Failed to create order with worktree:', error);
      return {
        success: false,
        error: {
          code: 'ORDER_CREATE_FAILED',
          message: error.message
        }
      };
    }
  });

  /**
   * 오더 터미널 출력 구독
   */
  ipcMain.handle('order:subscribeOutput', async (event, orderId: string) => {
    try {
      // Terminal Pool에서 해당 오더의 터미널 출력 스트림 구독
      // 이 부분은 Terminal Pool 아키텍처에 따라 구현 필요
      // 예시:
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
        error: {
          code: 'SUBSCRIBE_FAILED',
          message: error.message
        }
      };
    }
  });
}
```

### 5.2 WorktreeManager 확장

**파일:** `packages/git-worktree/src/WorktreeManager.ts`

**추가 메서드:**
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
  const { repoPath, branchName, baseBranch, worktreePath } = options;

  // 1. 브랜치 중복 확인 (필요 시 suffix 추가)
  const finalBranchName = await this.getUniqueBranchName(repoPath, branchName);

  // 2. git worktree add 실행
  await execAsync(
    `git worktree add -b ${finalBranchName} ${worktreePath} ${baseBranch}`,
    { cwd: repoPath }
  );

  console.log(`[WorktreeManager] Created worktree: ${finalBranchName} at ${worktreePath}`);
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
  const { stdout } = await execAsync('git branch --format=%(refname:short)', { cwd: repoPath });
  return stdout.trim().split('\n').filter(Boolean);
}
```

### 5.3 Preload API 확장

**파일:** `packages/desktop/src/preload/index.cts`

```typescript
export const api = {
  // ... 기존 API

  // 새로운 Order API
  createOrderWithWorktree: (params: CreateOrderWithWorktreeParams) =>
    ipcRenderer.invoke('order:createWithWorktree', params),

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

---

## 6. 에러 시나리오 및 처리

### 6.1 워크트리 생성 실패

**시나리오:**
1. 오더 생성 요청 (createWorktree: true)
2. 오더는 성공적으로 생성됨
3. 워크트리 생성 실패 (디스크 용량 부족, 권한 오류 등)

**처리:**
- 오더는 생성된 상태로 유지 (PENDING 또는 RUNNING)
- Toast 알림: "Order created, but worktree creation failed: {error message}"
- 오더 상세 화면에 워크트리 정보 없음 표시
- 사용자는 Worktrees 뷰에서 수동으로 워크트리 생성 가능

### 6.2 터미널 출력 구독 실패

**시나리오:**
1. Terminals 뷰에서 오더 선택
2. `order:subscribeOutput` 호출 실패

**처리:**
- 에러 메시지 표시: "Failed to load terminal output: {error message}"
- "Retry" 버튼 제공
- 백엔드 로그에 에러 기록

### 6.3 브랜치명 충돌

**시나리오:**
1. order-123 브랜치가 이미 존재
2. 새 오더 생성 시 같은 orderId 사용 (재시도 케이스)

**처리:**
- 자동으로 suffix 추가: order-123-2, order-123-3...
- 사용자에게 알림: "Branch 'order-123' already exists. Created 'order-123-2' instead."

### 6.4 카페 선택 없이 오더 생성 시도

**시나리오:**
1. currentCafeId가 null
2. 사용자가 직접 URL 조작으로 NewOrder 접근 (보통은 UI에서 차단됨)

**처리:**
- App.tsx에서 라우팅 레벨에서 차단 (이미 구현됨)
- 만약 API 호출되면 백엔드에서 에러 반환

---

## 7. 구현 우선순위

### Phase 1: 핵심 플로우 (필수)
1. **NewOrderDialog 컴포넌트 생성**
   - 기존 NewOrder.tsx를 모달로 변환
   - 워크트리 옵션 추가

2. **order:createWithWorktree IPC 핸들러 구현**
   - 오더 생성 + 워크트리 생성 통합
   - 에러 처리

3. **WorktreeManager.createWorktree 구현**
   - git worktree add 래퍼
   - 브랜치명 중복 처리

4. **CafeDashboard 수정**
   - "New Order" 버튼 연결
   - NewOrderDialog 오픈 로직

### Phase 2: 터미널 모니터링 (중요)
5. **OrderTerminals 뷰 구현**
   - 탭 기반 UI
   - 빈 상태 (오더 없을 때)

6. **TerminalOutputPanel 컴포넌트**
   - 터미널 출력 표시
   - 자동 스크롤

7. **order:subscribeOutput / order:output 구현**
   - Terminal Pool과 통합
   - IPC 이벤트 스트림

8. **Sidebar 메뉴 추가**
   - "Terminals" 메뉴 항목

### Phase 3: UI 개선 (중요)
9. **Orders 뷰 개선**
   - 워크트리 정보 표시
   - "View Terminal" 버튼
   - "View Logs" 모달/패널

10. **Worktrees 뷰 개선**
    - 오더 정보 표시
    - "View Order" 버튼

### Phase 4: 부가 기능 (선택사항)
11. **Settings 뷰 (선택사항)**
    - 카페별 설정 (baseBranch, worktreeRoot)

12. **ANSI 색상 지원 (선택사항)**
    - TerminalOutputPanel에서 ANSI 이스케이프 시퀀스 렌더링

13. **터미널 검색 기능 (선택사항)**
    - TerminalOutputPanel에서 Ctrl+F 검색

---

## 8. 파일 변경 목록 (예상)

### 신규 파일
```
packages/desktop/src/renderer/components/order/NewOrderDialog.tsx
packages/desktop/src/renderer/components/terminal/OrderTerminals.tsx
packages/desktop/src/renderer/components/terminal/TerminalOutputPanel.tsx
packages/desktop/src/main/ipc/order.ts
```

### 수정 파일
```
packages/desktop/src/renderer/App.tsx
  - VIEW_MAP에 'terminals' 추가

packages/desktop/src/renderer/components/layout/Sidebar.tsx
  - NAV_ITEMS에 'Terminals' 추가, 'New Order' 제거

packages/desktop/src/renderer/components/views/CafeDashboard.tsx
  - handleNewOrder 구현 (NewOrderDialog 오픈)
  - Recent Orders에 "View Terminal" 버튼 추가

packages/desktop/src/renderer/components/views/NewOrder.tsx
  - 삭제 또는 아카이브 (NewOrderDialog로 대체)

packages/desktop/src/renderer/components/views/Orders.tsx
  - 워크트리 정보 표시
  - "View Terminal", "View Logs" 버튼 추가

packages/desktop/src/renderer/components/views/Worktrees.tsx
  - 오더 정보 표시
  - "View Order" 버튼 추가

packages/desktop/src/renderer/store/useViewStore.ts
  - ViewName 타입에 'terminals' 추가

packages/desktop/src/preload/index.cts
  - createOrderWithWorktree, subscribeOrderOutput 등 API 추가

packages/desktop/src/main/index.ts
  - registerOrderHandlers 등록

packages/git-worktree/src/WorktreeManager.ts
  - createWorktree, getUniqueBranchName 메서드 추가
```

---

## 9. 검증 계획

### 수동 테스트 시나리오

**시나리오 1: 기본 플로우**
1. GlobalLobby에서 카페 선택
2. Dashboard에서 "New Order" 클릭
3. NewOrderDialog에서 워크플로우 선택, "Create Order" 클릭
4. Toast 알림 확인 ("Order created")
5. Terminals 뷰로 자동 이동 확인
6. 터미널 출력이 실시간으로 표시되는지 확인
7. 오더 완료 후 상태 업데이트 확인

**시나리오 2: 워크트리 생성**
1. 오더 생성 (createWorktree: true)
2. Worktrees 뷰에서 새 워크트리 확인
3. 브랜치명이 "order-{orderId}" 형식인지 확인
4. 워크트리 경로가 올바른지 확인

**시나리오 3: 워크트리 생성 실패 처리**
1. 잘못된 경로 설정 (권한 없음)
2. 오더 생성 시도
3. 오더는 생성되고 에러 Toast 표시되는지 확인
4. Orders 뷰에서 워크트리 정보 없음 표시 확인

**시나리오 4: 여러 오더 동시 실행**
1. 3개 오더 생성
2. Terminals 뷰에서 3개 탭 표시 확인
3. 각 탭 클릭 시 해당 오더 출력 확인
4. 자동 스크롤 동작 확인

### 자동화 테스트 (선택사항)

```typescript
// packages/desktop/src/renderer/components/order/__tests__/NewOrderDialog.test.tsx
describe('NewOrderDialog', () => {
  it('should create order with worktree when option is enabled', async () => {
    // ...
  });

  it('should show error toast when creation fails', async () => {
    // ...
  });
});

// packages/git-worktree/__tests__/WorktreeManager.test.ts
describe('WorktreeManager.createWorktree', () => {
  it('should create worktree with unique branch name', async () => {
    // ...
  });

  it('should handle branch name collision', async () => {
    // ...
  });
});
```

---

## 10. 마일스톤

### M1: 핵심 플로우 구현 (1주)
- [ ] NewOrderDialog 컴포넌트
- [ ] order:createWithWorktree IPC
- [ ] WorktreeManager.createWorktree
- [ ] CafeDashboard 통합
- [ ] 수동 테스트 (시나리오 1, 2, 3)

### M2: 터미널 모니터링 (1주)
- [ ] OrderTerminals 뷰
- [ ] TerminalOutputPanel 컴포넌트
- [ ] order:subscribeOutput / order:output
- [ ] Sidebar 메뉴 추가
- [ ] 수동 테스트 (시나리오 4)

### M3: UI 개선 (3일)
- [ ] Orders 뷰 개선
- [ ] Worktrees 뷰 개선
- [ ] 전체 플로우 통합 테스트

### M4: 부가 기능 (선택사항)
- [ ] Settings 뷰
- [ ] ANSI 색상 지원
- [ ] 터미널 검색

---

## 11. 리스크 및 의존성

### 리스크
1. **Terminal Pool 아키텍처 불명확**
   - 현재 TerminalPoolStatus가 provider별 통계만 제공
   - 개별 오더의 터미널 출력 스트림 접근 방법 확인 필요
   - **완화책:** Orchestrator 코드 리뷰 필요, 필요 시 Terminal Pool API 확장

2. **워크트리 생성 성능**
   - 대용량 저장소에서 worktree add가 느릴 수 있음
   - **완화책:** 비동기 처리, 로딩 상태 표시, 백그라운드 작업

3. **브랜치 정리 정책 부재**
   - 오더 완료 후 워크트리/브랜치 자동 삭제 여부 불명확
   - **완화책:** 초기에는 수동 삭제만 지원, 향후 자동 정리 옵션 추가

### 의존성
- `@codecafe/core` - Orchestrator API
- `@codecafe/git-worktree` - WorktreeManager
- Electron IPC 구조
- Terminal Pool 구현 (Orchestrator 내부)

---

## 12. 추후 개선 사항

### 자동 워크트리 정리
- 오더 완료/실패 후 N일 경과 시 자동 삭제
- 설정에서 정책 변경 가능

### 터미널 기록 저장
- 오더 완료 후 터미널 출력을 파일로 저장
- Orders 뷰에서 과거 로그 확인 가능

### 워크트리 상태 동기화
- 워크트리의 변경 사항(커밋, 수정 등)을 UI에 실시간 반영
- Dirty 상태 표시

### 오더 재시작
- 실패한 오더를 같은 워크트리에서 재시작
- 기존 워크트리 재사용

### 다중 카페 동시 작업
- 여러 카페의 오더를 동시에 모니터링
- 카페별 Terminals 탭 구분

---

## 부록

### A. 타입 정의

```typescript
// Order with Worktree extension
interface OrderWithWorktree extends Order {
  worktree?: {
    path: string;
    branch: string;
    isDirty: boolean;
  };
}

// Terminal Output Event
interface OrderOutputEvent {
  orderId: string;
  timestamp: string;
  type: 'stdout' | 'stderr' | 'system';
  content: string;
}

// Create Order with Worktree Params
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

// Create Order with Worktree Result
interface CreateOrderWithWorktreeResult {
  order: Order;
  worktree?: {
    path: string;
    branch: string;
  };
}
```

### B. 참고 스크린샷 (구현 후 추가)

(구현 완료 후 실제 스크린샷 첨부)

---

**문서 버전:** 1.0
**작성일:** 2026-01-15
**작성자:** Requirements Analyzer Agent
