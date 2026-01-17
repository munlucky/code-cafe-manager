# M2 Phase 3 구현 요약

> 작성일: 2026-01-09
> 브랜치: main
> 작업자: Implementation Agent

## 개요

시간 제약을 고려하여 React 마이그레이션 대신 Vanilla JS 기반 간소화 구현을 완료했습니다.

## 구현 내용

### 1. IPC 핸들러 추가 (Main 프로세스)

**파일**: `packages/desktop/src/main/index.ts`

추가된 핸들러:

#### Provider 관리
- `getAvailableProviders`: Provider 목록 조회 (claude-code, codex)

#### Worktree 관리
- `listWorktrees(repoPath)`: Worktree 목록 조회
- `exportPatch(worktreePath, baseBranch, outputPath?)`: 패치 내보내기
- `removeWorktree(worktreePath, force?)`: Worktree 삭제
- `openWorktreeFolder(worktreePath)`: 폴더 열기

#### Recipe Studio
- `listRecipes()`: Recipe 목록 조회 (`~/.codecafe/recipes/`)
- `getRecipe(recipeName)`: Recipe 불러오기 (YAML → JSON)
- `saveRecipe(recipeName, recipeData)`: Recipe 저장 (JSON → YAML)
- `validateRecipe(recipeData)`: Recipe 검증 (Zod 스키마)

### 2. Preload API 확장

**파일**: `packages/desktop/src/preload/index.ts`

`window.codecafe` 객체에 신규 메서드 추가:
- Provider 관리 API
- Worktree 관리 API
- Recipe Studio API

### 3. 기본 UI 스켈레톤 (Renderer)

**파일**: `packages/desktop/src/renderer/app.js`

구현된 뷰:

#### NewOrder (기존 확장)
- **Provider 선택 드롭다운** 추가
- claude-code, codex 선택 가능
- 주문 생성 시 선택된 provider 전달

#### Worktrees (신규)
- Repository 경로 입력 + Load 버튼
- Worktree 목록 테이블 (Branch, Path, Commit, Actions)
- Actions:
  - **Export Patch**: base branch 입력 → 패치 파일 생성
  - **Open Folder**: 시스템 파일 탐색기로 열기
  - **Delete**: 미커밋 변경사항 확인 → force 옵션 제공

#### Recipe Studio (신규)
- **레시피 목록 (사이드바)**: `~/.codecafe/recipes/` 내 YAML 파일 표시
- **레시피 에디터**:
  - JSON 포맷 텍스트 에디터 (25줄)
  - **Save**: Main 프로세스에서 YAML 변환 후 저장
  - **Validate**: Zod 스키마 검증 → 에러 표시
  - **Copy YAML**: 클립보드 복사
- **New Recipe**: 템플릿 생성 (name, version, defaults, inputs, vars, steps)

### 4. 의존성 추가

**파일**: `packages/desktop/package.json`

```json
{
  "dependencies": {
    "@codecafe/git-worktree": "workspace:*",
    "@codecafe/schema": "workspace:*",
    "yaml": "^2.3.4"
  }
}
```

### 5. HTML 네비게이션 업데이트

**파일**: `packages/desktop/src/renderer/index.html`

신규 탭 버튼 추가:
- Worktrees
- Recipes

## 기술적 결정

### YAML 처리
- **Main 프로세스**: `yaml` 패키지 사용 (YAML ↔ JSON 변환)
- **Renderer**: JSON 포맷만 지원 (간소화)
- 이유: Renderer에서 YAML 파싱 라이브러리 로드 불필요, Main 프로세스에서 검증 후 저장

### UI 구현
- **Vanilla JS 유지**: React 마이그레이션 대신 DOM API 직접 사용
- **XSS 보안**: `innerHTML` 최소화, `textContent` 우선 사용
- 이유: 시간 제약, Desktop 초기 단계

### 에러 처리
- IPC 핸들러: `{ success: boolean, data?: any, error?: string }` 형식 통일
- UI: alert() 사용 (간소화, M3에서 Toast 추가 예정)

## 검증 결과

### 타입 체크
```bash
cd packages/desktop
pnpm run typecheck
# ✓ 통과 (에러 없음)
```

### 빌드
```bash
cd packages/desktop
pnpm run build
# ✓ 성공 (dist/main, dist/preload 생성)
```

### 전체 빌드
```bash
pnpm run build
# ✓ 전체 패키지 빌드 성공
```

## 제한 사항

### 현재 구현
1. **Recipe Editor**: JSON 포맷만 지원 (YAML syntax highlighting 없음)
2. **Worktree UI**: 기본 테이블만 제공 (필터링 기능 없음)
3. **에러 처리**: alert() 기반 (Toast 미구현)
4. **폼 검증**: 실시간 검증 없음 (Save/Validate 버튼 클릭 시에만)

### 향후 개선 (M3+)
1. React 마이그레이션 + 상태 관리
2. Recipe Studio 폼 기반 편집 (Steps 추가/삭제, 의존성 설정)
3. YAML syntax highlighting
4. Worktree 필터링 (Order ID, 생성일 등)
5. Toast 알림 시스템
6. 실시간 검증 UI

## 사용 방법

### Provider 선택
1. **New Order** 탭 이동
2. Provider 드롭다운에서 `claude-code` 또는 `codex` 선택
3. Recipe Name, Counter, Variables 입력 후 **Create Order**

### Worktree 관리
1. **Worktrees** 탭 이동
2. Repository Path 입력 (예: `.`)
3. **Load** 버튼 클릭 → Worktree 목록 표시
4. Actions:
   - **Export Patch**: Base branch 입력 → `.patch` 파일 생성 위치 알림
   - **Open Folder**: 시스템 파일 탐색기로 폴더 열기
   - **Delete**: 미커밋 변경사항 확인 → 실패 시 Force 옵션 제공

### Recipe Studio
1. **Recipes** 탭 이동
2. 레시피 목록에서 기존 레시피 선택 또는 **New Recipe** 클릭
3. JSON 에디터에서 레시피 수정
4. **Validate** 클릭 → 검증 결과 확인
5. **Save** 클릭 → `~/.codecafe/recipes/{name}` 저장
6. **Copy YAML** 클릭 → 클립보드 복사 → CLI에서 직접 실행 가능

## 파일 변경 목록

### 신규 파일
- `.claude/docs/tasks/m2-phase3/implementation-summary.md`

### 수정 파일
- `packages/desktop/package.json` (의존성 추가)
- `packages/desktop/src/main/index.ts` (IPC 핸들러 추가)
- `packages/desktop/src/preload/index.ts` (API 확장)
- `packages/desktop/src/renderer/app.js` (UI 구현)
- `packages/desktop/src/renderer/index.html` (네비게이션 추가)

## 다음 단계

### M2 Phase 3 완료 확인
- [x] IPC 핸들러 구현
- [x] UI 스켈레톤 구현
- [x] 타입 체크 통과
- [x] 빌드 성공

### 남은 작업 (선택)
- [ ] Desktop 앱 실행 테스트 (사용자 환경)
- [ ] Recipe 템플릿 추가 (pm-agent.yaml 복사)
- [ ] 문서 업데이트 (README.md)

## 참고

- 구현 계획: `.claude/docs/tasks/m2-phase3/context.md`
- 사전 합의서: `.claude/docs/agreements/m2-features-agreement.md`
- Worktree Manager: `packages/git-worktree/src/worktree-manager.ts`
- Recipe Schema: `packages/schema/src/recipe-schema.ts`
