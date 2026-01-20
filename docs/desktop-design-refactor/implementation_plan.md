# Desktop Design Migration Plan

## 목표

새로운 디자인 프로젝트 (`docs/desktop-design-refactor/codecafe-desktop`)의 스타일을  
기존 desktop 패키지에 적용합니다.

---

## 1. 현재 상태 비교

| 항목 | 기존 Desktop | 새 디자인 |
|------|--------------|-----------|
| **스타일링** | Tailwind CSS | Tailwind CSS |
| **컬러 팔레트** | background/#121212 기반 | cafe/950-100 Warm Stone |
| **브랜드 색상** | coffee/#6F4E37 | brand/amber-600 |
| **폰트** | 시스템 폰트 | Inter + JetBrains Mono |
| **아이콘** | Lucide React | Lucide React |

---

## 2. 마이그레이션 범위

### Phase 1: 디자인 시스템 업데이트 (Foundation)
- [ ] tailwind.config.cjs 컬러 팔레트 교체
- [ ] 폰트 설정 추가 (Inter, JetBrains Mono)
- [ ] index.css 스크롤바 스타일 업데이트

### Phase 2: 공통 컴포넌트 마이그레이션
- [ ] Sidebar.tsx 스타일 업데이트
- [ ] ui/Button.tsx 스타일 업데이트
- [ ] ui/Card.tsx 스타일 업데이트

### Phase 3: 뷰 컴포넌트 마이그레이션
- [ ] GlobalLobby.tsx (= CafeDashboard)
- [ ] Orders.tsx (= OrderInterface)
- [ ] Workflows.tsx (= RecipeManager)
- [ ] Skills.tsx (= SkillManager)

---

## 3. 상세 변경 사항

### 3.1 tailwind.config.cjs

**현재**:
```javascript
colors: {
  background: '#121212',
  card: '#1C1C1C',
  espresso: '#3C2218',
  coffee: '#6F4E37',
  bone: '#E6D6C8',
  sidebar: '#252525',
  border: '#333333',
}
```

**변경**:
```javascript
colors: {
  cafe: {
    950: '#0c0a09', // Deepest Espresso
    900: '#1c1917', // Dark Roast
    850: '#23201d', // Panel Background
    800: '#292524', // Card Background
    700: '#44403c', // Borders
    600: '#57534e', // Muted Text
    500: '#78716c', // Secondary Text
    400: '#a8a29e', // Primary Text
    300: '#d6d3d1', // High Contrast Text
    200: '#e7e5e4', // Headings
    100: '#f5f5f4', // White Text
  },
  brand: {
    DEFAULT: '#d97706', // amber-600
    hover: '#b45309',   // amber-700
    light: '#fbbf24',   // amber-400
    subtle: '#78350f',  // amber-900
  },
  terminal: {
    bg: '#120f0e',
  },
  // 호환성 유지 (점진적 마이그레이션)
  background: '#0c0a09',
  card: '#292524',
  coffee: '#d97706',
  bone: '#e7e5e4',
  sidebar: '#1c1917',
  border: '#44403c',
}
```

### 3.2 폰트 설정

**index.html**:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

**tailwind.config.cjs**:
```javascript
fontFamily: {
  sans: ['Inter', 'system-ui', 'sans-serif'],
  mono: ['JetBrains Mono', 'monospace'],
}
```

### 3.3 index.css 업데이트

```css
/* Terminal scrollbar - Coffee Themed */
.terminal-scroll::-webkit-scrollbar {
  width: 8px;
}
.terminal-scroll::-webkit-scrollbar-track {
  background: #1c1917; /* cafe-900 */
}
.terminal-scroll::-webkit-scrollbar-thumb {
  background: #44403c; /* cafe-700 */
  border-radius: 4px;
}
.terminal-scroll::-webkit-scrollbar-thumb:hover {
  background: #57534e; /* cafe-600 */
}
```

---

## 4. 컴포넌트 매핑

| 새 디자인 | 기존 Desktop | 변경 방식 |
|-----------|--------------|-----------|
| `Sidebar.tsx` | `layout/Sidebar.tsx` | 스타일 교체 |
| `CafeDashboard.tsx` | `views/GlobalLobby.tsx` | 스타일 교체 |
| `OrderInterface.tsx` | `views/CafeDashboard.tsx` + `order/*` | 구조 참고, 스타일 교체 |
| `RecipeManager.tsx` | `views/Workflows.tsx` | 스타일 교체 |
| `SkillManager.tsx` | `views/Skills.tsx` | 스타일 교체 |

---

## 5. 마이그레이션 전략

### Option A: 점진적 마이그레이션 (권장)
1. **Phase 1**: 컬러 팔레트만 먼저 적용 (호환성 alias 유지)
2. **Phase 2**: 컴포넌트별로 클래스 업데이트
3. **Phase 3**: 구식 색상 alias 제거

**장점**: 안전, 점진적, 롤백 용이  
**단점**: 시간이 더 걸림

### Option B: 전체 교체
1. 새 디자인 컴포넌트를 그대로 복사
2. IPC 연동 코드만 추가
3. 기존 컴포넌트 제거

**장점**: 빠름, 깔끔  
**단점**: 리스크 높음, 기능 누락 가능

---

## 6. 작업 순서 (Phase 1 상세)

### Step 1: tailwind.config.cjs 업데이트
```
1. cafe 팔레트 추가
2. brand 팔레트 추가
3. 폰트 설정 추가
4. 기존 색상은 호환성 alias로 유지
```

### Step 2: index.html 폰트 로드 추가
```
1. Google Fonts 링크 추가
2. Inter + JetBrains Mono
```

### Step 3: index.css 스크롤바 업데이트
```
1. terminal-scroll 클래스 스타일 추가
2. cafe 컬러 사용
```

### Step 4: 빌드 및 검증
```
1. pnpm typecheck
2. pnpm build
3. 앱 실행하여 스타일 확인
```

---

## 7. 검증 계획

### 자동 테스트
```bash
# 타입체크
pnpm typecheck

# 빌드 검증
pnpm build
```

### 수동 테스트
1. 앱 실행 (`pnpm dev` in desktop)
2. 각 화면 시각적 확인:
   - [ ] Lobby 화면 배경색, 폰트
   - [ ] Sidebar 네비게이션 하이라이트
   - [ ] Order 생성 모달 스타일
   - [ ] Terminal 출력 스크롤바
   - [ ] Recipes/Skills 탭 스타일

---

## 8. 롤백 계획

Git 커밋 단위로 작업하여 문제 발생 시:
```bash
git revert <commit-hash>
```

---

## 9. 예상 작업 시간

| Phase | 예상 시간 |
|-------|-----------|
| Phase 1: Foundation | 30분 |
| Phase 2: 공통 컴포넌트 | 1시간 |
| Phase 3: 뷰 컴포넌트 | 2-3시간 |
| 테스트 및 조정 | 1시간 |
| **총합** | **4-5시간** |

---

## 다음 단계

Phase 1 (Foundation) 작업부터 진행할까요?

- tailwind.config.cjs 업데이트
- 폰트 설정 추가
- 스크롤바 스타일 업데이트
