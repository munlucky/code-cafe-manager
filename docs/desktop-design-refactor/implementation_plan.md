# Desktop Design Migration Plan v2 (Design-First)

## 목표

새 디자인 컴포넌트를 **그대로 사용**하고, 기존 IPC 기능만 연결합니다.

```
새 디자인 (codecafe-desktop)     기존 Desktop (packages/desktop)
┌─────────────────────────────┐  ┌─────────────────────────────┐
│ • App.tsx (Mock Data)       │  │ • window.codecafe API       │
│ • Sidebar.tsx               │  │ • IPC Handlers              │
│ • CafeDashboard.tsx         │  │ • Zustand Stores            │
│ • OrderInterface.tsx        │  │ • useIpcEffect Hook         │
│ • RecipeManager.tsx         │  │ • Type Definitions          │
│ • SkillManager.tsx          │  │                             │
└─────────────────────────────┘  └─────────────────────────────┘
              │                              │
              └──────────┬───────────────────┘
                         ▼
              ┌─────────────────────────┐
              │   최종 Desktop 앱       │
              │ 새 디자인 + IPC 연결    │
              └─────────────────────────┘
```

---

## 작업 개요

| 단계 | 작업 | 예상 시간 |
|------|------|-----------|
| 1 | 새 컴포넌트 복사 | 10분 |
| 2 | Tailwind 설정 동기화 | 10분 |
| 3 | App.tsx IPC 연결 | 30분 |
| 4 | Sidebar IPC 연결 | 15분 |
| 5 | CafeDashboard IPC 연결 | 20분 |
| 6 | OrderInterface IPC 연결 | 1시간 |
| 7 | RecipeManager IPC 연결 | 30분 |
| 8 | SkillManager IPC 연결 | 30분 |
| 9 | 빌드 및 테스트 | 30분 |
| **총합** | | **~4시간** |

---

## Phase 1: 컴포넌트 복사

### 복사할 파일
```
docs/desktop-design-refactor/codecafe-desktop/
├── App.tsx           → packages/desktop/src/renderer/App.tsx
├── types.ts          → packages/desktop/src/renderer/types/design.ts
└── components/
    ├── Sidebar.tsx       → components/layout/Sidebar.tsx
    ├── CafeDashboard.tsx → components/views/GlobalLobby.tsx
    ├── OrderInterface.tsx→ components/views/CafeDashboard.tsx
    ├── RecipeManager.tsx → components/views/Workflows.tsx
    └── SkillManager.tsx  → components/views/Skills.tsx
```

### Tailwind 설정 동기화
```
docs/.../codecafe-desktop/index.html의 tailwind.config
→ packages/desktop/tailwind.config.cjs에 반영
```

---

## Phase 2: IPC 연결 (컴포넌트별)

### App.tsx 변환

**Mock → IPC**:
```typescript
// Before (Mock)
const [cafes, setCafes] = useState<Cafe[]>([...MOCK_DATA]);
const [recipes, setRecipes] = useState<Recipe[]>(DEFAULT_RECIPES);

// After (IPC)
const [cafes, setCafes] = useState<Cafe[]>([]);
const [recipes, setRecipes] = useState<Recipe[]>([]);

useEffect(() => {
  const loadData = async () => {
    const cafeRes = await window.codecafe.cafe.getAll();
    if (cafeRes.success) setCafes(cafeRes.data);
    
    const recipeRes = await window.codecafe.workflow.list();
    if (recipeRes.success) setRecipes(recipeRes.data);
  };
  loadData();
}, []);
```

### CafeDashboard (Lobby) 변환

**Mock → IPC**:
```typescript
// Before (Mock)
const handleCreateCafe = (path: string) => {
  setCafes([...cafes, { id: generateId(), ... }]);
};

// After (IPC)
const handleCreateCafe = async (path: string) => {
  const res = await window.codecafe.cafe.create({ path });
  if (res.success && res.data) {
    setCafes([...cafes, res.data]);
  }
};
```

### OrderInterface 변환 (가장 복잡)

