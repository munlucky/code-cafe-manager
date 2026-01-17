# Skill Preset Feature Implementation Plan

> Project rules: `.claude/PROJECT.md`

## Metadata

- Author: User
- Created: 2026-01-16
- Branch: main
- Complexity: medium
- Related doc: N/A (new feature)

## Task Overview

- Goal: Skills 관련 메뉴 및 moonshot 프리셋 기능 구현
- Scope:
  - moonshot 기본 프리셋 데이터 생성 (문서 메모리 관련 기능 제외)
  - Skills API/IPC Handler 구현 (skill:list, skill:get, skill:create, skill:update, skill:delete)
  - window.d.ts에 Skill API 타입 추가
  - Skills 뷰 컴포넌트 생성 (프리셋 목록, 추가/편집/삭제)
  - 메인 네비게이션에 Skills 메뉴 추가
- Impact: workflows에서 활용할 skill preset을 관리할 수 있는 UI/Backend 추가

## Target Files

### New

- `packages/desktop/src/main/ipc/skill.ts` - Skills IPC Handler (CRUD operations)
- `packages/desktop/src/renderer/components/views/Skills.tsx` - Skills 뷰 컴포넌트
- `packages/desktop/src/renderer/components/skill/SkillPresetEditorDialog.tsx` - 프리셋 편집 다이얼로그
- `.orch/skills/moonshot-default.json` - moonshot 기본 프리셋 데이터 (초기 생성)

### Modified

- `packages/desktop/src/renderer/types/window.d.ts` - Skill API 타입 추가
- `packages/desktop/src/renderer/store/useViewStore.ts` - skills 뷰 추가
- `packages/desktop/src/renderer/App.tsx` - Skills 뷰 라우팅 추가
- `packages/desktop/src/renderer/components/views/index.ts` - Skills export 추가
- `packages/desktop/src/main/index.ts` - registerSkillHandlers 호출 추가

## Current State / Similar Features

### Similar Feature Pattern
- `packages/desktop/src/main/ipc/workflow.ts` - IPC Handler 패턴 참조
  - `handleIpc()` wrapper 함수 사용
  - `listWorkflows()`, `getWorkflow()`, `createWorkflow()`, `updateWorkflow()`, `deleteWorkflow()` 구조
  - `ipcMain.handle()`로 IPC 채널 등록
- `packages/desktop/src/renderer/components/views/Workflows.tsx` - 뷰 컴포넌트 패턴 참조
  - 목록 로딩, 에러 상태, 편집 다이얼로그 상태 관리
  - WorkflowCard 패턴 활용
- `packages/desktop/src/renderer/components/workflow/WorkflowEditorDialog.tsx` - 다이얼로그 패턴 참조

### Reusable Patterns/Components
- `Button`, `Card`, `EmptyState`, `Dialog`, `Input` UI 컴포넌트
- `IpcResponse<T>` 타입 (window.d.ts)
- `useViewStore` 뷰 상태 관리

## Implementation Plan

### Phase 1: moonshot 기본 프리셋 데이터

#### 1.1 기본 프리셋 데이터 정의

파일: `.orch/skills/moonshot-default.json`

