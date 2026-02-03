# @codecafe/desktop 리팩토링 계획

> 작성일: 2026-02-02
> 패키지 경로: `packages/desktop/`
> 기술 스택: Electron, React 18, Zustand, Tailwind CSS

---

## 1. 개요

`@codecafe/desktop`은 CodeCafe의 Electron 기반 데스크톱 애플리케이션입니다. Main Process(Node.js), Preload(Context Bridge), Renderer(React)의 3계층 구조로 되어 있으며, IPC를 통해 orchestrator와 통신합니다.

### 핵심 문제 요약

| 우선순위 | 이슈 | 영향 범위 | 예상 공수 |
|---------|------|----------|----------|
| **P0** | 거대 클래스 (727줄) | execution-manager.ts | 4-6시간 |
| **P0** | Production console.log | 2곳 | 30분 |
| **P1** | 긴 컴포넌트 (400-536줄) | 3개 파일 | 6-8시간 |
| **P1** | IPC 핸들러 중복 | 2개 파일, 40줄+ | 2시간 |
| **P2** | Zustand 최적화 누락 | 전체 스토어 | 3-4시간 |
| **P2** | React 안티패턴 | 여러 컴포넌트 | 2-3시간 |
| **P2** | 타입 안전성 | 7곳+ | 2시간 |
| **P3** | Missing memoization | 6곳+ | 1시간 |

---

## 2. Critical Issues (P0)

### 2.1 execution-manager.ts 분할 (727줄)

**위치**: `src/main/execution-manager.ts`

**문제**: 12개 이벤트 핸들러, 3개 실행 경로가 단일 클래스에 혼재

**현재 구조**:
```
ExecutionManager (727줄)
├── setupExecutionFacadeEvents() - 198줄, 12개 이벤트
├── handleOrderInput() - 102줄, 3개 경로
├── restoreSessionsForWorktreeOrders() - 71줄
└── 기타 메서드들
```

**After**: 이벤트 핸들러 분리
```typescript
// src/main/handlers/order-event-handler.ts (신규)
export class OrderEventHandler {
  constructor(
    private readonly facade: ExecutionFacade,
    private readonly mainWindow: BrowserWindow,
  ) {}

  setup(): void {
    this.facade.on('order:started', this.handleOrderStarted.bind(this));
    this.facade.on('order:output', this.handleOrderOutput.bind(this));
    this.facade.on('order:completed', this.handleOrderCompleted.bind(this));
    this.facade.on('order:failed', this.handleOrderFailed.bind(this));
  }

  private handleOrderStarted(data: OrderStartedEvent): void {
    this.mainWindow.webContents.send('order:started', data);
  }

  private handleOrderOutput(data: OrderOutputEvent): void {
    this.mainWindow.webContents.send('order:output', data);
  }
  // ...
}

// src/main/handlers/stage-event-handler.ts (신규)
export class StageEventHandler {
  // stage:* 이벤트 처리
}

// src/main/handlers/session-event-handler.ts (신규)
export class SessionEventHandler {
  // session:* 이벤트 처리
}

// execution-manager.ts (리팩토링 후)
export class ExecutionManager {
  private handlers: EventHandler[] = [];

  async start(): Promise<void> {
    this.handlers = [
      new OrderEventHandler(this.facade, this.mainWindow),
      new StageEventHandler(this.facade, this.mainWindow),
      new SessionEventHandler(this.facade, this.mainWindow),
    ];

    this.handlers.forEach(h => h.setup());
  }
}
```

**목표**: 727줄 → 200줄 미만 (핸들러 3개 파일로 분리)

---

### 2.2 Production console.log 제거

**위치**: `src/renderer/components/views/NewCafeDashboard.tsx:89, 94`

**문제**: 개발용 로그가 프로덕션에 노출

**Before**:
```typescript
console.log('[NewCafeDashboard] stage_end event:', event);
console.log('[NewCafeDashboard] 완료된 stage 이후 todo 제거 - stageId:', stageId);
```

**After**:
```typescript
// src/renderer/utils/logger.ts (신규)
const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  debug: isDev ? console.log.bind(console) : () => {},
  info: isDev ? console.info.bind(console) : () => {},
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

// NewCafeDashboard.tsx
import { logger } from '@/utils/logger';

logger.debug('[NewCafeDashboard] stage_end event:', event);
```

