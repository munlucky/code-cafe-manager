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
  force?: boolean; // 미커밋 변경사항이 있어도 강제 삭제
}
