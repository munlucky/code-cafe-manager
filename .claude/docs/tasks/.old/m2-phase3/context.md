# M2 Phase 3: UI 구현 - 구현 계획

> 프로젝트 규칙: `.claude/PROJECT.md`

## 메타데이터

- 작업자: Context Builder Agent
- 작성일: 2026-01-09
- 브랜치: main
- 복잡도: complex
- 관련 문서: `.claude/docs/agreements/m2-features-agreement.md`

## 작업 개요

- **목적**: M2 Phase 3 Desktop UI 기능 구현 (Provider 선택, Worktree 관리, Recipe Studio)
- **범위**:
  - **포함**: Provider 선택 UI, Worktree 목록 화면, Recipe Studio (폼 기반 편집), YAML 프리뷰 + 검증 UI
  - **제외**: DAG 시각화 (Should 항목, M3으로 연기), API 모드, 레시피 템플릿 갤러리
- **영향**: Desktop 패키지 전면 개편 (Vanilla JS → React + TypeScript), IPC 핸들러 확장

## 현재 상태 분석

### Phase 1 완료 내용 (기반 확장)
- ✅ `packages/providers/common/` - Provider 인터페이스 표준화 (`IProvider`)
- ✅ `packages/providers/codex/` - Codex Provider 구현
- ✅ `packages/git-worktree/` - Git Worktree 관리 패키지
- ✅ `packages/schema/` - Recipe 스키마 확장 (parallel, retry, timeout)

### Phase 2 완료 내용 (실행 엔진)
- ✅ `packages/core/src/executor/` - DAG 기반 실행 엔진
- ✅ `packages/core/src/executor/parallel-executor.ts` - Parallel step 실행
- ✅ `packages/core/src/executor/step-executor.ts` - Retry/Timeout 구현
- ✅ `packages/core/src/executor/dag-resolver.ts` - DAG 의존성 해석

### 현재 Desktop 상태
- **기술 스택**: Electron + Vanilla JS + HTML
- **화면**: Dashboard, New Order, Orders, Baristas (4개 뷰)
- **한계점**:
  - Vanilla JS로 복잡한 폼 구현 어려움
  - 상태 관리 없어 Recipe Studio 구현 불가
  - YAML 프리뷰/검증 UI 구현 어려움

### 결정: Desktop 패키지 React 마이그레이션

**이유**:
1. Recipe Studio는 복잡한 폼/상태 관리 필요 (Steps 추가/삭제, 의존성 설정)
2. YAML 실시간 프리뷰는 상태 동기화 필요
3. Worktree 목록은 테이블/필터링 기능 필요

**마이그레이션 범위**:
- Electron + React + TypeScript
- Webpack (Electron Forge plugin 활용)
- 상태 관리: React Context (Redux는 과도함)
- UI 라이브러리: 없음 (커스텀 컴포넌트, 합의서의 커피 테마 유지)

## 변경 대상 파일

### 신규 파일 (Desktop React 마이그레이션)

#### 설정
- `packages/desktop/webpack.config.js` - Webpack 설정 (renderer, main, preload)
- `packages/desktop/tsconfig.renderer.json` - Renderer TypeScript 설정

#### React 앱 구조
- `packages/desktop/src/renderer/index.tsx` - React 엔트리 포인트
- `packages/desktop/src/renderer/App.tsx` - 루트 컴포넌트 (레이아웃)
- `packages/desktop/src/renderer/index.html` - HTML 템플릿 (기존 수정)

#### Context (상태 관리)
- `packages/desktop/src/renderer/contexts/AppContext.tsx` - 전역 상태 (baristas, orders)
- `packages/desktop/src/renderer/contexts/RecipeStudioContext.tsx` - Recipe 편집 상태

#### Components (공통)
- `packages/desktop/src/renderer/components/Layout.tsx` - 사이드바 + 헤더
- `packages/desktop/src/renderer/components/Sidebar.tsx` - 네비게이션
- `packages/desktop/src/renderer/components/StatusBadge.tsx` - 상태 뱃지 (idle/running/completed)
- `packages/desktop/src/renderer/components/Button.tsx` - 버튼 컴포넌트

