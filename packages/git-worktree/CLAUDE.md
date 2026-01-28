# @codecafe/git-worktree

> Git Worktree 관리 유틸리티

## Flow

```
[Orchestrator/Desktop 호출]
        │
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│  src/index.ts                                                         │
│  - WorktreeManager export                                             │
│  - types export                                                       │
└───────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│  src/worktree-manager.ts:36-531                                       │
│  WorktreeManager (static methods)                                     │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  createWorktree(options):40-76                                  │  │
│  │  1. ensureSafeDirectory() → dubious ownership 방지               │  │
│  │  2. getUniqueBranchName() → 브랜치 중복 확인                      │  │
│  │  3. git worktree add -b <branch> <path> <base>                  │  │
│  │  4. getWorktreeInfo() → 생성 결과 반환                           │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  removeWorktree(options):152-220                                │  │
│  │  1. hasUncommittedChanges() 확인 (force=false 시)                │  │
│  │  2. git worktree remove (재시도 로직 포함)                        │  │
│  │  3. Windows 파일 잠금 대응 (5회 재시도)                           │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  mergeToTarget(options):225-339                                 │  │
│  │  1. hasUncommittedChanges() 확인                                 │  │
│  │  2. autoCommit 옵션 시 자동 커밋                                  │  │
│  │  3. git checkout <target> (메인 레포)                            │  │
│  │  4. git merge (squash 또는 no-ff)                               │  │
│  │  5. deleteAfterMerge 시 worktree + branch 삭제                  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  Other Methods                                                  │  │
│  │  - listWorktrees():81-94 → git worktree list --porcelain        │  │
│  │  - getWorktreeInfo():99-116 → 단일 worktree 조회                 │  │
│  │  - removeWorktreeOnly():345-363 → worktree만 삭제, 브랜치 유지    │  │
│  │  - exportPatch():368-401 → git diff를 patch 파일로 저장          │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│  Git CLI (execFile - command injection 방지)                          │
│  - git worktree add/list/remove                                       │
│  - git branch/checkout/merge                                          │
│  - git diff/status                                                    │
└───────────────────────────────────────────────────────────────────────┘
```

## File Map

| 파일 | 역할 | 핵심 Export |
|------|------|-------------|
| `src/index.ts` | 패키지 진입점 | types, `WorktreeManager` |
| `src/types.ts` | 타입 정의 | `WorktreeInfo`, `WorktreeCreateOptions`, `MergeResult` |
| `src/worktree-manager.ts` | Worktree 관리 | `WorktreeManager` (static) |

## Types

```typescript
interface WorktreeInfo {
  path: string;
  branch: string;
  commit: string;
  bare?: boolean;
  detached?: boolean;
  prunable?: boolean;
}

interface WorktreeCreateOptions {
  repoPath: string;
  baseBranch: string;
  newBranch: string;
  worktreePath?: string;  // 미지정 시: ../.codecafe-worktrees/<branch>
}

interface WorktreeMergeOptions {
  worktreePath: string;
  repoPath: string;
  targetBranch: string;
  deleteAfterMerge?: boolean;
  squash?: boolean;
  autoCommit?: boolean;
}

interface MergeResult {
  success: boolean;
  mergedBranch: string;
  targetBranch: string;
  commitHash?: string;
  worktreeRemoved?: boolean;
  error?: string;
}
```

## Dependencies

- **상위**: `orchestrator`, `cli`, `desktop`
- **하위**: `@codecafe/core` (에러 클래스, 로거)
- **외부**: (Node.js built-in만 사용)

## Security

```typescript
// execFile 사용 (shell injection 방지)
await execFileAsync('git', ['worktree', 'add', '-b', branch, path, base], { cwd });

// ❌ 절대 금지
await exec(`git worktree add -b ${branch} ${path} ${base}`);
```

## Review Checklist

이 패키지 변경 시 확인:
- [ ] Git 명령어 추가 시 → `execFile` 사용 필수
- [ ] 경로 처리 시 → Windows/Unix 호환성 (`normalizePath`)
- [ ] 에러 처리 시 → `WorktreeError` with `ErrorCode` 사용
- [ ] 재시도 로직 변경 시 → Windows 파일 잠금 케이스 테스트

## Platform Notes

- **Windows**: dubious ownership 에러 → `ensureSafeDirectory()`로 해결
- **Windows**: 파일 잠금 → 5회 재시도 (1초 간격)
- **Path**: 슬래시 정규화 필수 (`path.replace(/\\/g, '/')`)
