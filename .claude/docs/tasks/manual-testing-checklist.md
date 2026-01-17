# Phase 2 Manual Testing Checklist

**Date**: 2026-01-13
**Version**: Phase 2 완료 후 검증
**Tester**: [수동 테스트 실행자 이름]

---

## 📋 사전 준비

### 1. 빌드 및 타입 체크

```bash
# 전체 빌드
pnpm build

# 타입 체크
pnpm typecheck

# 자동화 테스트 실행
pnpm test
```

**Expected**: 모두 성공

- [✅] Build 성공
- [✅] Typecheck 통과
- [✅] 모든 테스트 통과 (41개 테스트, 부하 테스트 6개 포함)

---

## 🖥️ Desktop 앱 실행

### 2. 앱 시작

```bash
cd packages/desktop
pnpm dev
```

**Expected**: Electron 앱이 정상적으로 실행됨

- [✅] 앱 창이 열림
- [✅] Console에 에러 없음
- [✅] Dashboard가 표시됨

---

## 🎭 Role System 테스트

### 3. Role Manager 접근

**Steps**:

1. 좌측 메뉴에서 "Roles" 클릭 (또는 `/roles` 경로로 이동)

**Expected**:

- [ ] Role Manager 페이지가 표시됨
- [ ] "Default Roles" 섹션이 보임
- [ ] 5개의 기본 role이 표시됨:
  - [ ] planner
  - [ ] coder
  - [ ] tester
  - [ ] reviewer
  - [ ] generic-agent

### 4. Role 상세 정보 확인

**Steps**:

1. 각 role 카드를 클릭하여 상세 정보 확인

**Expected** (각 role마다):

- [ ] Role ID 표시
- [ ] Role Name 표시
- [ ] Recommended Provider 표시 (claude-code)
- [ ] Skills 목록 표시
- [ ] Variables 정보 표시 (있는 경우)

### 5. Role 카드 UI 검증

**Expected**:

- [ ] 카드 레이아웃이 깔끔함
- [ ] Provider badge 색상이 표시됨
- [ ] Skills가 chip 형태로 표시됨
- [ ] Default role badge가 보임

---

## 🏊 Terminal Pool Status 테스트

### 6. Dashboard Terminal Pool 섹션

**Steps**:

1. Dashboard로 이동 (`/` 경로)

**Expected**:

- [ ] 3칸 그리드 레이아웃 표시:
  - [ ] Baristas (좌측)
  - [ ] **Terminal Pool Status (중앙)** ⭐
  - [ ] Recent Orders (우측)

### 7. Terminal Pool Status 카드 확인

**Expected** (Terminal Pool Status 카드):

- [ ] "Terminal Pool Status" 제목 표시
- [ ] Provider별 상태 표시 (claude-code, codex 등)
- [ ] 각 Provider마다:
  - [ ] Total/Idle/Busy/Crashed terminals 숫자 표시
  - [ ] Active Leases 표시
  - [ ] P99 Wait Time 표시
  - [ ] Utilization bar (진행 막대) 표시
  - [ ] Utilization percentage 표시

### 8. Terminal Pool 자동 새로고침

**Steps**:

1. Terminal Pool Status 카드를 5초 이상 관찰

**Expected**:

- [ ] 5초마다 자동으로 데이터가 갱신됨
- [ ] 갱신 시 깜빡임 없이 부드럽게 업데이트됨

### 9. Terminal Pool 초기화 (선택)

**Steps**:

1. Browser DevTools Console 열기
2. 다음 명령 실행:

```javascript
await window.api.terminal.init({
  perProvider: {
    'claude-code': { size: 5, timeout: 30000, maxRetries: 3 },
  },
});
```

**Expected**:

- [ ] Success response 반환
- [ ] Terminal Pool Status 카드에서 Total terminals = 5로 표시됨 (초기화 후)

---

## 📦 Order Creation with Roles

### 10. Order Creation Kiosk 접근

**Steps**:

1. "Orders" 메뉴 클릭
2. "Create New Order" 버튼 클릭 (또는 `/orders/new` 경로)

**Expected**:

- [ ] Order Creation Kiosk 페이지가 표시됨
- [ ] Order 입력 폼이 보임

### 11. Role 선택 기능 확인

**Expected** (Order Creation Form):

- [ ] Role 선택 드롭다운/필드가 있음
- [ ] Role 목록에 5개 role이 모두 표시됨
- [ ] Role 선택 가능

### 12. Order 생성 (선택)

**Steps**:

1. Order 정보 입력
2. Role 선택
3. "Create Order" 버튼 클릭

**Expected**:

- [ ] Order가 생성됨
- [ ] Success 메시지 표시
- [ ] Orders 목록으로 리다이렉트됨

---

## 🔧 IPC API 테스트

### 13. Role IPC API 테스트 (Browser Console)

**Steps**:

1. Browser DevTools Console 열기
2. 다음 명령들을 순서대로 실행:

```javascript
// 1. 모든 role 조회
const allRoles = await window.api.role.list();
console.log('All roles:', allRoles);

// 2. 특정 role 조회
const planner = await window.api.role.get('planner');
console.log('Planner role:', planner);

// 3. Default roles 조회
const defaults = await window.api.role.listDefault();
console.log('Default roles:', defaults);
```

**Expected**:

- [ ] `role.list()`: 5개 role 반환, success: true
- [ ] `role.get('planner')`: planner role 객체 반환
  - [ ] id, name, systemPrompt, skills, recommendedProvider, variables, isDefault, source 필드 포함
- [ ] `role.listDefault()`: 5개 default role 반환 (isDefault: true)

### 14. Terminal IPC API 테스트 (Browser Console)

**Steps**:

