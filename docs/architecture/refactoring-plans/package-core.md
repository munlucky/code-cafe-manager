# @codecafe/core 리팩토링 계획

> 작성일: 2026-02-02
> 패키지 경로: `packages/core/`
> 현재 LOC: ~2,000줄

---

## 1. 개요

`@codecafe/core`는 CodeCafe의 기반 패키지로, 도메인 모델(Barista, Order, Receipt), 타입 정의, 스키마 검증, 유틸리티를 제공합니다. 다른 모든 패키지가 이 패키지에 의존하므로, 변경 시 파급 효과가 큽니다.

### 핵심 문제 요약

| 우선순위 | 이슈 | 영향 범위 | 예상 공수 |
|---------|------|----------|----------|
| **P0** | Generic Error 사용 | 전체 패키지 | 2-3시간 |
| **P1** | `any` 타입 남용 | 11곳 | 2-3시간 |
| **P1** | Storage 로딩 중복 | 45줄 | 1시간 |
| **P2** | O(n) 큐 연산 | 성능 | 30분 |
| **P2** | 상태 전이 검증 없음 | 안정성 | 2시간 |
| **P2** | 입력 검증 누락 | 안정성 | 1시간 |
| **P3** | 매직 넘버 | 가독성 | 30분 |

---

## 2. Critical Issues (P0)

### 2.1 Generic Error → CodeCafeError 교체

**현황**: `Error` 생성자를 직접 사용하여 구조화된 에러 처리 불가

**위치**:
- `src/barista.ts`: 22, 46, 96, 100줄
- `src/order.ts`: 51, 55, 69, 85, 106, 110, 130, 142, 175줄

**Before**:
```typescript
// barista.ts:22
throw new Error(`Maximum baristas (${this.maxBaristas}) reached`);

// order.ts:51
throw new Error(`Order ${orderId} not found`);
```

**After**:
```typescript
import { ValidationError, NotFoundError, ErrorCode } from './errors';

// barista.ts:22
throw new ValidationError(ErrorCode.MAX_BARISTAS_REACHED, {
  message: `Maximum baristas (${this.maxBaristas}) reached`,
  details: { maxBaristas: this.maxBaristas, current: this.baristas.size }
});

// order.ts:51
throw new NotFoundError(ErrorCode.ORDER_NOT_FOUND, {
  message: `Order ${orderId} not found`,
  details: { orderId }
});
```

**작업 항목**:
- [ ] `src/errors/` 디렉토리에 에러 코드 확장 (이미 일부 존재)
- [ ] `barista.ts` 내 4곳 교체
- [ ] `order.ts` 내 9곳 교체
- [ ] 단위 테스트에서 에러 타입 검증 추가

---

## 3. High Priority Issues (P1)

### 3.1 `any` 타입 제거

**위치 및 개선 방안**:

#### a) `src/types/terminal.ts:10`
```typescript
// Before
process: any; // IPty (node-pty)

// After
import type { IPty } from 'node-pty';
process: IPty | null;
```

#### b) `src/storage.ts:59, 84, 108`
```typescript
// Before
return orders.map((order: any) => ({...}));

// After - 타입 가드 함수 사용
function isOrderJson(obj: unknown): obj is OrderJson {
  return typeof obj === 'object' && obj !== null && 'id' in obj;
}

return orders.filter(isOrderJson).map(transformOrder);
```

#### c) `src/types.ts:117, 124`
```typescript
// Before
export interface BaristaEvent {
  data: any;
}

// After - 제네릭 사용
export interface BaristaEvent<T = Record<string, unknown>> {
  data: T;
}

// 또는 discriminated union
type BaristaEventData =
  | { type: 'output'; content: string }
  | { type: 'status'; status: BaristaStatus }
  | { type: 'error'; error: Error };
```

#### d) `src/barista.ts:122`, `src/order.ts:247`
```typescript
// Before
private emitEvent(type: EventType, orderId: string, data: any): void

// After - 이벤트별 타입 정의
type OrderEventPayload = {
  [EventType.ORDER_CREATED]: Order;
  [EventType.ORDER_ASSIGNED]: { baristaId: string };
  [EventType.ORDER_STATUS_CHANGED]: { status: OrderStatus };
};

private emitEvent<T extends EventType>(
  type: T,
  orderId: string,
  data: OrderEventPayload[T]
): void
```

---

### 3.2 Storage 로딩 중복 제거

**현황**: `loadOrders()`, `loadBaristas()`, `loadReceipts()` 동일 패턴 반복

**위치**: `src/storage.ts:49-113` (약 65줄, 45줄 중복)

