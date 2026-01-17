# Code Review v1 - Desktop UI 플로우 개선 구현

**Reviewer**: Claude (codex-fallback)
**Date**: 2026-01-15
**Reviewed Files**: 5개
- `packages/desktop/src/main/ipc/order.ts`
- `packages/desktop/src/renderer/components/order/NewOrderDialog.tsx`
- `packages/desktop/src/renderer/components/terminal/TerminalOutputPanel.tsx`
- `packages/desktop/src/renderer/components/terminal/OrderTerminals.tsx`
- `packages/git-worktree/src/worktree-manager.ts`

## 판정: APPROVE (조건부) ✅

**조건:**
1. ✅ Warning 1 수정 필수: Global interval 관리
2. 💡 Warning 2-5 개선 권장 (선택사항)

---

## 요약

| 카테고리 | 개수 | 상태 |
|---------|------|------|
| Critical Issues | 0 | ✅ |
| Warnings | 5 | ⚠️ |
| Recommendations | 3 | 💡 |

**우선순위**: Correctness → Security → Performance → Maintainability

---

## Critical Issues ❌ (0개)

없음. 코드의 기본 로직, 보안, 타입 안전성은 양호합니다.

---

## Warnings ⚠️ (5개)

### Warning 1: 메모리 누수 - Global interval 관리 ⚠️ [MUST FIX]
**파일**: `packages/desktop/src/main/ipc/order.ts:248-258`

**문제**:
```typescript
if (!(global as any).orderOutputIntervals) {
  (global as any).orderOutputIntervals = new Map();
}
```

**위험도**: HIGH
- Global 객체에 interval을 저장
- Electron 앱 종료 시 정리되지 않으면 메모리 누수 발생
- 여러 오더 구독 시 interval이 누적됨

**권장 해결책**:
```typescript
// order.ts 상단
class OrderManager {
  private static outputIntervals = new Map<string, NodeJS.Timeout>();

  static registerHandlers(orchestrator: Orchestrator) {
    // ... 기존 핸들러 로직

    ipcMain.handle('order:subscribeOutput', async (event, orderId: string) => {
      // ... interval 생성 로직
      OrderManager.outputIntervals.set(intervalKey, interval);
      return { subscribed: true };
    });

    ipcMain.handle('order:unsubscribeOutput', async (_, orderId: string) => {
      const interval = OrderManager.outputIntervals.get(intervalKey);
      if (interval) {
        clearInterval(interval);
        OrderManager.outputIntervals.delete(intervalKey);
      }
      return { unsubscribed: true };
    });
  }

  static cleanup() {
    for (const [key, interval] of this.outputIntervals) {
      clearInterval(interval);
    }
    this.outputIntervals.clear();
    console.log('[OrderManager] All intervals cleared');
  }
}

export const registerOrderHandlers = OrderManager.registerHandlers.bind(OrderManager);
export const cleanupOrderHandlers = OrderManager.cleanup.bind(OrderManager);
```

**main/index.ts 수정**:
```typescript
import { cleanupOrderHandlers } from './ipc/order';

app.on('before-quit', () => {
  cleanupOrderHandlers();
});
```

---

### Warning 2: 로그 파일 폴링 성능 ⚠️
**파일**: `packages/desktop/src/main/ipc/order.ts:206-244`

**문제**:
```typescript
const content = await fs.readFile(logPath, 'utf-8');
const newContent = content.slice(lastPosition);
```

**위험도**: MEDIUM
- 3초마다 로그 파일 전체를 메모리에 로드
- 로그 파일이 10MB+ 되면 성능 저하
- `lastPosition`으로 새 내용만 추출하지만, 전체 파일을 읽음

**권장 해결책**:
```typescript
import { stat, open } from 'fs/promises';

const interval = setInterval(async () => {
  try {
    const stats = await stat(logPath);

    // 파일 크기가 증가한 경우에만 읽기
    if (stats.size > lastPosition) {
      const fd = await open(logPath, 'r');
      const bytesToRead = stats.size - lastPosition;
      const buffer = Buffer.alloc(bytesToRead);

      await fd.read(buffer, 0, bytesToRead, lastPosition);
      await fd.close();

      const newContent = buffer.toString('utf-8');
      lastPosition = stats.size;

      // ... 기존 파싱 로직
    }
  } catch (error) {
    // ... 에러 처리
  }
}, 3000);
```

**추가 개선**:
- 로그 파일 rotation (10MB 초과 시 새 파일 생성)
- 최근 1000줄만 유지

---

### Warning 3: 에러 처리 - Alert 사용 ⚠️
**파일**: `packages/desktop/src/renderer/components/order/NewOrderDialog.tsx:66,88,92`

**문제**:
```typescript
alert('Please select a workflow');
alert(`Failed to create order: ${result.error?.message}`);
```

**위험도**: LOW
- `alert()`는 blocking UI로 UX 저하
- Toast 알림 또는 인라인 에러 메시지 권장

**권장 해결책**:
```typescript
export function NewOrderDialog({ ... }: Props): ReactElement | null {
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); // 에러 초기화

    if (!workflowId) {
      setError('Please select a workflow');
      return;
    }

    setLoading(true);
    try {
      const result = await window.codecafe.order.createWithWorktree({ ... });
      if (result.success && result.data) {
        onSuccess(result.data.order.id);
        onClose();
      } else {
        setError(result.error?.message || 'Unknown error');
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Form */}
      <form onSubmit={handleSubmit}>
        {/* Error message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded p-3 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* ... 기존 폼 */}
      </form>
    </div>
  );
}
```