---

## 3. High Priority Issues (P1)

### 3.1 긴 컴포넌트 분할

#### A. `ThinkingBlock.tsx` (536줄)

**위치**: `src/renderer/components/terminal/ThinkingBlock.tsx`

**문제**: Stage 정보 추출, 아이콘 렌더링, 타임라인이 단일 컴포넌트에 혼재

**After**: 하위 컴포넌트 추출
```typescript
// src/renderer/components/terminal/thinking/StageHeader.tsx (신규)
interface StageHeaderProps {
  stage: StageInfo;
  isExpanded: boolean;
  onToggle: () => void;
}

export function StageHeader({ stage, isExpanded, onToggle }: StageHeaderProps) {
  return (
    <div className="stage-header" onClick={onToggle}>
      <StageIcon status={stage.status} />
      <span>{stage.name}</span>
      <ExpandIcon expanded={isExpanded} />
    </div>
  );
}

// src/renderer/components/terminal/thinking/StageTimeline.tsx (신규)
interface StageTimelineProps {
  stages: StageInfo[];
  currentStageId: string | null;
}

export function StageTimeline({ stages, currentStageId }: StageTimelineProps) {
  return (
    <div className="stage-timeline">
      {stages.map(stage => (
        <TimelineItem
          key={stage.id}
          stage={stage}
          isCurrent={stage.id === currentStageId}
        />
      ))}
    </div>
  );
}

// src/renderer/components/terminal/thinking/SkillsList.tsx (신규)
export function SkillsList({ skills }: { skills: Skill[] }) {
  return (
    <ul className="skills-list">
      {skills.map(skill => (
        <li key={skill.id}>{skill.name}</li>
      ))}
    </ul>
  );
}

// ThinkingBlock.tsx (리팩토링 후)
import { StageHeader } from './thinking/StageHeader';
import { StageTimeline } from './thinking/StageTimeline';
import { SkillsList } from './thinking/SkillsList';

export function ThinkingBlock({ content }: ThinkingBlockProps) {
  const stageInfo = useStageInfo(content);

  return (
    <div className="thinking-block">
      <StageHeader stage={stageInfo.current} />
      <StageTimeline stages={stageInfo.stages} />
      {stageInfo.current?.skills && (
        <SkillsList skills={stageInfo.current.skills} />
      )}
    </div>
  );
}
```

**목표**: 536줄 → 150줄 (4개 파일로 분리)

---

#### B. `CodeBlock.tsx` (394줄)

**위치**: `src/renderer/components/terminal/CodeBlock.tsx`

**문제**: 토크나이저 로직 (81줄)과 키워드 데이터 (100줄+)가 컴포넌트 내 존재

**After**:
```typescript
// src/renderer/utils/syntax-highlighter/keywords.ts (신규)
export const LANGUAGE_KEYWORDS: Record<string, string[]> = {
  javascript: ['const', 'let', 'var', 'function', 'async', 'await', ...],
  typescript: ['type', 'interface', 'enum', 'namespace', ...],
  python: ['def', 'class', 'import', 'from', 'async', ...],
  // ...
};

// src/renderer/utils/syntax-highlighter/tokenizer.ts (신규)
export interface Token {
  type: 'keyword' | 'string' | 'comment' | 'number' | 'plain';
  value: string;
}

export function tokenize(code: string, language: string): Token[] {
  const keywords = LANGUAGE_KEYWORDS[language] || [];
  // 토크나이저 로직...
}

// CodeBlock.tsx (리팩토링 후)
import { tokenize, Token } from '@/utils/syntax-highlighter/tokenizer';

export function CodeBlock({ code, language }: CodeBlockProps) {
  const tokens = useMemo(() => tokenize(code, language), [code, language]);

  return (
    <pre className="code-block">
      {tokens.map((token, i) => (
        <span key={i} className={`token-${token.type}`}>
          {token.value}
        </span>
      ))}
    </pre>
  );
}
```

**목표**: 394줄 → 100줄 (유틸리티 분리)

---

### 3.2 IPC 핸들러 중복 제거