#### Views (기존 4개 + 신규 2개)
- `packages/desktop/src/renderer/views/Dashboard.tsx` - 대시보드 (기존 Vanilla JS 이식)
- `packages/desktop/src/renderer/views/NewOrder.tsx` - 새 주문 (Provider 선택 추가)
- `packages/desktop/src/renderer/views/Orders.tsx` - 주문 목록
- `packages/desktop/src/renderer/views/Baristas.tsx` - 바리스타 목록
- `packages/desktop/src/renderer/views/WorktreeList.tsx` - **[신규]** Worktree 목록
- `packages/desktop/src/renderer/views/RecipeStudio.tsx` - **[신규]** Recipe Studio

#### Recipe Studio 하위 컴포넌트
- `packages/desktop/src/renderer/components/RecipeStudio/RecipeList.tsx` - 레시피 목록 (사이드바)
- `packages/desktop/src/renderer/components/RecipeStudio/RecipeEditor.tsx` - 폼 편집기 (탭 전환)
- `packages/desktop/src/renderer/components/RecipeStudio/FormTab.tsx` - 폼 탭
- `packages/desktop/src/renderer/components/RecipeStudio/YamlPreviewTab.tsx` - YAML 프리뷰 탭
- `packages/desktop/src/renderer/components/RecipeStudio/BasicInfoForm.tsx` - 기본 정보 폼
- `packages/desktop/src/renderer/components/RecipeStudio/VariablesForm.tsx` - Variables 폼
- `packages/desktop/src/renderer/components/RecipeStudio/StepsForm.tsx` - Steps 폼 (핵심)
- `packages/desktop/src/renderer/components/RecipeStudio/StepItem.tsx` - Step 개별 아이템
- `packages/desktop/src/renderer/components/RecipeStudio/ValidationErrors.tsx` - 검증 에러 표시

#### Worktree 컴포넌트
- `packages/desktop/src/renderer/components/WorktreeList/WorktreeTable.tsx` - Worktree 테이블
- `packages/desktop/src/renderer/components/WorktreeList/WorktreeRow.tsx` - Worktree 행
- `packages/desktop/src/renderer/components/WorktreeList/PatchExportModal.tsx` - 패치 내보내기 모달

#### Types
- `packages/desktop/src/renderer/types/index.ts` - Renderer 타입 정의
- `packages/desktop/src/renderer/hooks/useIpc.ts` - IPC 호출 훅

### 수정 파일

#### Desktop Main
- `packages/desktop/src/main/index.ts` - IPC 핸들러 추가 (Worktree, Recipe Studio)
- `packages/desktop/package.json` - React 의존성 추가, Webpack 플러그인 설정

#### IPC 핸들러 (신규)
- `packages/desktop/src/main/ipc/worktree-handlers.ts` - Worktree IPC 핸들러
  - `listWorktrees`
  - `exportPatch`
  - `removeWorktree`
  - `openWorktreeFolder`
- `packages/desktop/src/main/ipc/recipe-handlers.ts` - Recipe Studio IPC 핸들러
  - `listRecipes`
  - `getRecipe`
  - `saveRecipe`
  - `validateRecipe`

#### 기존 파일 (Provider 선택 반영)
- `packages/desktop/src/renderer/views/NewOrder.tsx` - Provider 드롭다운 추가 (claude-code, codex)

## 구현 계획

### Phase 3.1: Desktop React 마이그레이션 기반 구축 (2-3일)

#### 1. Webpack + React 설정

**파일**:
- `packages/desktop/package.json`
- `packages/desktop/webpack.config.js`
- `packages/desktop/tsconfig.renderer.json`

**작업**:
1. 의존성 추가:
   ```json
   {
     "dependencies": {
       "react": "^18.2.0",
       "react-dom": "^18.2.0",
       "yaml": "^2.3.4"
     },
     "devDependencies": {
       "@types/react": "^18.2.0",
       "@types/react-dom": "^18.2.0",
       "css-loader": "^6.8.1",
       "style-loader": "^3.3.3",
       "ts-loader": "^9.5.1",
       "webpack": "^5.89.0"
     }
   }
   ```
2. Webpack 설정 작성 (Electron Forge plugin 활용)
3. TypeScript 설정 (renderer용 tsconfig 추가)

#### 2. 기본 레이아웃 + Context 구성

