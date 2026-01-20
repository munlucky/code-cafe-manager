# NewCafeDashboard Order 실행 기능 복원 계획

## 목표
뉴 디자인 컴포넌트의 **디자인은 유지**하면서 기존 Order 실행 기능이 정상 동작하도록 수정

---

## 현재 상태 분석

### ✅ 이미 구현됨
- `useIpcEffect.ts`: Stage 이벤트 (started/completed/failed), Session 이벤트 구독
- `App.tsx`: Order 생성 시 자동 실행 (`handleCreateOrder`)
- `App.tsx`: `order:output` 로그 수집
- `NewCafeDashboard`: 기본 UI 렌더링

### ✅ 문제 해결 완료
| 문제 | 원인 | 해결방법 |
|------|------|----------|
| Order 상태 갱신 안됨 | `order:completed/failed` 리스너 부재 | useIpcEffect에 추가 ✅ 완료 |
| 터미널 HTML 미렌더링 | 일반 텍스트로 출력 | `dangerouslySetInnerHTML` 사용 ✅ 완료 |
| cleanup 누락 | 새 리스너 정리 안됨 | cleanup 배열에 추가 ✅ 완료 |

---

## 구현 작업

### 1. ✅ order:completed/failed 이벤트 추가 (완료)

**파일**: `useIpcEffect.ts`

```typescript
// Order Completed
const cleanupOrderCompleted = window.codecafe.order.onCompleted?.((data) => {
  updateOrder(data.orderId, { status: OrderStatus.COMPLETED });
  updateSessionStatus(data.orderId, { status: 'completed', awaitingInput: false });
});

// Order Failed  
const cleanupOrderFailed = window.codecafe.order.onFailed?.((data) => {
  updateOrder(data.orderId, { status: OrderStatus.FAILED, error: data.error });
  updateSessionStatus(data.orderId, { status: 'failed', awaitingInput: false });
});
```

---

### 2. ✅ cleanup 함수 추가 (완료)

**파일**: `useIpcEffect.ts` 

```typescript
return () => {
  // ... 기존 cleanup
  cleanupOrderCompleted?.();
  cleanupOrderFailed?.();
};
```

---

### 3. 터미널 HTML 렌더링

**파일**: `NewCafeDashboard.tsx`

**현재**:
```tsx
{log.content}
```

**변경**:
```tsx
<span dangerouslySetInnerHTML={{ __html: log.content }} />
```

---

## 구현 순서

| # | 작업 | 상태 |
|---|------|------|
| 1 | order:completed/failed 리스너 추가 | ✅ 완료 |
| 2 | cleanup 함수 추가 | ✅ 완료 |
| 3 | 터미널 HTML 렌더링 | ✅ 완료 |
| 4 | 타입체크 & 테스트 | ⏳ 환경 미설치 (node_modules 필요) |

---

## 검증

1. Order 생성 → 자동 실행 확인 (PENDING → RUNNING)
2. 터미널에 색상 있는 로그 출력 확인
3. 완료 시 상태 갱신 확인 (RUNNING → COMPLETED)
4. 입력 대기 시 입력 폼 표시 확인