**위치**:
- `src/main/ipc/handlers/order.handler.ts:36-67`
- `src/main/ipc/handlers/workflow.handler.ts:32-61`

**문제**: 동일한 `handleIpc()`, `registerHandler()` 패턴 반복

**Before**:
```typescript
// order.handler.ts
interface IpcResponse<T = void> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

async function handleIpc<T>(
  handler: () => Promise<T>,
  context: string
): Promise<IpcResponse<T>> {
  try {
    const data = await handler();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: { code: 'UNKNOWN', message: error.message },
    };
  }
}

// workflow.handler.ts - 동일한 코드 반복
```

**After**:
```typescript
// src/main/ipc/utils/handler-wrapper.ts (신규)
export interface IpcResponse<T = void> {
  success: boolean;
  data?: T;
  error?: IpcError;
}

export interface IpcError {
  code: string;
  message: string;
  details?: unknown;
}

export async function handleIpc<T>(
  handler: () => Promise<T>,
  context: string
): Promise<IpcResponse<T>> {
  try {
    const data = await handler();
    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: { code: 'UNKNOWN', message },
    };
  }
}

export function createIpcHandler<TArgs extends unknown[], TResult>(
  channel: string,
  handler: (...args: TArgs) => Promise<TResult>
): void {
  ipcMain.handle(channel, async (_event, ...args: TArgs) => {
    return handleIpc(() => handler(...args), channel);
  });
}

// src/main/ipc/channels.ts (신규) - 채널 이름 중앙 관리
export const IPC_CHANNELS = {
  ORDER: {
    CREATE: 'order:create',
    EXECUTE: 'order:execute',
    CANCEL: 'order:cancel',
    // ...
  },
  WORKFLOW: {
    LIST: 'workflow:list',
    GET: 'workflow:get',
    // ...
  },
} as const;

// order.handler.ts (리팩토링 후)
import { createIpcHandler, IPC_CHANNELS } from '../utils';

export function registerOrderHandlers(facade: ExecutionFacade): void {
  createIpcHandler(IPC_CHANNELS.ORDER.CREATE, async (params) => {
    return facade.createOrder(params);
  });

  createIpcHandler(IPC_CHANNELS.ORDER.EXECUTE, async (orderId) => {
    return facade.executeOrder(orderId);
  });
}
```

---

## 4. Medium Priority Issues (P2)

### 4.1 Zustand 스토어 최적화

**위치**: `src/renderer/store/useOrderStore.ts` (206줄)

#### A. immer 미들웨어 적용

**Before**:
```typescript
appendStageOutput: (orderId, stageId, output) =>
  set((state) => ({
    stageResults: {
      ...state.stageResults,
      [orderId]: {
        ...state.stageResults[orderId],
        [stageId]: {
          ...state.stageResults[orderId]?.[stageId],
          output: [
            ...(state.stageResults[orderId]?.[stageId]?.output || []),
            output,
          ],
        },
      },
    },
  })),
```

**After**:
```typescript
import { immer } from 'zustand/middleware/immer';

export const useOrderStore = create<OrderState>()(
  immer((set) => ({
    appendStageOutput: (orderId, stageId, output) =>
      set((state) => {
        if (!state.stageResults[orderId]) {
          state.stageResults[orderId] = {};
        }
        if (!state.stageResults[orderId][stageId]) {
          state.stageResults[orderId][stageId] = { output: [] };
        }
        state.stageResults[orderId][stageId].output.push(output);
      }),
  }))
);
```

#### B. 메모이제이션 셀렉터

**Before**:
```typescript
// 컴포넌트에서 직접 접근 - 불필요한 리렌더링 발생
const { orders, sessionStatuses } = useOrderStore();
const activeOrders = orders.filter(o => o.status === 'RUNNING');
```

**After**:
```typescript
// src/renderer/store/selectors/order-selectors.ts (신규)
import { useOrderStore } from '../useOrderStore';
import { useMemo } from 'react';

export function useActiveOrders() {
  return useOrderStore(
    useMemo(
      () => (state) => state.orders.filter((o) => o.status === 'RUNNING'),
      []
    )
  );
}

export function useSessionStatus(orderId: string) {
  return useOrderStore(
    useMemo(
      () => (state) => state.sessionStatuses[orderId],
      [orderId]
    )
  );
}

export function useStageResults(orderId: string) {
  return useOrderStore(
    useMemo(
      () => (state) => state.stageResults[orderId],
      [orderId]
    )
  );
}
```