**파일**:
- `packages/desktop/src/renderer/index.tsx`
- `packages/desktop/src/renderer/App.tsx`
- `packages/desktop/src/renderer/components/Layout.tsx`
- `packages/desktop/src/renderer/components/Sidebar.tsx`
- `packages/desktop/src/renderer/contexts/AppContext.tsx`
- `packages/desktop/src/renderer/hooks/useIpc.ts`

**작업**:
1. React 엔트리 포인트 작성 (`ReactDOM.render`)
2. 레이아웃 구조 구현 (Sidebar + Main)
3. AppContext 작성 (baristas, orders 전역 상태)
4. IPC 호출 훅 작성 (`useIpc`)

#### 3. 기존 4개 뷰 이식 (Vanilla JS → React)

**파일**:
- `packages/desktop/src/renderer/views/Dashboard.tsx`
- `packages/desktop/src/renderer/views/NewOrder.tsx`
- `packages/desktop/src/renderer/views/Orders.tsx`
- `packages/desktop/src/renderer/views/Baristas.tsx`
- `packages/desktop/src/renderer/components/StatusBadge.tsx`
- `packages/desktop/src/renderer/components/Button.tsx`

**작업**:
1. 기존 `index.html`의 UI 로직을 React 컴포넌트로 이식
2. IPC 호출을 `useIpc` 훅으로 교체
3. 상태 관리는 AppContext 활용
4. 스타일은 기존 CSS 유지 (커피 테마: `#8b7355`)

**검증**:
- `npm run dev` 실행 시 기존 4개 뷰가 React로 동작하는지 확인
- Barista/Order 생성/조회 기능 동작 확인

---

### Phase 3.2: Provider 선택 UI (1일)

#### 1. NewOrder 뷰에 Provider 드롭다운 추가

**파일**:
- `packages/desktop/src/renderer/views/NewOrder.tsx`

**작업**:
1. Provider 선택 드롭다운 추가 (`claude-code`, `codex`)
2. 기본값: `claude-code`
3. IPC `createOrder` 호출 시 선택한 provider 전달

**UI**:
```tsx
<select name="provider" value={provider} onChange={handleProviderChange}>
  <option value="claude-code">Claude Code</option>
  <option value="codex">Codex</option>
</select>
```

**검증**:
- Provider 선택 후 주문 생성 시 올바른 provider로 실행되는지 확인
- Orchestrator 로그에서 provider 확인

---

### Phase 3.3: Worktree 목록 화면 (2일)

#### 1. IPC 핸들러 구현

**파일**:
- `packages/desktop/src/main/ipc/worktree-handlers.ts`
- `packages/desktop/src/main/index.ts` (IPC 등록)

**작업**:
1. IPC 핸들러 구현:
   - `listWorktrees(repoPath: string)` → `WorktreeManager.listWorktrees()`
   - `exportPatch(worktreePath, baseBranch, outputPath)`
   - `removeWorktree(worktreePath, force)`
   - `openWorktreeFolder(worktreePath)` → `shell.openPath()`
2. Main process에서 핸들러 등록

**주의**:
- `repoPath`는 사용자가 입력하거나, Order의 counter 경로에서 추출
- Worktree 삭제 시 미커밋 변경사항 경고 (force=false 기본값)

#### 2. Worktree 목록 UI

**파일**:
- `packages/desktop/src/renderer/views/WorktreeList.tsx`
- `packages/desktop/src/renderer/components/WorktreeList/WorktreeTable.tsx`
- `packages/desktop/src/renderer/components/WorktreeList/WorktreeRow.tsx`
- `packages/desktop/src/renderer/components/WorktreeList/PatchExportModal.tsx`

**작업**:
1. Worktree 목록 표시 (테이블):
   - 컬럼: Branch, Path, Commit, Order ID (연결된 주문), Actions
2. Actions:
   - "패치 내보내기" 버튼 → 모달 열기 → IPC `exportPatch` → 성공 알림
   - "폴더 열기" 버튼 → IPC `openWorktreeFolder`
   - "삭제" 버튼 → 확인 다이얼로그 → IPC `removeWorktree`
3. 필터: Order ID로 필터링

**UI 구조**:
```
WorktreeList
├── 상단: Repo Path 입력 + "조회" 버튼
├── WorktreeTable
│   └── WorktreeRow (각 Worktree)
│       ├── Branch, Path, Commit
│       ├── Order ID (badge)
│       └── Actions (패치 내보내기, 폴더 열기, 삭제)
└── PatchExportModal (패치 내보내기 시)
```