**Before**:
```typescript
async loadOrders(): Promise<Order[]> {
  if (!existsSync(this.ordersFile)) return [];
  const content = await readFile(this.ordersFile, 'utf-8');
  if (!content) return [];
  const orders = JSON.parse(content);
  return orders.map((order: any) => ({
    ...order,
    createdAt: new Date(order.createdAt),
    startedAt: order.startedAt ? new Date(order.startedAt) : null,
    endedAt: order.endedAt ? new Date(order.endedAt) : null,
  }));
}

async loadBaristas(): Promise<Barista[]> {
  // 동일 패턴 반복...
}

async loadReceipts(): Promise<Receipt[]> {
  // 동일 패턴 반복...
}
```

**After**:
```typescript
// 제네릭 로더 추출
private async loadJsonFile<TRaw, TResult>(
  filepath: string,
  transformer: (data: TRaw) => TResult
): Promise<TResult[]> {
  if (!existsSync(filepath)) return [];
  const content = await readFile(filepath, 'utf-8');
  if (!content) return [];

  try {
    const data = JSON.parse(content) as TRaw[];
    return data.map(transformer);
  } catch {
    return [];
  }
}

async loadOrders(): Promise<Order[]> {
  return this.loadJsonFile<OrderJson, Order>(
    this.ordersFile,
    (order) => ({
      ...order,
      createdAt: new Date(order.createdAt),
      startedAt: order.startedAt ? new Date(order.startedAt) : null,
      endedAt: order.endedAt ? new Date(order.endedAt) : null,
    })
  );
}

async loadBaristas(): Promise<Barista[]> {
  return this.loadJsonFile<BaristaJson, Barista>(
    this.baristasFile,
    (barista) => ({ ...barista })
  );
}
```

---

## 4. Medium Priority Issues (P2)

### 4.1 O(n) 큐 연산 → Set 기반 O(1)

**현황**: `filter()`로 단일 항목 제거 → O(n)

**위치**: `src/order.ts:59, 117`

**Before**:
```typescript
private pendingQueue: string[] = [];

assignBarista(orderId: string, baristaId: string): void {
  // ... validation ...
  this.pendingQueue = this.pendingQueue.filter((id) => id !== orderId);
}
```

**After**:
```typescript
private pendingQueue: Set<string> = new Set();

assignBarista(orderId: string, baristaId: string): void {
  // ... validation ...
  this.pendingQueue.delete(orderId);  // O(1)
}

addToPendingQueue(orderId: string): void {
  this.pendingQueue.add(orderId);  // O(1)
}

getPendingOrders(): Order[] {
  return Array.from(this.pendingQueue)
    .map((id) => this.orders.get(id))
    .filter((order): order is Order => order !== undefined);
}
```

---

### 4.2 상태 전이 검증 추가

**현황**: 상태 변경 시 유효성 검증 없음

**위치**: `src/barista.ts:43-60`

**추가할 코드**:
```typescript
// src/barista.ts에 추가
private static readonly VALID_TRANSITIONS: Record<BaristaStatus, BaristaStatus[]> = {
  [BaristaStatus.IDLE]: [BaristaStatus.RUNNING, BaristaStatus.BUSY, BaristaStatus.STOPPED],
  [BaristaStatus.RUNNING]: [BaristaStatus.IDLE, BaristaStatus.ERROR, BaristaStatus.STOPPED],
  [BaristaStatus.BUSY]: [BaristaStatus.IDLE, BaristaStatus.ERROR, BaristaStatus.STOPPED],
  [BaristaStatus.ERROR]: [BaristaStatus.IDLE, BaristaStatus.STOPPED],
  [BaristaStatus.STOPPED]: [],  // Terminal state
};

private isValidTransition(from: BaristaStatus, to: BaristaStatus): boolean {
  return BaristaManager.VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

updateBaristaStatus(baristaId: string, status: BaristaStatus, orderId?: string | null): void {
  const barista = this.baristas.get(baristaId);
  if (!barista) {
    throw new NotFoundError(ErrorCode.BARISTA_NOT_FOUND, { baristaId });
  }

  if (!this.isValidTransition(barista.status, status)) {
    throw new ValidationError(ErrorCode.INVALID_STATE_TRANSITION, {
      message: `Cannot transition from ${barista.status} to ${status}`,
      details: { from: barista.status, to: status, baristaId }
    });
  }

  barista.status = status;
  // ...
}
```

---

### 4.3 입력 검증 추가 (Zod 스키마)

**위치**: `src/order.ts:15-22`, `src/barista.ts:20`