---

### 4.2 React 안티패턴 수정

#### A. 배열 인덱스 key 제거

**위치**: `src/renderer/components/terminal/TerminalOutputPanel.tsx:219-227`

**Before**:
```typescript
{output.map((e, i) => (
  <div key={i}>  {/* 배열 인덱스 = 안티패턴 */}
    {/* ... */}
  </div>
))}
```

**After**:
```typescript
{output.map((e) => (
  <div key={`${e.timestamp}-${e.orderId}-${e.type}`}>
    {/* ... */}
  </div>
))}
```

#### B. Waterfall 제거

**위치**: `src/renderer/hooks/useOrders.ts:42-50`

**Before**:
```typescript
const cancelOrder = async (orderId: string) => {
  await window.codecafe.cancelOrder(orderId);
  await fetchOrders();  // 순차 실행 (Waterfall)
};
```

**After**:
```typescript
const cancelOrder = async (orderId: string) => {
  // 낙관적 업데이트 또는 병렬 실행
  const cancelPromise = window.codecafe.cancelOrder(orderId);

  // 로컬 상태 즉시 업데이트
  updateOrderStatus(orderId, 'CANCELLING');

  await cancelPromise;
  // fetchOrders는 이벤트 기반으로 자동 갱신되도록 변경
};
```

#### C. Missing useCallback

**위치**: `src/renderer/components/views/NewGlobalLobby.tsx:58-73`

**Before**:
```typescript
useEffect(() => {
  const checkEnv = async () => { /* ... */ };
  checkEnv();
}, []);
```

**After**:
```typescript
const checkEnv = useCallback(async () => {
  // 환경 체크 로직
}, [/* 의존성 */]);

useEffect(() => {
  checkEnv();
}, [checkEnv]);
```

---

### 4.3 타입 안전성 개선

#### A. Event 타입 정의

**위치**: `src/renderer/components/views/NewCafeDashboard.tsx:79-98`

**Before**:
```typescript
const cleanup = window.codecafe.order.onOutput(
  (event: {
    orderId: string;
    type: string;
    stageInfo?: { stageId: string; status?: string };
  }) => { /* ... */ }
);
```

**After**:
```typescript
// src/renderer/types/events.ts (신규)
export type OutputEventType = 'stage_start' | 'stage_end' | 'output' | 'error';

export interface StageInfo {
  stageId: string;
  stageName: string;
  status: 'running' | 'completed' | 'failed';
}

export interface OrderOutputEvent {
  orderId: string;
  type: OutputEventType;
  content?: string;
  timestamp: string;
  stageInfo?: StageInfo;
}

// NewCafeDashboard.tsx
import type { OrderOutputEvent } from '@/types/events';

const cleanup = window.codecafe.order.onOutput((event: OrderOutputEvent) => {
  if (event.type !== 'stage_end') return;
  if (!event.stageInfo?.stageId) return;
  // ...
});
```

#### B. Window API 타입 가드

**Before**:
```typescript
window.codecafe.order.onOutput(handler);  // null 체크 없음
```

**After**:
```typescript
// src/renderer/types/window.d.ts
declare global {
  interface Window {
    codecafe?: CodeCafeAPI;
  }
}

// 사용 시
if (!window.codecafe?.order?.onOutput) {
  throw new Error('CodeCafe API not initialized');
}
window.codecafe.order.onOutput(handler);
```

---

## 5. Low Priority Issues (P3)

### 5.1 Missing Memoization

**위치**: `src/renderer/components/views/NewCafeDashboard.tsx:52-57`

**Before**:
```typescript
const isCompleted = activeOrder?.status === 'COMPLETED';
const isRunning = activeOrder?.status === 'RUNNING';
const isWaitingInput = activeOrder?.status === 'WAITING_INPUT';
```

**After**:
```typescript
const orderStatuses = useMemo(() => ({
  isCompleted: activeOrder?.status === 'COMPLETED',
  isRunning: activeOrder?.status === 'RUNNING',
  isWaitingInput: activeOrder?.status === 'WAITING_INPUT',
}), [activeOrder?.status]);
```