**검증**:
- Worktree 생성 후 목록에 표시되는지 확인
- 패치 내보내기 시 `.patch` 파일 생성 확인
- Worktree 삭제 시 미커밋 변경사항 경고 확인

---

### Phase 3.4: Recipe Studio (폼 기반 편집) (3-4일)

#### 1. IPC 핸들러 구현

**파일**:
- `packages/desktop/src/main/ipc/recipe-handlers.ts`
- `packages/desktop/src/main/index.ts` (IPC 등록)

**작업**:
1. Recipe 저장소 경로: `~/.codecafe/recipes/`
2. IPC 핸들러:
   - `listRecipes()` → 저장소 내 `.yaml` 파일 목록 반환
   - `getRecipe(recipeName: string)` → YAML 파일 읽기 → JSON 반환
   - `saveRecipe(recipeName: string, recipeData: RecipeInput)` → YAML 저장
   - `validateRecipe(recipeData: RecipeInput)` → `safeValidateRecipe()` 호출
3. 기본 레시피 복사:
   - 첫 실행 시 `recipes/house-blend/pm-agent.yaml` → `~/.codecafe/recipes/` 복사

#### 2. Recipe Studio Context

**파일**:
- `packages/desktop/src/renderer/contexts/RecipeStudioContext.tsx`

**작업**:
1. 상태 관리:
   ```tsx
   {
     currentRecipe: RecipeInput | null,
     isDirty: boolean,
     validationErrors: ZodIssue[] | null,
     activeTab: 'form' | 'yaml',
   }
   ```
2. 액션:
   - `loadRecipe(recipeName: string)` → IPC `getRecipe` → 상태 업데이트
   - `updateRecipe(field, value)` → 상태 업데이트 + `isDirty=true`
   - `saveRecipe()` → IPC `saveRecipe` → `isDirty=false`
   - `validateRecipe()` → IPC `validateRecipe` → 에러 표시
   - `setActiveTab(tab)`

#### 3. Recipe Studio 메인 화면

**파일**:
- `packages/desktop/src/renderer/views/RecipeStudio.tsx`
- `packages/desktop/src/renderer/components/RecipeStudio/RecipeList.tsx`
- `packages/desktop/src/renderer/components/RecipeStudio/RecipeEditor.tsx`

**작업**:
1. 레이아웃:
   ```
   RecipeStudio
   ├── RecipeList (왼쪽 사이드바, 200px)
   │   ├── 레시피 목록 (pm-agent, custom-1, ...)
   │   └── + 새 레시피 버튼
   └── RecipeEditor (메인)
       ├── 탭 전환 (Form | YAML Preview)
       ├── FormTab (현재 레시피 편집)
       └── YamlPreviewTab (읽기 전용, 복사 버튼)
   ```

2. RecipeList:
   - IPC `listRecipes` 호출
   - 레시피 클릭 시 Context `loadRecipe` 호출
   - 새 레시피 버튼 → 템플릿 생성 → 에디터 열기

3. RecipeEditor:
   - 탭 전환 UI (`activeTab` 기반)
   - 저장 버튼 (상단) → Context `saveRecipe` 호출
   - 변경 감지 표시 (`isDirty` 시 "*" 표시)

#### 4. Form Tab 구현

**파일**:
- `packages/desktop/src/renderer/components/RecipeStudio/FormTab.tsx`
- `packages/desktop/src/renderer/components/RecipeStudio/BasicInfoForm.tsx`
- `packages/desktop/src/renderer/components/RecipeStudio/VariablesForm.tsx`
- `packages/desktop/src/renderer/components/RecipeStudio/StepsForm.tsx`
- `packages/desktop/src/renderer/components/RecipeStudio/StepItem.tsx`
- `packages/desktop/src/renderer/components/RecipeStudio/ValidationErrors.tsx`

**작업**:

##### 4.1 BasicInfoForm
- 필드:
  - `name` (text)
  - `version` (text, semver 검증)
  - `defaults.provider` (select: claude-code, codex)
  - `defaults.workspace.mode` (select: in-place, worktree, temp)
  - `defaults.workspace.baseBranch` (text, worktree 모드 시만 표시)
  - `defaults.workspace.clean` (checkbox, worktree 모드 시만 표시)
  - `inputs.counter` (text, 기본값: `.`)

