# Multi-Cafe UI Rebuild

## 목표
Sidebar 기반 Multi-Cafe Navigation 구조로 전환. N개 Cafe 동시 작업 및 Global Settings 분리.

## 확정 요구사항

### 1. Sidebar Multi-Cafe Navigation
- Sidebar 상단에 Cafe 리스트 (collapsible)
- 클릭으로 Cafe 전환 → Dashboard 이동
- `[Manage...]` 링크로 GlobalLobby 접근

### 2. Global Settings 분리
- Sidebar 하단에 구분선 + Global 메뉴
- Recipes, Skills, Roles → Cafe 독립적

### 3. GlobalLobby 역할
- Cafe 없음 → Onboarding (첫 진입점)
- Cafe 있음 → 마지막 Cafe Dashboard 직행
- Manage 용도로만 접근

### 4. Dashboard = Order Hub
- 현재 Cafe의 Order 요약 + 실시간 + 빠른 액션

---

## 변경 파일 목록

| 파일 | 변경 내용 |
|-----|----------|
| `Sidebar.tsx` | Cafe 리스트 섹션 + Global 하단 분리 |
| `App.tsx` | 앱 시작 시 분기 로직 (cafe 유무) |
| `useViewStore.ts` | 필요시 view params 확장 |
| `GlobalLobby.tsx` | Onboarding/Manage 모드 구분 |
| `CafeDashboard.tsx` | Order Hub UI 강화 (선택적) |

---

## 구현 순서

1. **Sidebar.tsx 리팩토링**
   - Cafe 리스트 컴포넌트 추가
   - 하단 Global Settings 분리
   
2. **App.tsx 시작 로직**
   - `cafes.length === 0` → GlobalLobby
   - else → 마지막 Cafe Dashboard
   
3. **GlobalLobby.tsx 조정**
   - Onboarding 모드 vs Manage 모드 UI 분기

4. **테스트 및 검증**

---

## 검증 계획

```bash
pnpm dev
```
- 2개 이상 Cafe 등록 후 Sidebar 전환 테스트
- Global 메뉴 Cafe 무관하게 접근 확인
- 앱 재시작 시 마지막 Cafe 유지 확인