```json
{
  "id": "moonshot-default",
  "name": "Moonshot Default",
  "description": "기본 Moonshot 워크플로우 스킬 프리셋 (문서 메모리 기능 제외)",
  "isBuiltIn": true,
  "skills": [
    {
      "id": "classify-task",
      "name": "Task Classification",
      "description": "사용자 요청을 작업 유형(feature, modification, bugfix, refactor)으로 분류하고 의도 키워드 추출",
      "category": "analysis",
      "skillCommand": "/moonshot-classify-task",
      "context": "fork",
      "isBuiltIn": true
    },
    {
      "id": "evaluate-complexity",
      "name": "Complexity Evaluation",
      "description": "예상 파일/라인/시간을 기반으로 복잡도(simple, medium, complex) 평가",
      "category": "analysis",
      "skillCommand": "/moonshot-evaluate-complexity",
      "context": "fork",
      "isBuiltIn": true
    },
    {
      "id": "detect-uncertainty",
      "name": "Uncertainty Detection",
      "description": "누락된 요구사항 감지 및 질문 생성",
      "category": "analysis",
      "skillCommand": "/moonshot-detect-uncertainty",
      "context": "fork",
      "isBuiltIn": true
    },
    {
      "id": "decide-sequence",
      "name": "Sequence Decision",
      "description": "analysisContext를 기반으로 단계와 실행 체인 결정",
      "category": "planning",
      "skillCommand": "/moonshot-decide-sequence",
      "context": "fork",
      "isBuiltIn": true
    },
    {
      "id": "pre-flight-check",
      "name": "Pre-flight Check",
      "description": "작업 시작 전 필수 정보 및 프로젝트 상태 확인",
      "category": "planning",
      "skillCommand": "/pre-flight-check",
      "context": "fork",
      "isBuiltIn": true
    },
    {
      "id": "requirements-analyzer",
      "name": "Requirements Analyzer",
      "description": "요구사항 분석 및 preliminary agreement 작성 (Agent)",
      "category": "planning",
      "skillCommand": "requirements-analyzer",
      "context": "fork",
      "isBuiltIn": true
    },
    {
      "id": "context-builder",
      "name": "Context Builder",
      "description": "구현 계획(context.md) 작성 (Agent)",
      "category": "planning",
      "skillCommand": "context-builder",
      "context": "fork",
      "isBuiltIn": true
    },
    {
      "id": "implementation-runner",
      "name": "Implementation Runner",
      "description": "구현 실행 및 변경사항 기록 (Agent)",
      "category": "implementation",
      "skillCommand": "implementation-runner",
      "context": "inherit",
      "isBuiltIn": true
    },
    {
      "id": "codex-review-code",
      "name": "Codex Code Review",
      "description": "구현 품질 및 회귀 위험 검토 (Codex Code Reviewer)",
      "category": "verification",
      "skillCommand": "codex-review-code",
      "context": "fork",
      "isBuiltIn": true
    },
    {
      "id": "codex-test-integration",
      "name": "Codex Integration Test",
      "description": "통합 영향 및 회귀 위험 검증 (Codex Integration Reviewer)",
      "category": "verification",
      "skillCommand": "codex-test-integration",
      "context": "fork",
      "isBuiltIn": true
    }
  ],
  "createdAt": "2026-01-16T00:00:00Z",
  "updatedAt": "2026-01-16T00:00:00Z"
}
```

### Phase 2: Skills API/IPC Handler

#### 2.1 IPC Handler 구현

파일: `packages/desktop/src/main/ipc/skill.ts`

```typescript
/**
 * Skills IPC Handlers
 * Wraps skill preset management with standardized IpcResponse format
 */

import { ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import type { SkillPreset, SkillPresetItem } from '@codecafe/desktop-renderer/types/models';

interface IpcResponse<T = void> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// ... (handleIpc wrapper, getSkillsDir, listPresets, get, create, update, delete functions)
// ... (registerSkillHandlers with skill:list, skill:get, skill:create, skill:update, skill:delete)
```

핸들러 구조:
1. `getSkillsDir()`: `.orch/skills/` 디렉토리 경로 반환
2. `listPresets()`: 모든 프리셋 목록 반환 (built-in + user)
3. `getPreset(id)`: 단일 프리셋 반환
4. `createPreset(data)`: 새 프리셋 생성 (user-only)
5. `updatePreset(data)`: 프리셋 수정 (user-only, built-in은 복사 후 수정)
6. `deletePreset(id)`: 프리셋 삭제 (user-only, built-in은 삭제 불가)

#### 2.2 main/index.ts 수정

```typescript
import { registerSkillHandlers } from './ipc/skill.js';

function setupIpcHandlers(): void {
  // ... existing handlers
  registerSkillHandlers(); // Add this
}
```

### Phase 3: window.d.ts 타입 추가

파일: `packages/desktop/src/renderer/types/window.d.ts`

```typescript
// Add to Window interface
skill: {
  list: () => Promise<IpcResponse<SkillPreset[]>>;
  get: (presetId: string) => Promise<IpcResponse<SkillPreset | null>>;
  create: (presetData: SkillPreset) => Promise<IpcResponse<SkillPreset>>;
  update: (presetData: SkillPreset) => Promise<IpcResponse<SkillPreset>>;
  delete: (presetId: string) => Promise<IpcResponse<{ success: boolean }>>;
  duplicate: (presetId: string, newId: string) => Promise<IpcResponse<SkillPreset>>;
};
```

### Phase 4: Skills 뷰 컴포넌트

#### 4.1 Skills.tsx 뷰

파일: `packages/desktop/src/renderer/components/views/Skills.tsx`

- `SkillPresetCard` 컴포넌트 (프리셋 카드)
  - built-in 표시 배지
  - 복사 버튼 (built-in만)
  - 편집 버튼
  - 삭제 버튼 (user-only)