##### 4.2 VariablesForm
- 키-값 쌍 추가/삭제
- UI: 테이블 형태 (Key | Value | 삭제 버튼)
- "변수 추가" 버튼

##### 4.3 StepsForm (핵심 컴포넌트)
- Steps 목록 표시 (드래그 앤 드롭은 M3로 연기, 순서는 위/아래 버튼)
- 각 Step은 `StepItem` 컴포넌트로 렌더링
- "Step 추가" 버튼 → 새 Step 추가 (기본값: `ai.interactive`)

##### 4.4 StepItem
- 필드:
  - `id` (text, 필수, 중복 검증)
  - `type` (select: ai.interactive, ai.prompt, shell, parallel)
  - `provider` (select, optional: 기본값 사용 시 빈칸)
  - `depends_on` (multi-select, 다른 step ID 목록)
  - `timeout_sec` (number, optional)
  - `retry` (number, optional)
  - Type별 조건부 필드:
    - `ai.interactive`, `ai.prompt` → `agent_ref` (선택), `prompt` (text)
    - `shell` → `command` (text)
    - `parallel` → `steps` (중첩 StepItem 목록, **네스팅 금지 검증**)
- Step 삭제 버튼
- 접기/펼치기 (복잡도 낮추기)

##### 4.5 ValidationErrors
- Zod 검증 에러를 사용자 친화적으로 표시
- 에러 위치 하이라이트 (field path 기반)

**검증 로직**:
- 실시간 검증 (debounce 500ms)
- 필수 필드 누락 → 빨간색 테두리
- Step ID 중복 → 에러 표시
- `depends_on` 순환 참조 → 에러 표시 (DAG 검증)

#### 5. YAML Preview Tab

**파일**:
- `packages/desktop/src/renderer/components/RecipeStudio/YamlPreviewTab.tsx`

**작업**:
1. 현재 Recipe 상태를 YAML로 변환 (`yaml.stringify`)
2. Syntax highlighting (간단한 CSS만, 라이브러리 없음)
3. 복사 버튼 (클립보드 복사)
4. 읽기 전용 (편집 불가)

**UI**:
```tsx
<YamlPreviewTab>
  <div className="yaml-container">
    <pre><code>{yamlContent}</code></pre>
  </div>
  <Button onClick={copyToClipboard}>복사</Button>
</YamlPreviewTab>
```

#### 6. 저장 및 불러오기

**작업**:
1. 저장:
   - Context `saveRecipe()` → IPC `saveRecipe` → `~/.codecafe/recipes/{name}.yaml` 저장
   - 성공 시 `isDirty=false` + 알림
2. 불러오기:
   - RecipeList에서 레시피 클릭 → Context `loadRecipe()` → IPC `getRecipe` → 상태 업데이트
3. 새 레시피:
   - "새 레시피" 버튼 → 템플릿 생성:
     ```yaml
     name: new-recipe
     version: 0.1.0
     defaults:
       provider: claude-code
       workspace:
         mode: in-place
     inputs:
       counter: .
     vars: {}
     steps:
       - id: step-1
         type: ai.interactive
         prompt: "Your prompt here"
     ```

**검증**:
- Recipe 저장 → CLI에서 `codecafe brew` 실행 → 정상 동작 확인
- Recipe 불러오기 → 폼에 정확히 표시되는지 확인
- YAML 프리뷰 → 유효한 YAML 형식인지 확인

---

### Phase 3.5: 통합 테스트 및 UI 정제 (1-2일)

#### 1. E2E 시나리오 테스트

**시나리오 1: Provider 선택 + 주문 실행**
1. NewOrder에서 Provider `codex` 선택
2. 레시피: `pm-agent`, Counter: `.`, Vars: `{task: "테스트"}`
3. 주문 생성 → Codex Provider로 실행 → 로그 스트리밍 확인

**시나리오 2: Worktree 병렬 실행 + 패치 내보내기**
1. Recipe Studio에서 worktree 모드 레시피 생성
2. 3개 주문 병렬 실행 (각각 다른 브랜치)
3. WorktreeList에서 목록 확인
4. 패치 내보내기 → `.patch` 파일 확인
5. Worktree 삭제 (미커밋 변경사항 경고 확인)