---

### Warning 4: 타입 안전성 - any 타입 ⚠️
**파일**: `packages/desktop/src/main/ipc/order.ts:74,142`

**문제**:
```typescript
order: any; // Order 타입 (Orchestrator에서 반환)
params.provider as any,
```

**위험도**: LOW
- `any` 타입으로 타입 안전성 저하
- 런타임 에러 발생 가능성

**권장 해결책**:
```typescript
import { Order, ProviderType } from '@codecafe/core';

export interface CreateOrderWithWorktreeResult {
  order: Order; // 정확한 타입
  worktree?: {
    path: string;
    branch: string;
  };
}

// Provider 검증
const validProviders: ProviderType[] = ['claude-code', 'codex', 'gemini', 'grok'];
if (!validProviders.includes(params.provider as ProviderType)) {
  throw new Error(`Invalid provider: ${params.provider}`);
}

const order = await orchestrator.createOrder(
  params.workflowId,
  params.workflowName,
  cafe.path,
  params.provider as ProviderType,
  params.vars || {}
);
```

---

### Warning 5: Path 보안 - Worktree Root 검증 누락 ⚠️
**파일**: `packages/desktop/src/main/ipc/order.ts:156-160`

**문제**:
```typescript
const worktreeRoot = cafe.settings.worktreeRoot.startsWith('/')
  ? cafe.settings.worktreeRoot
  : join(cafe.path, cafe.settings.worktreeRoot);
```

**위험도**: LOW
- `cafe.settings.worktreeRoot`에 `..` 등이 포함되면 path traversal 가능
- 사용자 입력은 아니지만 설정 파일 변조 가능성 존재

**권장 해결책**:
```typescript
import { resolve, relative } from 'path';

// Worktree root 정규화 및 검증
const normalizedRoot = resolve(cafe.path, cafe.settings.worktreeRoot);
const relPath = relative(cafe.path, normalizedRoot);

// Path traversal 방지
if (relPath.startsWith('..') || path.isAbsolute(relPath)) {
  throw new Error('Invalid worktree root: path traversal detected');
}

const worktreePath = join(normalizedRoot, branchName);
```

---

## Recommendations 💡 (3개)

### Recommendation 1: Workflow 목록 API 구현
**파일**: `packages/desktop/src/renderer/components/order/NewOrderDialog.tsx:47-56`

**현재 상태**:
```typescript
// TODO: 실제 워크플로우 목록 API 호출
setWorkflows([
  { id: 'feature-workflow', name: 'Feature Development', ... },
  ...
]);
```

**권장**:
- `window.codecafe.workflow.list()` API 연동
- IPC 핸들러 구현 (`workflow:list`)

---

### Recommendation 2: 로그 파일 Rotation
**파일**: `packages/desktop/src/main/ipc/order.ts:212`

**권장**:
- 로그 파일 크기 제한 (예: 10MB)
- 초과 시 `logs.1.jsonl`, `logs.2.jsonl` 등으로 rotation
- 또는 최근 1000줄만 유지

---

### Recommendation 3: TypeScript strict 모드 강화
**전체**

**권장**:
- `tsconfig.json`에서 `strict: true` 설정
- `any` 타입 제거
- Null safety 강화

---

## Positive Aspects ✅

1. **보안**: `execFileAsync` 사용으로 command injection 방지 ✅
   - `packages/git-worktree/src/worktree-manager.ts:218-222`

2. **에러 처리**: `handleIpc` wrapper로 일관된 에러 응답 ✅
   - `packages/desktop/src/main/ipc/order.ts:97-119`

3. **타입 안전성**: 대부분 타입이 명시적으로 정의됨 ✅
   - Interface 정의 명확 (CreateOrderWithWorktreeParams, OrderOutputEvent 등)

4. **코드 구조**: 컴포넌트 분리 잘 되어 있음 (SRP 준수) ✅
   - NewOrderDialog, TerminalOutputPanel, OrderTerminals 각각 명확한 역할

5. **Cleanup**: useEffect cleanup으로 메모리 누수 방지 ✅
   - `TerminalOutputPanel.tsx:47-51`
   - `OrderTerminals.tsx:49`

6. **브랜치 중복 처리**: `getUniqueBranchName`으로 충돌 방지 ✅
   - `worktree-manager.ts:200-211`

---

## Verdict

**APPROVE (조건부)** ✅

**승인 조건:**
1. **Warning 1 수정 필수**: Global interval → 클래스 레벨 관리 + cleanup
2. **Warning 2-5 개선 권장**: 성능, UX, 타입 개선 (선택사항)

**승인 이유:**
- Critical 이슈 없음 (0개)
- 전반적으로 안전하고 잘 구조화된 코드
- Warning 1 (메모리 누수)은 반드시 수정 필요
- Warning 2-5는 개선 사항이지만 blocking은 아님
- typecheck 통과 ✅

**다음 조치:**
1. ✅ Warning 1 수정 (필수, 1시간 소요)
2. 💡 Warning 2-5 선택적 개선 (2-3시간 소요)
3. ✅ 통합 테스트 진행
4. ✅ 최종 검증

---

**Review Metadata:**
- Reviewer: Claude (codex-fallback: Codex unavailable)
- Review Date: 2026-01-15
- Files Reviewed: 5
- Issues Found: 0 Critical, 5 Warnings, 3 Recommendations
- Approval: CONDITIONAL (Warning 1 fix required)
