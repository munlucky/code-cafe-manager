# M1 → M2 통합 테스트 가이드

> 작성일: 2026-01-09
> 목적: M1(MVP) 기능과 M2 신규 기능의 통합 테스트
> 브랜치: main

## 개요

M1은 기본 바리스타 풀 + 주문 시스템을 제공하고, M2는 그 위에 다음을 추가합니다:
- **Provider 플러그인 시스템** (Claude Code, Codex)
- **Git Worktree 병렬 실행**
- **Recipe 실행 엔진** (DAG/Parallel/Retry/Timeout)
- **Recipe Studio UI**

이 문서는 M1 기능이 M2에서도 정상 동작하는지 검증하고, M1+M2 조합 시나리오를 테스트합니다.

---

## 전제 조건

### M1 기능 확인

M2 테스트 전에 M1 기능이 정상 동작하는지 확인:

```bash
# 1. Orchestrator 초기화
cd packages/core
pnpm build

# 2. Desktop 실행
cd packages/desktop
pnpm start
```

**M1 기본 동작 체크**:
- [ ] Dashboard에 바리스타/주문 카운트 표시
- [ ] 바리스타 생성 가능 (provider: claude-code)
- [ ] 주문 생성 가능
- [ ] 주문-바리스타 할당 동작
- [ ] 로그 스트리밍

---

## 1. 후방 호환성 테스트

### 1.1 M1 바리스타가 M2에서도 동작하는가? ✅

**목적**: M1의 바리스타 생성 로직이 M2의 IProvider 인터페이스와 호환되는지 검증

**M1 방식 (기존)**:
```javascript
// Desktop UI에서
await window.codecafe.createBarista('claude-code');
```

**M2 방식 (IProvider 적용)**:
```javascript
// 동일하게 동작해야 함
await window.codecafe.createBarista('claude-code');
await window.codecafe.createBarista('codex'); // 신규
```

**테스트 단계**:
1. Desktop 실행
2. "Baristas" 탭 이동
3. "Create Barista" 버튼 클릭
4. Provider 선택: `claude-code`
5. 생성 확인

**체크리스트**:
- [ ] M1 방식으로 바리스타 생성 성공
- [ ] 생성된 바리스타가 IProvider 인터페이스 구현체 사용
- [ ] 바리스타 상태 IDLE → RUNNING 전환 정상
- [ ] 로그 스트리밍 정상 동작

**예상 결과**: M1 코드 변경 없이 M2에서 동작

---

### 1.2 M1 주문이 M2에서도 동작하는가? ✅

**목적**: M1의 주문 생성/실행 로직이 M2의 Order 타입 확장(worktreeInfo)과 호환되는지 검증

**M1 Order 타입**:
```typescript
{
  id: string;
  recipeId: string;
  recipeName: string;
  counter: string;
  provider: ProviderType;
  vars: Record<string, string>;
  // ... 기타
}
```

**M2 Order 타입 (확장)**:
```typescript
{
  // ... M1 필드 유지
  worktreeInfo?: {  // 선택적 필드
    path: string;
    branch: string;
    baseBranch: string;
  };
}
```

**테스트 단계**:
1. Desktop "New Order" 탭 이동
2. M1 방식으로 주문 생성:
   - Recipe: `house-blend-pm-agent`
   - Counter: `.`
   - Provider: `claude-code`
   - Vars: `{"issue": "Test M1 compatibility"}`
3. 주문 생성 및 실행

**체크리스트**:
- [ ] M1 주문 생성 성공 (worktreeInfo 없이)
- [ ] 주문이 idle 바리스타에 할당됨
- [ ] 주문 상태 PENDING → RUNNING → COMPLETED
- [ ] Order Detail에서 로그 확인 가능
- [ ] worktreeInfo 필드가 undefined여도 문제없음

**예상 결과**: M1 주문 로직이 M2에서도 정상 동작 (후방 호환)

---

### 1.3 M1 Receipt가 M2에서도 동작하는가? ✅