**시나리오 3: Recipe Studio 폼 편집 + 검증**
1. 새 레시피 생성
2. Steps 추가 (ai.interactive, shell, parallel)
3. 의존성 설정 (`depends_on`)
4. 실시간 검증 확인 (필수 필드 누락, Step ID 중복, 순환 참조)
5. YAML 프리뷰 → 복사 → CLI 실행

#### 2. UI 정제

**작업**:
- 커피 테마 일관성 유지 (`#8b7355`, `#252525`, `#1a1a1a`)
- 로딩 상태 표시 (IPC 호출 중)
- 에러 토스트 (IPC 실패 시)
- 접근성 (키보드 네비게이션, 포커스 관리)

#### 3. 문서 업데이트

**파일**:
- `docs/m2-ui-guide.md` (신규) - Desktop UI 사용 가이드
- `README.md` (업데이트) - M2 기능 설명

---

## 위험 및 대안

### 위험 1: React 마이그레이션 복잡도

**리스크**: Vanilla JS → React 전환 시 Webpack 설정 문제, IPC 통신 오류
**대응**:
- Electron Forge의 Webpack plugin 활용 (공식 템플릿)
- 기존 IPC 핸들러 재사용 (변경 최소화)
- 점진적 마이그레이션 (기본 레이아웃 먼저, 복잡한 뷰는 나중에)

### 위험 2: Recipe Studio 폼 복잡도

**리스크**: Steps 폼이 너무 복잡해 사용성 저하
**대응**:
- Step 접기/펼치기로 복잡도 낮춤
- Parallel step은 1단계 네스팅만 허용 (M2 제약)
- 복잡한 레시피는 YAML 직접 편집 권장 (M3에서 고급 UI 추가)

### 위험 3: Worktree 경로 이슈 (Windows)