### 5.2 컴포넌트 memo 적용

**대상**: 자주 리렌더링되는 컴포넌트

```typescript
// OrderExecuteDialog.tsx
export const OrderExecuteDialog = memo(function OrderExecuteDialog({
  isOpen,
  onClose,
  onExecute,
}: OrderExecuteDialogProps) {
  // 컴포넌트 로직
});

// TerminalLogEntry.tsx
export const TerminalLogEntry = memo(function TerminalLogEntry({
  entry,
}: TerminalLogEntryProps) {
  // 컴포넌트 로직
});
```

---

## 6. 디렉토리 구조 개선안

**현재**:
```
src/renderer/
├── components/
│   ├── terminal/
│   │   ├── CodeBlock.tsx (394줄)
│   │   ├── ThinkingBlock.tsx (536줄)
│   │   └── TerminalOutputPanel.tsx
│   └── views/
├── store/
└── hooks/
```

**After**:
```
src/renderer/
├── components/
│   ├── terminal/
│   │   ├── CodeBlock.tsx (100줄)
│   │   ├── ThinkingBlock.tsx (150줄)
│   │   ├── thinking/           # 신규
│   │   │   ├── StageHeader.tsx
│   │   │   ├── StageTimeline.tsx
│   │   │   └── SkillsList.tsx
│   │   └── TerminalOutputPanel.tsx
│   └── views/
├── store/
│   ├── useOrderStore.ts
│   └── selectors/              # 신규
│       └── order-selectors.ts
├── hooks/
├── utils/
│   ├── logger.ts               # 신규
│   └── syntax-highlighter/     # 신규
│       ├── keywords.ts
│       └── tokenizer.ts
└── types/
    └── events.ts               # 신규
```

---

## 7. 리팩토링 실행 순서

```
┌─────────────────────────────────────────────────────────────┐
│  Day 1: Critical Fixes                                      │
│  ├─ 1.1 Production console.log 제거                         │
│  ├─ 1.2 logger.ts 유틸리티 생성                             │
│  └─ 1.3 IPC handler-wrapper.ts 추출                         │
├─────────────────────────────────────────────────────────────┤
│  Day 2-3: Component Decomposition                           │
│  ├─ 2.1 ThinkingBlock 하위 컴포넌트 분리                     │
│  ├─ 2.2 CodeBlock 토크나이저 추출                           │
│  └─ 2.3 execution-manager 이벤트 핸들러 분리                 │
├─────────────────────────────────────────────────────────────┤
│  Day 4: State Management                                    │
│  ├─ 3.1 Zustand immer 미들웨어 적용                         │
│  ├─ 3.2 메모이제이션 셀렉터 추가                             │
│  └─ 3.3 Event 타입 정의                                     │
├─────────────────────────────────────────────────────────────┤
│  Day 5: Polish                                              │
│  ├─ 4.1 React 안티패턴 수정 (key, waterfall)                │
│  ├─ 4.2 Missing memoization 추가                            │
│  └─ 4.3 전체 통합 테스트                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. 검증 체크리스트

```bash
# Production console.log 검사
grep -r "console\." packages/desktop/src/renderer --include="*.tsx" --include="*.ts" | grep -v "logger\." | wc -l  # 목표: 0

# 파일 크기 검사
find packages/desktop/src -name "*.tsx" -exec wc -l {} \; | sort -rn | head -10

# 타입 체크
pnpm --filter @codecafe/desktop typecheck

# 빌드 테스트
pnpm --filter @codecafe/desktop build

# Electron 실행 테스트
pnpm --filter @codecafe/desktop dev
```

---

## 9. 주요 메트릭 추적

| 메트릭 | 현재 | 목표 |
|--------|------|------|
| Production console.log | 2개 | 0개 |
| 400줄+ 컴포넌트 | 3개 | 0개 |
| IPC 중복 코드 | 40줄+ | 0줄 |
| `any` 타입 | 7곳+ | 0곳 |
| Missing key prop | 1곳 | 0곳 |

---

*마지막 업데이트: 2026-02-02*