**테스트 단계**:
1. M1 방식으로 주문 실행 완료
2. Dashboard에서 "Receipts" 확인 (또는 IPC 호출)

```javascript
const receipts = await window.codecafe.getReceipts();
```

**체크리스트**:
- [ ] Receipt 목록 조회 성공
- [ ] 각 Receipt에 기본 정보 포함 (orderId, status, startedAt, endedAt)
- [ ] M2 필드 없어도 정상 동작

---

## 2. M1 + M2 조합 테스트

### 2.1 M1 바리스타 풀 + M2 Provider 선택 ✅

**목적**: M1의 바리스타 풀에 M2의 새로운 Provider(Codex)를 추가할 수 있는지 검증

**시나리오**:
1. **M1 바리스타 4개 생성** (claude-code)
2. **M2 바리스타 2개 추가** (codex)
3. **바리스타 풀 총 6개 확인**

**테스트 단계**:

**Step 1: M1 바리스타 생성**
```javascript
// Desktop "Baristas" 탭
for (let i = 0; i < 4; i++) {
  await window.codecafe.createBarista('claude-code');
}
```

**Step 2: M2 바리스타 생성**
```javascript
for (let i = 0; i < 2; i++) {
  await window.codecafe.createBarista('codex');
}
```

**Step 3: 바리스타 목록 확인**
```javascript
const baristas = await window.codecafe.getAllBaristas();
console.log(baristas.length); // 6
console.log(baristas.filter(b => b.provider === 'claude-code').length); // 4
console.log(baristas.filter(b => b.provider === 'codex').length); // 2
```

**체크리스트**:
- [ ] 총 6개 바리스타 생성 성공
- [ ] claude-code 4개, codex 2개 구분됨
- [ ] 모든 바리스타 IDLE 상태
- [ ] Dashboard에 6개 바리스타 표시

**예상 결과**: M1 바리스타 풀이 M2 Provider 시스템과 통합됨

---

### 2.2 M1 주문 + M2 Provider 자동 매칭 ✅

**목적**: M1 주문이 M2의 다양한 Provider 바리스타에 올바르게 할당되는지 검증

**시나리오**:
1. **바리스타**: claude-code 2개, codex 2개 (총 4개)
2. **주문 생성**:
   - 주문 A: provider=claude-code
   - 주문 B: provider=codex
   - 주문 C: provider=claude-code
   - 주문 D: provider=codex

**테스트 단계**:

**준비**:
```javascript
// 바리스타 생성
await window.codecafe.createBarista('claude-code'); // B1
await window.codecafe.createBarista('claude-code'); // B2
await window.codecafe.createBarista('codex');       // B3
await window.codecafe.createBarista('codex');       // B4
```

**주문 생성**:
```javascript
// 주문 A (claude-code)
const orderA = await window.codecafe.createOrder({
  recipeId: 'test',
  recipeName: 'Test A',
  counter: '.',
  provider: 'claude-code',
  vars: {}
});

// 주문 B (codex)
const orderB = await window.codecafe.createOrder({
  recipeId: 'test',
  recipeName: 'Test B',
  counter: '.',
  provider: 'codex',
  vars: {}
});
```

**검증**:
```javascript
const baristas = await window.codecafe.getAllBaristas();
const orderA_barista = baristas.find(b => b.currentOrderId === orderA.id);
const orderB_barista = baristas.find(b => b.currentOrderId === orderB.id);

console.log(orderA_barista.provider); // 'claude-code'
console.log(orderB_barista.provider); // 'codex'
```

**체크리스트**:
- [ ] 주문 A가 claude-code 바리스타에 할당됨
- [ ] 주문 B가 codex 바리스타에 할당됨
- [ ] Provider 불일치 시 대기 큐로 이동
- [ ] 올바른 Provider 바리스타가 IDLE 상태일 때 할당

**예상 결과**: Orchestrator가 Provider 타입을 고려하여 주문 할당

---

### 2.3 M1 바리스타 풀 + M2 Parallel Step ✅

**목적**: M1의 4개 바리스타 풀이 M2의 Parallel step 실행 시 제대로 활용되는지 검증

