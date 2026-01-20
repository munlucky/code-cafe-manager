# NewCafeDashboard Order 실행 기능 구현 계획

## 목표
`NewCafeDashboard`에 Order 실행 관련 모든 기능을 완전히 구현

---

## Phase 1: 이벤트 구독 인프라 (App.tsx)

### 1.1 Stage 이벤트 구독 추가
- **파일**: `App.tsx`
- **작업**:
  - `order:stage-started` 이벤트 구독
  - `order:stage-completed` 이벤트 구독  
  - `order:stage-failed` 이벤트 구독
  - Stage 상태를 저장할 state 추가

### 1.2 Order 완료/실패 이벤트
- **파일**: `App.tsx`
- **작업**:
  - `order:completed` 이벤트 → Order 상태 COMPLETED로 갱신
  - `order:failed` 이벤트 → Order 상태 FAILED로 갱신 + 에러 저장

---

## Phase 2: NewCafeDashboard Props 확장

### 2.1 새로운 Props 추가
```typescript
interface NewCafeDashboardProps {
  // 기존
  cafe: Cafe;
  orders: DesignOrder[];
  workflows: Recipe[];
  onCreateOrder: (...) => void;
  onDeleteOrder: (orderId: string) => void;
  onSendInput: (orderId: string, input: string) => void;
  
  // 신규 추가
  stageProgress: Record<string, StageInfo[]>;  // orderId → stages
  onExecuteOrder?: (orderId: string, prompt: string) => void;  // PENDING 실행용
}
```

---

## Phase 3: Stage Progress UI

### 3.1 StageProgressBar 컴포넌트
- **파일**: `NewCafeDashboard.tsx` 또는 별도 파일
- **기능**:
  - Stage 목록 표시 (뱃지 형태)
  - 상태별 색상: pending(회색), running(주황 애니메이션), completed(녹색), failed(빨강)
  - 진행률 바

---

## Phase 4: Terminal Output 개선

### 4.1 실시간 로그 렌더링 개선
- **현재**: `activeOrder.logs` 배열 렌더링
- **개선**:
  - HTML 콘텐츠 안전 렌더링 (`dangerouslySetInnerHTML` 또는 정제)
  - 자동 스크롤 토글 버튼
  - 로그 타입별 아이콘 (stdout, stderr, system)

---

## Phase 5: PENDING Order 실행 버튼

### 5.1 Execute 버튼 추가
- **조건**: `order.status === 'PENDING'`
- **액션**: Order 카드 또는 상세 패널에서 클릭 시 실행
- **참고**: 현재는 생성 시 자동 실행하므로 선택적

---

## 구현 순서

| 순서 | 작업 | 파일 | 예상 시간 |
|------|------|------|----------|
| 1 | Stage 이벤트 구독 | App.tsx | 10분 |
| 2 | 완료/실패 이벤트 구독 | App.tsx | 5분 |
| 3 | Props 타입 확장 | design.ts, NewCafeDashboard | 5분 |
| 4 | Stage Progress UI | NewCafeDashboard | 15분 |
| 5 | Terminal HTML 렌더링 | NewCafeDashboard | 10분 |
| 6 | 스크롤 토글 | NewCafeDashboard | 5분 |
| 7 | 타입체크 & 테스트 | - | 5분 |

**총 예상: 약 55분**

---

## 검증 계획

1. Order 생성 → 자동 실행 확인
2. 터미널에 실시간 로그 출력 확인
3. Stage 진행 상황 UI 표시 확인
4. 완료 시 상태 갱신 확인
5. 입력 대기 시 입력 폼 표시 확인