- `Skills` 메인 컴포넌트
  - 프리셋 목록 로딩
  - 추가/편집/삭제 기능
  - 카테고리별 필터링 (analysis, planning, implementation, verification, utility)

#### 4.2 SkillPresetEditorDialog.tsx

파일: `packages/desktop/src/renderer/components/skill/SkillPresetEditorDialog.tsx`

- 프리셋 이름, 설명 입력
- 스킬 목록 (추가/편집/삭제)
- 각 스킬: 이름, 설명, 카테고리, 스킬 커맨드, context 선택

### Phase 5: 네비게이션 통합

#### 5.1 useViewStore.ts 수정

```typescript
export type ViewParams = {
  // ... existing
  skills: void;
};
```

#### 5.2 App.tsx 수정

```typescript
import { Skills } from './components/views';

const VIEW_MAP: Record<string, React.ComponentType> = {
  // ... existing
  skills: Skills,
};
```

#### 5.3 views/index.ts 수정

```typescript
export { Skills } from './Skills';
```

## Moonshot Preset Data Sources

| 스킬 ID | SKILL.md 파일 | 카테고리 | 설명 |
|--------|--------------|----------|------|
| moonshot-classify-task | .claude/skills/moonshot-classify-task/SKILL.md | analysis | 작업 유형 분류 |
| moonshot-evaluate-complexity | .claude/skills/moonshot-evaluate-complexity/SKILL.md | analysis | 복잡도 평가 |
| moonshot-detect-uncertainty | .claude/skills/moonshot-detect-uncertainty/SKILL.md | analysis | 불확실성 감지 |
| moonshot-decide-sequence | .claude/skills/moonshot-decide-sequence/SKILL.md | planning | 실행 순서 결정 |
| pre-flight-check | .claude/skills/pre-flight-check/SKILL.md | planning | 사전 점검 |
| requirements-analyzer | .claude/agents/requirements-analyzer.md | planning | 요구사항 분석 |
| context-builder | .claude/agents/context-builder.md | planning | 컨텍스트 빌더 |
| implementation-runner | .claude/skills/implementation-runner/SKILL.md | implementation | 구현 실행 |
| codex-review-code | .claude/skills/codex-review-code/SKILL.md | verification | 코드 리뷰 |
| codex-test-integration | .claude/skills/codex-test-integration/SKILL.md | verification | 통합 테스트 |

## Risks and Alternatives

| Risk | Impact | Alternative |
|------|--------|-------------|
| built-in 프리셋 실수로 삭제/수정 가능 | 데이터 손실 | isBuiltIn 플래그로 삭제 방지, 수정 시 복사 유도 |
| .orch/skills/ 디렉토리 초기화 시 기본 프리셋 소실 | 사용자 경험 | 앱 시작 시 기본 프리셋 존재 확인 및 재생성 로직 |
| 스킬 커맨드 유효성 검증 어려움 | 잘못된 스킬 실행 | 선택 목록에서만 선택하도록 제한 (자유 입력 X) |

## Dependencies

- API spec: 자체적으로 정의 (내부 IPC)
- Menu/permissions: 기존 메뉴 구조에 추가
- Other: 없음 (순수 TypeScript)

## Checkpoints

- [ ] Phase 1: 기본 프리셋 JSON 데이터 생성 완료
- [ ] Phase 2: IPC Handler 구현 및 등록 완료
- [ ] Phase 3: window.d.ts 타입 추가 완료
- [ ] Phase 4: Skills 뷰 및 Editor 다이얼로그 완료
- [ ] Phase 5: 네비게이션 통합 완료
- [ ] Type check 통과
- [ ] Build 성공

## Verification

1. `pnpm typecheck` - 타입 검증
2. `pnpm build` - 빌드 성공 확인
3. Skills 메뉴에서 moonshot-default 프리셋 표시 확인
4. built-in 프리셋 복사 기능 동작 확인
5. 사용자 프리셋 생성/편집/ 삭제 기능 동작 확인

## Open Questions

1. 프리셋 파일 형식: JSON vs YAML? → **JSON** (workflow.ts 패턴 따름)
2. built-in 프리셋 수정 방식: 복사 후 편집? → **네**, 복사 후 user 프리셋으로 생성
3. 스킬 커맨드 입력 방식: 자유 입력 vs 선택 목록? → **선택 목록 + 자유 입력 옵션**