**시나리오**:
- **바리스타 풀**: 4개 (모두 claude-code)
- **Parallel step**: 6개 하위 step
- **예상 동작**: 4+2 배치 실행

**테스트 레시피**:
```yaml
name: test-m1-pool-m2-parallel
version: 0.1.0
defaults:
  provider: claude-code
inputs:
  counter: "."
steps:
  - id: parallel-group
    type: parallel
    steps:
      - id: step1
        type: ai.interactive
        prompt: "Task 1"
      - id: step2
        type: ai.interactive
        prompt: "Task 2"
      - id: step3
        type: ai.interactive
        prompt: "Task 3"
      - id: step4
        type: ai.interactive
        prompt: "Task 4"
      - id: step5
        type: ai.interactive
        prompt: "Task 5"
      - id: step6
        type: ai.interactive
        prompt: "Task 6"
```

**실행**:
```bash
cd packages/cli
node dist/index.js brew --recipe test-m1-pool-m2-parallel.yaml --counter .
```

**예상 로그**:
```
[Parallel] parallel-group - 6 steps
[Batch 1] Executing 4 steps (barista pool size: 4)
  step1, step2, step3, step4 - RUNNING
[Batch 1] Complete
[Batch 2] Executing 2 steps
  step5, step6 - RUNNING
[Batch 2] Complete
✅ All parallel steps completed
```

**체크리스트**:
- [ ] 바리스타 풀 크기(4) 인식
- [ ] Batch 1: 4개 step 병렬 실행
- [ ] Batch 2: 나머지 2개 step 실행
- [ ] 모든 바리스타가 순차+병렬 혼합으로 활용됨

**예상 결과**: M1 바리스타 풀이 M2 Parallel 실행 엔진과 완벽 통합

---

### 2.4 M1 주문 → M2 Worktree 모드 전환 ✅

**목적**: M1의 in-place 모드 주문을 M2의 worktree 모드로 전환할 수 있는지 검증

**시나리오**:
1. **M1 주문** (in-place 모드)
2. **M2 주문** (worktree 모드)
3. 두 주문 비교

**M1 주문 (기존)**:
```yaml
name: m1-order
defaults:
  workspace:
    mode: in-place  # M1 기본값
inputs:
  counter: "/tmp/test-repo"
steps:
  - id: step1
    type: ai.interactive
    prompt: "M1 task"
```

**M2 주문 (worktree)**:
```yaml
name: m2-order
defaults:
  workspace:
    mode: worktree
    baseBranch: main
    clean: false
inputs:
  counter: "/tmp/test-repo"
steps:
  - id: step1
    type: ai.interactive
    prompt: "M2 task"
```

**실행**:
```bash
# M1 방식
codecafe brew --recipe m1-order.yaml --counter /tmp/test-repo

# M2 방식
codecafe brew --recipe m2-order.yaml --counter /tmp/test-repo
```

**검증**:
```bash
# M1: 원본 repo에서 직접 실행됨
cd /tmp/test-repo
git status  # 변경사항 있음

# M2: worktree에서 실행됨
cd /tmp/test-repo
git status  # 변경사항 없음 (깨끗)
git worktree list  # worktree 목록 확인
```

**체크리스트**:
- [ ] M1 주문: 원본 repo에서 실행
- [ ] M2 주문: worktree에서 실행
- [ ] M2 주문 후 원본 repo 깨끗한 상태
- [ ] 두 주문 모두 동일한 바리스타 풀 사용

**예상 결과**: M1과 M2 주문이 workspace 모드만 다르고 나머지는 동일하게 동작

---

## 3. M1 Desktop UI + M2 기능

### 3.1 Dashboard: M1 카운트 + M2 Provider 구분 ✅

**목적**: M1 Dashboard에 M2 Provider 정보가 추가로 표시되는지 검증

**테스트 단계**:
1. Desktop 실행
2. Dashboard 탭 확인

**M1 Dashboard (기존)**:
```
Baristas: 4
Orders: 10
```

