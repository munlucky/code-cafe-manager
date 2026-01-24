/**
 * Worktree 정보
 */
export interface WorktreeInfo {
  path: string;
  branch: string;
  commit: string;
  bare?: boolean;
  detached?: boolean;
  prunable?: boolean;
}

/**
 * Worktree 생성 옵션
 */
export interface WorktreeCreateOptions {
  repoPath: string;
  baseBranch: string;
  newBranch: string;
  worktreePath?: string; // 기본: {repoPath}/../.codecafe-worktrees/{newBranch}
}

/**
 * Patch 내보내기 옵션
 */
export interface PatchExportOptions {
  worktreePath: string;
  baseBranch: string;
  outputPath?: string; // 기본: {worktreePath}/{branch}.patch
}

/**
 * Worktree 삭제 옵션
 */
export interface WorktreeRemoveOptions {
  worktreePath: string;
  repoPath?: string; // git 실행 경로 (기본: worktreePath의 부모 디렉터리)
  force?: boolean; // 미커밋 변경사항이 있어도 강제 삭제
}

/**
 * Worktree 병합 옵션
 */
export interface WorktreeMergeOptions {
  worktreePath: string;
  repoPath: string;
  targetBranch: string; // 병합 대상 브랜치 (예: main, master)
  deleteAfterMerge?: boolean; // 병합 후 worktree 삭제 여부
  squash?: boolean; // squash merge 사용 여부
}

/**
 * 병합 결과
 */
export interface MergeResult {
  success: boolean;
  mergedBranch: string;
  targetBranch: string;
  commitHash?: string;
  worktreeRemoved?: boolean;
  error?: string;
}