**Mock → IPC**:
```typescript
// Order 생성
const handleCreateOrder = async (...) => {
  const res = await window.codecafe.order.createWithWorktree({
    cafeId, workflowId, workflowName, createWorktree
  });
  if (res.success) {
    // 반환된 order로 상태 업데이트
  }
};

// Order 실행
const handleExecuteOrder = async (orderId, prompt) => {
  await window.codecafe.order.execute(orderId, prompt, {});
};

// 실시간 로그
useEffect(() => {
  const cleanup = window.codecafe.order.onOutput((data) => {
    // logs 업데이트
  });
  return cleanup;
}, []);

// 사용자 입력
const handleSendInput = async (orderId, input) => {
  await window.codecafe.order.sendInput(orderId, input);
};
```

### RecipeManager 변환

```typescript
// CRUD 연결
const handleAddRecipe = async (recipe) => {
  await window.codecafe.workflow.create(recipe);
};
const handleUpdateRecipe = async (recipe) => {
  await window.codecafe.workflow.update(recipe);
};
const handleDeleteRecipe = async (id) => {
  await window.codecafe.workflow.delete(id);
};
```

### SkillManager 변환

```typescript
// CRUD 연결
const handleAddSkill = async (skill) => {
  await window.codecafe.skill.create(skill);
};
const handleUpdateSkill = async (skill) => {
  await window.codecafe.skill.update(skill);
};
const handleDeleteSkill = async (id) => {
  await window.codecafe.skill.delete(id);
};
```

---

## Phase 3: IPC API 매핑 표

| 새 디자인 함수 | IPC API |
|---------------|---------|
| `handleCreateCafe(path)` | `window.codecafe.cafe.create({ path })` |
| `handleCreateOrder(...)` | `window.codecafe.order.createWithWorktree(...)` |
| `handleDeleteOrder(id)` | `window.codecafe.order.delete(id)` |
| `handleSendInput(id, msg)` | `window.codecafe.order.sendInput(id, msg)` |
| `handleAddRecipe(recipe)` | `window.codecafe.workflow.create(recipe)` |
| `handleUpdateRecipe(recipe)` | `window.codecafe.workflow.update(recipe)` |
| `handleDeleteRecipe(id)` | `window.codecafe.workflow.delete(id)` |
| `handleAddSkill(skill)` | `window.codecafe.skill.create(skill)` |
| `handleUpdateSkill(skill)` | `window.codecafe.skill.update(skill)` |
| `handleDeleteSkill(id)` | `window.codecafe.skill.delete(id)` |

---

## Phase 4: 삭제할 기존 컴포넌트

새 디자인으로 교체 후 삭제:
```
components/
├── layout/
│   └── Sidebar.tsx (교체)
├── views/
│   ├── GlobalLobby.tsx (교체)
│   ├── CafeDashboard.tsx (교체)
│   ├── Dashboard.tsx (삭제)
│   ├── Workflows.tsx (교체)
│   └── Skills.tsx (교체)
├── order/
│   ├── OrderCard.tsx (통합)
│   ├── OrderModal.tsx (통합)
│   └── ... (통합)
└── orders/
    └── ... (통합)
```

---

## 체크리스트

### Phase 1: 복사
- [ ] 새 컴포넌트 5개 복사
- [ ] types.ts 복사
- [ ] tailwind.config.cjs 업데이트
- [ ] index.html 폰트 추가

### Phase 2: IPC 연결
- [ ] App.tsx: cafes, recipes, skills 로딩
- [ ] Sidebar: 네비게이션 연결
- [ ] CafeDashboard: cafe CRUD 연결
- [ ] OrderInterface: order 실행/로그 연결
- [ ] RecipeManager: recipe CRUD 연결
- [ ] SkillManager: skill CRUD 연결

### Phase 3: 정리
- [ ] 미사용 컴포넌트 삭제
- [ ] import 정리
- [ ] 타입체크 통과
- [ ] 빌드 성공
- [ ] 앱 테스트

---

## 다음 단계

이 계획으로 진행할까요?