**M2 Dashboard (추가 정보)**:
```
Baristas: 6 (Claude Code: 4, Codex: 2)
Orders: 10
Recent Orders:
  - Order A (claude-code) - RUNNING
  - Order B (codex) - COMPLETED
```

**체크리스트**:
- [ ] 바리스타 총 개수 표시
- [ ] Provider별 개수 표시 (선택적)
- [ ] 주문 목록에 Provider 정보 표시
- [ ] M1 기능 유지 (카운트, 상태)

---

### 3.2 New Order: M1 폼 + M2 Provider 드롭다운 ✅

**M1 New Order (기존)**:
```html
Recipe: [input]
Counter: [input]
Vars: [textarea]
[Create Order]
```

**M2 New Order (확장)**:
```html
Provider: [dropdown: claude-code, codex]  ← 신규
Recipe: [input]
Counter: [input]
Vars: [textarea]
[Create Order]
```

**체크리스트**:
- [ ] M1 필드 모두 유지
- [ ] M2 Provider 드롭다운 추가
- [ ] 기본값: claude-code
- [ ] 제출 시 provider 필드 포함

---

### 3.3 Order Detail: M1 로그 + M2 Worktree 정보 ✅

**M1 Order Detail (기존)**:
```
ID: order-123
Recipe: test-recipe
Status: COMPLETED
Counter: /tmp/repo
Provider: claude-code
Barista: barista-1

Logs:
[로그 내용...]

[Back] [Cancel]
```

**M2 Order Detail (확장)**:
```
ID: order-123
Recipe: test-recipe
Status: COMPLETED
Counter: /tmp/repo
Provider: claude-code
Barista: barista-1
Worktree: /tmp/.codecafe-worktrees/order-123  ← 신규
Branch: order-123  ← 신규

Logs:
[로그 내용...]

[Back] [Cancel] [Export Patch]  ← 신규 버튼
```

**체크리스트**:
- [ ] M1 필드 모두 표시
- [ ] Worktree 정보 표시 (worktree 모드인 경우에만)
- [ ] "Export Patch" 버튼 (worktree 모드인 경우에만)
- [ ] M1 주문(in-place)에서는 Worktree 정보 미표시

---

## 4. E2E 통합 시나리오

### 시나리오 A: M1 바리스타 풀로 M2 Parallel + Worktree 실행 ✅

**목적**: M1과 M2의 모든 핵심 기능을 조합한 전체 워크플로우 검증

**단계**:

1. **M1: 바리스타 풀 생성 (Desktop)**
   ```javascript
   // 4개 바리스타 생성 (claude-code)
   for (let i = 0; i < 4; i++) {
     await window.codecafe.createBarista('claude-code');
   }
   ```

2. **M2: Parallel + Worktree 레시피 생성 (Recipe Studio)**
   ```yaml
   name: full-integration-test
   version: 0.1.0
   defaults:
     provider: claude-code
     workspace:
       mode: worktree
       baseBranch: main
       clean: false
   inputs:
     counter: "/tmp/test-repo"
   steps:
     - id: parallel-tasks
       type: parallel
       steps:
         - id: task1
           type: ai.interactive
           prompt: "Implement feature A"
         - id: task2
           type: ai.interactive
           prompt: "Implement feature B"
         - id: task3
           type: ai.interactive
           prompt: "Implement feature C"
   ```

3. **M2: CLI로 실행**
   ```bash
   codecafe brew --recipe full-integration-test.yaml --counter /tmp/test-repo
   ```

4. **M1: Dashboard에서 모니터링**
   - 바리스타 상태 확인 (IDLE → RUNNING)
   - 주문 상태 확인 (PENDING → RUNNING → COMPLETED)

5. **M2: Worktree 목록 확인 (Desktop)**
   - Worktrees 탭 이동
   - Repository Path: `/tmp/test-repo`
   - Load 버튼 클릭
   - 생성된 worktree 확인

6. **M2: 각 Worktree 패치 내보내기**
   - Export Patch 버튼 클릭
   - Base branch: `main`
   - 패치 파일 확인