**리스크**: Windows 경로 처리 (`\` vs `/`), 긴 경로명 문제
**대응**:
- `path.resolve()` 사용 (크로스플랫폼)
- Git 명령어는 porcelain 모드 사용
- 경로 길이 제한 경고 (Windows MAX_PATH 260자)

### 위험 4: YAML 변환 정확도

**리스크**: 폼 → YAML 변환 시 포맷 손실 (주석, 순서)
**대응**:
- M2는 주석 미지원 (YAML 직접 편집 시에만)
- 순서는 `steps` 배열 순서로 보장
- M3에서 YAML 왕복 변환 개선

---

## 의존성

### 기술 의존성
- **React 18**: 필수 (Recipe Studio 복잡도 때문에)
- **Webpack**: Electron Forge plugin 사용
- **Zod**: 이미 Phase 1에서 도입 (스키마 검증)
- **YAML 라이브러리**: `yaml` 패키지 (YAML ↔ JSON 변환)

### Phase 의존성
- ✅ Phase 1 완료 (Provider, Worktree, Schema)
- ✅ Phase 2 완료 (Executor)
- Phase 3는 독립적 (UI만 구현)

### 외부 의존성
- Git CLI (Worktree 명령)
- Claude Code CLI / Codex CLI (Provider 실행)

---

## 체크포인트

### Phase 3.1: React 마이그레이션 기반
- [ ] Webpack + React 설정 완료
- [ ] 기본 레이아웃 + Context 구성 완료
- [ ] 기존 4개 뷰 이식 완료 (Dashboard, NewOrder, Orders, Baristas)
- [ ] `npm run dev` 실행 → 기존 기능 정상 동작 확인

### Phase 3.2: Provider 선택 UI
- [ ] NewOrder에 Provider 드롭다운 추가
- [ ] Provider 선택 후 주문 생성 → 올바른 Provider 실행 확인

### Phase 3.3: Worktree 목록 화면
- [ ] IPC 핸들러 구현 (listWorktrees, exportPatch, removeWorktree, openWorktreeFolder)
- [ ] Worktree 목록 UI 구현 (테이블, Actions)
- [ ] Worktree 생성 → 목록 표시 → 패치 내보내기 → 삭제 시나리오 테스트

### Phase 3.4: Recipe Studio
- [ ] IPC 핸들러 구현 (listRecipes, getRecipe, saveRecipe, validateRecipe)
- [ ] Recipe Studio Context 구현
- [ ] Recipe Studio 메인 화면 (RecipeList + RecipeEditor)
- [ ] Form Tab 구현 (BasicInfoForm, VariablesForm, StepsForm)
- [ ] YAML Preview Tab 구현
- [ ] 저장/불러오기 기능 구현
- [ ] 실시간 검증 (Zod) 동작 확인
- [ ] Recipe 저장 → CLI 실행 → 정상 동작 확인

### Phase 3.5: 통합 테스트
- [ ] E2E 시나리오 1 통과 (Provider 선택)
- [ ] E2E 시나리오 2 통과 (Worktree 병렬 실행)
- [ ] E2E 시나리오 3 통과 (Recipe Studio)
- [ ] UI 정제 (로딩 상태, 에러 처리, 접근성)
- [ ] 문서 업데이트 (UI 가이드)

---

## 남은 질문

### HIGH
- ❓ **React UI 라이브러리 선택**: 커스텀 컴포넌트만으로 충분한지? (MUI, Ant Design 등 도입 여부)
  - **제안**: M2는 커스텀 컴포넌트만 사용 (합의서의 커피 테마 유지), M3에서 필요 시 도입

### MEDIUM
- ❓ **Worktree 자동 정리 정책**: UI에서 "오래된 Worktree 일괄 삭제" 기능 필요 여부
  - **제안**: M2는 수동 삭제만, M3에서 자동 정리 정책 추가
- ❓ **Recipe Studio 템플릿**: 기본 제공 템플릿 몇 개 추가할지?
  - **제안**: M2는 pm-agent만, M3에서 템플릿 갤러리 추가

### LOW
- ❓ **YAML Syntax Highlighting**: 전용 라이브러리 도입 vs 간단한 CSS
  - **제안**: M2는 간단한 CSS만, M3에서 `highlight.js` 도입 검토

---

## 검증 계획

### 타입 체크
```bash
cd packages/desktop
npx tsc --noEmit
```

### 빌드
```bash
cd packages/desktop
npm run build
```

### 로컬 실행
```bash
cd packages/desktop
npm run dev
```

### 시나리오 테스트
1. Provider 선택 (codex) + 주문 실행
2. Worktree 생성 → 목록 → 패치 내보내기 → 삭제
3. Recipe Studio 폼 편집 → YAML 프리뷰 → 저장 → CLI 실행

---

## 마일스톤

- **Phase 3.1 완료**: +3일 (2026-01-12)
- **Phase 3.2 완료**: +1일 (2026-01-13)
- **Phase 3.3 완료**: +2일 (2026-01-15)
- **Phase 3.4 완료**: +4일 (2026-01-19)
- **Phase 3.5 완료**: +2일 (2026-01-21)

**총 예상 기간**: 12일 (약 2.5주)

---

## 부록: React 컴포넌트 구조 다이어그램

```
App.tsx
└── Layout
    ├── Sidebar (네비게이션)
    └── Main
        ├── Header
        └── Content (뷰 전환)
            ├── Dashboard (기존)
            ├── NewOrder (Provider 선택 추가)
            ├── Orders (기존)
            ├── Baristas (기존)
            ├── WorktreeList (신규)
            │   ├── WorktreeTable
            │   │   └── WorktreeRow
            │   └── PatchExportModal
            └── RecipeStudio (신규)
                ├── RecipeList (사이드바)
                └── RecipeEditor
                    ├── FormTab
                    │   ├── BasicInfoForm
                    │   ├── VariablesForm
                    │   ├── StepsForm
                    │   │   └── StepItem (재귀, parallel step)
                    │   └── ValidationErrors
                    └── YamlPreviewTab
```

---

## 참고 자료

- **사전 합의서**: `.claude/docs/agreements/m2-features-agreement.md`
- **Provider 인터페이스**: `packages/providers/common/src/provider-interface.ts`
- **Worktree Manager**: `packages/git-worktree/src/worktree-manager.ts`
- **Executor**: `packages/core/src/executor/index.ts`
- **Recipe Schema**: `packages/schema/src/recipe-schema.ts`
- **Electron Forge Webpack Plugin**: https://www.electronforge.io/config/plugins/webpack