```javascript
// 1. Pool status 조회
const status = await window.api.terminal.getStatus();
console.log('Pool status:', status);

// 2. Metrics 조회
const metrics = await window.api.terminal.getMetrics();
console.log('Pool metrics:', metrics);
```

**Expected**:

- [ ] `terminal.getStatus()`: PoolStatus 객체 반환
  - [ ] providers 객체 포함 (각 provider별 상태)
- [ ] `terminal.getMetrics()`: PoolMetrics 객체 반환
  - [ ] providers 객체 포함 (각 provider별 metrics)
  - [ ] p99WaitTime 필드 포함

### 15. IPC 에러 처리 테스트 (Browser Console)

**Steps**:

```javascript
// 존재하지 않는 role 조회
const notFound = await window.api.role.get('nonexistent-role');
console.log('Not found response:', notFound);
```

**Expected**:

- [ ] success: false
- [ ] error 객체 포함:
  - [ ] code: "ROLE_NOT_FOUND"
  - [ ] message: "Role not found: nonexistent-role"

---

## 🚀 Performance 관찰

### 16. UI 반응성 테스트

**Steps**:

1. Role Manager, Dashboard, Orders 페이지 간 빠르게 전환

**Expected**:

- [ ] 페이지 전환이 즉각적 (< 100ms)
- [ ] UI가 부드럽게 렌더링됨
- [ ] 깜빡임이나 레이아웃 shift 없음

### 17. Terminal Pool Metrics 확인

**Steps**:

1. Dashboard의 Terminal Pool Status 카드 확인
2. P99 Wait Time 값 기록: **\_\_** ms

**Expected**:

- [ ] P99 Wait Time < 100ms (부하 테스트 결과: 14ms)
- [ ] Utilization이 합리적인 범위 (0-100%)

---

## 📊 Data 일관성 테스트

### 18. Role 데이터 일관성

**Steps**:

1. Role Manager에서 role 개수 확인: **\_** 개
2. Console에서 `window.api.role.list()` 실행하여 개수 확인: **\_** 개

**Expected**:

- [ ] 두 값이 동일 (5개)

### 19. Terminal Pool 데이터 일관성

**Steps**:

1. Dashboard Terminal Pool Status에서 Total terminals 확인: **\_** 개
2. Console에서 `window.api.terminal.getStatus()` 실행하여 확인

**Expected**:

- [ ] UI와 IPC 응답의 값이 동일

---

## 🐛 에러 시나리오 테스트

### 20. 네트워크 에러 시뮬레이션 (선택)

**Steps**:

1. Browser DevTools Network 탭에서 "Offline" 설정
2. Role Manager 페이지 새로고침

**Expected**:

- [ ] 에러 메시지가 사용자 친화적으로 표시됨
- [ ] 앱이 크래시하지 않음

### 21. Invalid Role ID 테스트

**Steps**:

```javascript
await window.api.role.get('../../etc/passwd'); // Path traversal 시도
```

**Expected**:

- [ ] success: false
- [ ] error.code: "ROLE_VALIDATION_FAILED" 또는 "ROLE_NOT_FOUND"
- [ ] 보안 위험 없음 (path traversal 차단됨)

---

## ✅ 통합 시나리오 테스트

### 22. End-to-End 워크플로우

**Steps**:

1. Dashboard 접근
2. Terminal Pool Status 확인 (pool 상태 정상)
3. Role Manager 접근 → 5개 role 확인
4. planner role 선택 → 상세 정보 확인
5. Orders 메뉴 → Create New Order
6. planner role 선택하여 order 생성
7. Dashboard로 돌아와서 Recent Orders 확인

**Expected**:

- [ ] 전체 흐름이 매끄럽게 진행됨
- [ ] 각 단계에서 에러 없음
- [ ] 데이터가 일관되게 표시됨

---

## 📝 테스트 결과 요약

### 통과한 테스트 수: **\_** / 60

### 발견된 이슈

| 번호 | 테스트 항목 | 이슈 설명 | 심각도 (High/Medium/Low) |
| ---- | ----------- | --------- | ------------------------ |
| 1    |             |           |                          |
| 2    |             |           |                          |
| 3    |             |           |                          |

### 전체 평가

- [ ] **Pass**: 모든 핵심 기능이 정상 동작함
- [ ] **Pass with Minor Issues**: 대부분 정상, 일부 개선 필요
- [ ] **Fail**: 심각한 문제 발견, 수정 필요

### 추가 의견

```
[테스트 중 발견한 개선 사항이나 의견을 자유롭게 작성]
```

---

## 🎯 Phase 2 완료 기준 충족 여부

### Gap 해결 검증

| Gap                                    | 검증 항목                                   | 통과 여부 |
| -------------------------------------- | ------------------------------------------- | --------- |
| **Gap 1: Terminal Execution Contract** | Role IPC가 실제 role 파일을 로드함          | ☐         |
| **Gap 2: TerminalPool Concurrency**    | Terminal Pool Status에서 p99 metrics 표시됨 | ☐         |
| **Gap 3: IPC/UI API Contracts**        | IPC 에러 처리가 정상 동작함                 | ☐         |
| **Gap 4: Backward Compatibility**      | 5개 기본 role이 모두 표시됨                 | ☐         |
| **Gap 5: Crash Recovery**              | (자동 테스트로 검증됨)                      | ✅        |

### 최종 확인

- [ ] UI가 사용자 친화적임
- [ ] 성능이 만족스러움 (P99 < 100ms)
- [ ] 에러 처리가 적절함
- [ ] 데이터 일관성이 유지됨
- [ ] 프로덕션 배포 가능 수준

---

**테스트 완료 일시**: **\*\***\_\_\_**\*\***
**테스터 서명**: **\*\***\_\_\_**\*\***
**다음 단계**: [테스트 결과에 따라 결정]