7. **검증: 원본 Repo 상태**
   ```bash
   cd /tmp/test-repo
   git status  # 깨끗한 상태 확인
   git worktree list  # worktree 목록 확인
   ```

**체크리스트**:
- [ ] M1 바리스타 풀 생성 성공
- [ ] M2 Recipe Studio에서 레시피 작성/저장
- [ ] CLI brew 명령 실행 성공
- [ ] Parallel step 배치 실행 (4개 바리스타로)
- [ ] 각 parallel step마다 worktree 생성됨
- [ ] M1 Dashboard에서 실시간 모니터링
- [ ] M2 Worktrees 탭에서 목록 확인
- [ ] 패치 내보내기 성공
- [ ] 원본 repo 깨끗한 상태 유지

**예상 결과**: M1 + M2 모든 기능이 완벽하게 통합되어 동작

---

### 시나리오 B: Provider 혼합 병렬 실행 ✅

**목적**: Claude Code와 Codex Provider를 동시에 사용하는 복합 시나리오

**단계**:

1. **바리스타 풀 생성**
   - Claude Code: 2개
   - Codex: 2개

2. **레시피 작성** (다른 Provider 사용)
   ```yaml
   name: multi-provider-test
   version: 0.1.0
   inputs:
     counter: "."
   steps:
     - id: parallel-mixed
       type: parallel
       steps:
         - id: claude-task
           type: ai.interactive
           provider: claude-code  # 명시적 지정
           prompt: "Claude task"
         - id: codex-task
           type: ai.interactive
           provider: codex  # 명시적 지정
           prompt: "Codex task"
   ```

3. **실행 및 검증**
   - Claude task → claude-code 바리스타 할당
   - Codex task → codex 바리스타 할당
   - 두 task 동시 실행

**체크리스트**:
- [ ] 각 step이 올바른 Provider 바리스타에 할당
- [ ] 병렬 실행 정상 동작
- [ ] Provider별 로그 구분 가능

---

## 5. 마이그레이션 테스트

### 5.1 M1 데이터 → M2 호환성 ✅

**목적**: M1에서 생성한 데이터가 M2에서도 읽히는지 검증

**M1 데이터 예시**:
```json
// ~/.codecafe/data/orders/order-1.json
{
  "id": "order-1",
  "recipeId": "pm-agent",
  "recipeName": "PM Agent",
  "counter": ".",
  "provider": "claude-code",
  "vars": {"issue": "Test"},
  "status": "COMPLETED",
  "createdAt": "2026-01-08T00:00:00Z"
  // worktreeInfo 없음
}
```

**M2 읽기 테스트**:
```javascript
const orders = await window.codecafe.getAllOrders();
const order = orders.find(o => o.id === 'order-1');

console.log(order.worktreeInfo);  // undefined (정상)
console.log(order.status);  // 'COMPLETED' (정상)
```

**체크리스트**:
- [ ] M1 주문 데이터 읽기 성공
- [ ] worktreeInfo 없어도 에러 없음
- [ ] M1 Receipt 읽기 성공

---

### 5.2 M1 → M2 점진적 마이그레이션 ✅

**시나리오**: M1 사용 중 M2 기능 점진적 도입

**단계**:

1. **Day 1: M1만 사용**
   - 바리스타: claude-code 4개
   - 주문: in-place 모드만

2. **Day 2: M2 Provider 추가**
   - 바리스타: claude-code 4개 + codex 2개
   - 주문: 여전히 in-place 모드

3. **Day 3: M2 Worktree 도입**
   - 일부 주문만 worktree 모드 사용
   - 기존 주문은 in-place 유지

4. **Day 4: M2 Parallel 활용**
   - 복잡한 작업에만 parallel step 사용

**체크리스트**:
- [ ] 각 단계마다 기존 기능 정상 동작
- [ ] M1 주문과 M2 주문 혼재 가능
- [ ] 데이터 호환성 유지

---

## 6. 성능 비교

### M1 vs M2 실행 시간 ✅

**테스트**: 동일한 작업을 M1 방식과 M2 방식으로 실행

