# Order 세션 복원 버그 수정

## 요약
worktree가 존재하는 완료된 order에서 앱 재시작 후에도 추가 요청이 가능하도록 세션 복원 로직 개선

## 작업 유형
Bug Fix (버그 수정)

## 복잡도 평가
- **complexity**: medium
- **estimatedFiles**: 4
- **estimatedLines**: 200
- **estimatedTime**: 2h
- **notes**: 세션 복원 로직이 여러 컴포넌트(ExecutionManager, BaristaEngine, OrderSession)에 걸쳐 있고, terminalGroup 생성 및 상태 관리 등의 복잡성이 있음

## 사용자 명확화 질문 (대기 중)

### HIGH Priority - 반드시 확인 필요

1. **현재 발생하는 구체적인 에러/증상**
   - 질문: 앱 재시작 후 추가 요청 시 어떤 에러나 동작이 발생하나요?
   - 가능한 시나리오:
     - 아무 일도 일어나지 않음 (요청 무시)
     - "No session found" 에러
     - "No terminal group" 관련 에러
     - 타임아웃
     - 기타 에러 메시지

2. **세션 복원 범위**
   - 질문: 복원된 세션에서 어떤 정보를 유지해야 하나요?
   - 옵션:
     - **A) 최소**: `completed` 상태 + `cwd`만 유지 (현재 구현)
     - **B) 중간**: 이전 컨텍스트 일부 유지
     - **C) 최대**: 이전 터미널 세션/출력 이력까지 복원

### MEDIUM Priority

3. **Barista 생성 시점**
   - 질문: `order.provider`에 해당하는 Barista가 항상 존재한다고 가정해도 되나요?
   - 현재: 없으면 자동 생성됨 (execution-manager.ts:707-712)

4. **레거시 데이터 처리**
   - 질문: `order.cafeId`가 없는 레거시 order를 어떻게 처리해야 하나요?
   - 현재: `order.cafeId || 'default'` 사용

### LOW Priority

5. **UI 피드백**
   - 질문: 세션 복원이 실패했을 때 사용자에게 어떤 메시지를 표시해야 하나요?
   - 옵션: 토스트/알림/무시

---

## 관련 파일
- `packages/desktop/src/main/execution-manager.ts` - `restoreSessionsForWorktreeOrders()`
- `packages/orchestrator/src/barista/barista-engine-v2.ts` - `restoreSessionForFollowup()`
- `packages/orchestrator/src/session/order-session.ts` - `executeFollowup()`
- `packages/desktop/src/main/ipc/order.ts` - `order:executeFollowup` 핸들러
- `packages/desktop/src/renderer/components/views/NewCafeDashboard.tsx` - UI

## 현재 구현 분석

### 1. 세션 복원 로직 (execution-manager.ts)
- **위치**: `restoreSessionsForWorktreeOrders()` 메서드 (line 668-736)
- **호출 시점**: `ExecutionManager.start()`에서 호출 (line 92)
- **필터링 조건**:
  1. `order.status === OrderStatus.COMPLETED`
  2. `order.worktreeInfo?.path`가 존재
  3. `!order.worktreeInfo.removed`
  4. `existsSync(order.worktreeInfo.path)`

### 2. 세션 복원 구현 (barista-engine-v2.ts)
- **위치**: `restoreSessionForFollowup()` 메서드 (line 633-673)
- **구현 방식**:
  ```typescript
  const session = this.sessionManager.createSession(order, barista, cafeId, cwd);
  (session as any).status = 'completed';
  (session as any).currentCwd = cwd;
  this.activeExecutions.set(order.id, { baristaId: barista.id, session });
  ```

### 3. Followup 실행 (order-session.ts)
- **위치**: `executeFollowup()` 메서드 (line 969-1037)
- **필요 조건**: `terminalGroup`이 존재해야 함 (line 987-1002)
- **문제**: 복원된 세션에는 `terminalGroup`이 없어 실패 가능

## 불확실성 질문 (사용자 확인 필요)

### HIGH Priority

1. **세션 복원 후 terminalGroup 문제**
   - 질문: 복원된 세션에서 `executeFollowup()` 호출 시 `terminalGroup`이 없어 실패하는 현상을 확인하셨나요?
   - 이유: `order-session.ts` line 987-1002에서 `terminalGroup`이 없으면 생성하지만, 복원된 세션에는 필요한 Provider 정보가 부족할 수 있음

2. **예상 버그 증상**
   - 질문: 현재 발생하는 구체적인 에러 메시지나 동작은 무엇인가요?
   - 가능한 시나리오:
     - 아무 일도 일어나지 않음 (요청 무시)
     - "No session found" 에러
     - "No terminal group" 에러
     - 타임아웃

3. **세션 상태 복원 범위**
   - 질문: 복원된 세션에서 어떤 정보를 유지해야 하나요?
   - 옵션:
     - 최소: `completed` 상태 + `cwd`만 유지
     - 중간: 이전 컨텍스트 일부 유지
     - 최대: 이전 터미널 세션 전체 복원

### MEDIUM Priority

4. **Barista 생성 시점**
   - 질문: `order.provider`에 해당하는 Barista가 항상 존재한다고 가정해도 되나요?
   - 현재: 없으면 자동 생성 (execution-manager.ts line 707-712)

5. **cafeId 누락 처리**
   - 질문: `order.cafeId`가 없는 레거시 order를 어떻게 처리해야 하나요?
   - 현재: `order.cafeId || 'default'` 또는 `order.cafeId || order.counter`

### LOW Priority

6. **복원 실패 시 UI 피드백**
   - 질문: 세션 복원이 실패했을 때 사용자에게 어떤 메시지를 표시해야 하나요?

## 가능한 원인 분석

### Root Cause 1: terminalGroup 미존재 (가장 유력)
**증상**: `executeFollowup()`에서 `terminalGroup` 체크 후 생성 시도하지만 Provider 정보 부족

**원인 코드**:
```typescript
// order-session.ts:987-1002
if (!this.terminalGroup) {
  const providers: ProviderType[] = [this.barista.provider as ProviderType];
  this.terminalGroup = new TerminalGroup(...);
}
```

**문제**: 복원 시 `this.barista` 레퍼런스는 있지만 `terminalGroup` 초기화 로직이 누락

### Root Cause 2: activeExecutions 등록 누락
**증상**: `canFollowup()`이 false를 반환

**원인**: 앱 재시작 후 `activeExecutions` Map이 비어있음

### Root Cause 3: SessionManager 측면 문제
**증상**: `createSession()`으로 생성된 세션이 `completed` 상태로 전환되지 않음

**원인**: `(session as any).status = 'completed'` 강제 설정이 내부 상태와 일치하지 않음

## 제안 해결 방향

### 옵션 A: executeFollowup에서 자동 복원 (최소 변경)
- `order:executeFollowup` 핸들러에서 이미 복원 로직이 있음 (order.ts:707-736)
- 이 로직이 제대로 작동하는지 확인

### 옵션 B: restoreSessionForFollowup 개선
- `terminalGroup`을 미리 생성하여 복원
- `completed` 상태로 정상 전환

### 옵션 C: OrderSession에 복원 전용 메서드 추가
- `restoreForFollowup()` 정적 메서드 등으로 복원 로직 캡슐화

## 검증 계획
1. worktree가 있는 완료된 order 생성
2. 앱 재시작
3. 추가 요청 전송
4. 정상 동작 확인 (followup 실행)

---

*분석 일시: 2025-01-24*
*분석자: Claude Code*