**추가할 코드**:
```typescript
// src/schemas/order-input.ts (신규)
import { z } from 'zod';
import { ProviderTypeSchema } from './provider';

export const CreateOrderInputSchema = z.object({
  workflowId: z.string().min(1, 'workflowId is required'),
  workflowName: z.string().min(1, 'workflowName is required'),
  counter: z.string().min(1, 'counter is required'),
  provider: ProviderTypeSchema,
  vars: z.record(z.string(), z.string()).optional().default({}),
  cafeId: z.string().optional(),
});

export type CreateOrderInput = z.infer<typeof CreateOrderInputSchema>;
```

```typescript
// src/order.ts 수정
import { CreateOrderInputSchema, CreateOrderInput } from './schemas/order-input';

createOrder(input: CreateOrderInput): Order {
  const validated = CreateOrderInputSchema.parse(input);

  const order: Order = {
    id: generateOrderId(),
    workflowId: validated.workflowId,
    // ...
  };

  return order;
}
```

---

## 5. Low Priority Issues (P3)

### 5.1 매직 넘버 상수화

**위치**: `src/barista.ts:12`, `src/log-manager.ts:12, 64`

**Before**:
```typescript
// barista.ts:12
constructor(maxBaristas: number = 4)

// log-manager.ts:12
private static readonly MAX_LOG_ENTRY_LENGTH = 500;

// log-manager.ts:64
async tailLog(orderId: string, lines: number = 100): Promise<string>
```

**After**:
```typescript
// src/constants/barista.ts (신규)
export const BARISTA_DEFAULTS = {
  MAX_POOL_SIZE: 4,
  STATUS_CHECK_INTERVAL_MS: 5000,
} as const;

// src/constants/logging.ts (신규)
export const LOG_DEFAULTS = {
  MAX_ENTRY_LENGTH: 500,
  DEFAULT_TAIL_LINES: 100,
} as const;
```

---

## 6. 리팩토링 실행 순서

```
┌─────────────────────────────────────────────────────────────┐
│  Phase 1: Error Handling (2-3시간)                          │
│  ├─ 1.1 에러 코드 확장 정의                                  │
│  ├─ 1.2 barista.ts Error → CodeCafeError                   │
│  └─ 1.3 order.ts Error → CodeCafeError                     │
├─────────────────────────────────────────────────────────────┤
│  Phase 2: Type Safety (2-3시간)                             │
│  ├─ 2.1 terminal.ts IPty 타입 명시                          │
│  ├─ 2.2 storage.ts 타입 가드 함수 추가                       │
│  ├─ 2.3 types.ts BaristaEvent 제네릭화                      │
│  └─ 2.4 emitEvent 이벤트별 타입 적용                         │
├─────────────────────────────────────────────────────────────┤
│  Phase 3: Code Deduplication (1시간)                        │
│  └─ 3.1 storage.ts loadJsonFile 제네릭 추출                 │
├─────────────────────────────────────────────────────────────┤
│  Phase 4: Data Structure & Validation (2-3시간)             │
│  ├─ 4.1 pendingQueue Array → Set                           │
│  ├─ 4.2 상태 전이 검증 로직 추가                             │
│  └─ 4.3 Zod 입력 검증 스키마 추가                            │
├─────────────────────────────────────────────────────────────┤
│  Phase 5: Constants (30분)                                  │
│  └─ 5.1 매직 넘버 상수 파일로 추출                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. 검증 체크리스트

```bash
# 타입 체크
pnpm --filter @codecafe/core typecheck

# any 타입 검사
grep -r ": any" packages/core/src --include="*.ts" | wc -l  # 목표: 0

# Generic Error 검사
grep -r "new Error(" packages/core/src --include="*.ts" | wc -l  # 목표: 0

# 테스트 실행
pnpm --filter @codecafe/core test

# 의존 패키지 빌드 확인
pnpm build
```

---

## 8. 의존성 영향 분석

`@codecafe/core` 변경 시 영향받는 패키지:

| 패키지 | 의존 수준 | 영향 범위 |
|--------|----------|----------|
| `@codecafe/orchestrator` | Direct | Types, Managers, Schemas |
| `@codecafe/cli` | Direct | Types |
| `@codecafe/desktop` | Indirect | IPC를 통해 간접 사용 |
| `@codecafe/providers-*` | Direct | Types |

**주의사항**:
- 타입 변경 시 모든 의존 패키지 재빌드 필요
- 에러 타입 변경 시 catch 블록 수정 필요
- 공개 API 시그니처 변경 최소화 권장

---

*마지막 업데이트: 2026-02-02*