**M1 방식** (순차 실행):
```yaml
steps:
  - id: task1
    type: ai.interactive
    prompt: "Task 1"
  - id: task2
    type: ai.interactive
    prompt: "Task 2"
  - id: task3
    type: ai.interactive
    prompt: "Task 3"
```

**M2 방식** (병렬 실행):
```yaml
steps:
  - id: parallel
    type: parallel
    steps:
      - id: task1
        type: ai.interactive
        prompt: "Task 1"
      - id: task2
        type: ai.interactive
        prompt: "Task 2"
      - id: task3
        type: ai.interactive
        prompt: "Task 3"
```

**예상 성능**:
- M1: 각 task 5분 → 총 15분
- M2 (3개 바리스타): 각 task 5분 → 총 5분 (3배 빠름)

**체크리스트**:
- [ ] M2 병렬 실행이 M1 순차 실행보다 빠름
- [ ] 바리스타 수에 비례하여 성능 향상

---

## 통합 테스트 체크리스트

### 필수 테스트

| 테스트 | 상태 | 비고 |
|--------|------|------|
| M1 바리스타가 M2에서 동작 | ⬜ | 후방 호환성 |
| M1 주문이 M2에서 동작 | ⬜ | 후방 호환성 |
| M1 바리스타 풀 + M2 Provider | ⬜ | 조합 |
| M1 바리스타 풀 + M2 Parallel | ⬜ | 조합 |
| M1 주문 → M2 Worktree 전환 | ⬜ | 마이그레이션 |
| M1 Dashboard + M2 기능 | ⬜ | UI 통합 |
| E2E: M1+M2 전체 워크플로우 | ⬜ | 시나리오 |

---

## 빠른 통합 테스트 스크립트

```bash
#!/bin/bash
# M1-M2 Integration Quick Test

echo "=== M1-M2 Integration Test ==="

# 1. M1 기능 확인
echo "1. Testing M1 compatibility..."
cd packages/desktop
pnpm start &
DESKTOP_PID=$!
sleep 5

# 2. M1 바리스타 생성 (프로그래밍 방식으로 가정)
echo "2. Creating M1 baristas..."
# 실제로는 Desktop UI에서 수동으로 생성

# 3. M2 레시피 테스트
echo "3. Testing M2 recipe..."
cd ../cli
cat > /tmp/integration-test.yaml <<'EOF'
name: integration
version: 0.1.0
defaults:
  provider: claude-code
  workspace:
    mode: in-place
inputs:
  counter: "."
steps:
  - id: test
    type: ai.interactive
    prompt: "M1-M2 integration test"
EOF

node dist/index.js brew --recipe /tmp/integration-test.yaml --counter .

# 4. 정리
kill $DESKTOP_PID

echo "=== Integration Test Complete ==="
```

---

## 문제 해결

### Q1: M1 주문이 M2에서 실행 안 됨

**증상**: M1 방식으로 만든 주문이 PENDING 상태에서 멈춤

**원인**: M2에서 Provider 필드가 필수이지만 M1 주문에는 없음

**해결**:
```typescript
// M2 Orchestrator에서 기본값 설정
const provider = order.provider || 'claude-code'; // fallback
```

---

### Q2: M1 바리스타와 M2 Provider 불일치

**증상**: M1 바리스타가 M2 주문을 처리 못함

**원인**: M1 바리스타에 provider 필드가 없음

**해결**: M1 바리스타 생성 시 provider 기본값 설정

---

## 결론

M1과 M2는 다음과 같이 통합됩니다:

1. **후방 호환성**: M1 기능이 M2에서 그대로 동작
2. **확장성**: M2 기능이 M1 위에 추가로 제공
3. **점진적 마이그레이션**: M1 → M2로 단계적 전환 가능
4. **성능 향상**: M2 Parallel 실행이 M1 순차 실행보다 빠름

**최종 검증**: E2E 시나리오 A 통과 시 M1-M2 통합 완료

---

**문서 버전**: M1-M2 Integration v1.0
**최종 업데이트**: 2026-01-09
