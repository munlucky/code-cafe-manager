import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import {
  WorktreeInfo,
  WorktreeCreateOptions,
  PatchExportOptions,
  WorktreeRemoveOptions,
} from './types.js';

const execFileAsync = promisify(execFile);

/**
 * Git Worktree 관리 클래스
 * 보안: execFile 사용으로 command injection 방지
 */
export class WorktreeManager {
  /**
   * Worktree 생성
   */
  static async createWorktree(options: WorktreeCreateOptions): Promise<WorktreeInfo> {
    const { repoPath, baseBranch, newBranch, worktreePath } = options;

    // Worktree 경로 결정 (사전 합의서: 프로젝트 외부)
    const finalWorktreePath =
      worktreePath ||
      path.resolve(repoPath, '..', '.codecafe-worktrees', newBranch);

    try {
      // 1. Worktree 디렉터리 생성
      fs.mkdirSync(path.dirname(finalWorktreePath), { recursive: true });

      // 2. Git worktree add 실행 (보안: execFile 사용)
      await execFileAsync(
        'git',
        ['worktree', 'add', '-b', newBranch, finalWorktreePath, baseBranch],
        { cwd: repoPath }
      );

      // 3. Worktree 정보 조회
      const info = await this.getWorktreeInfo(repoPath, finalWorktreePath);

      return info;
    } catch (error: any) {
      throw new Error(`Failed to create worktree: ${error.message}`);
    }
  }

  /**
   * Worktree 목록 조회
   */
  static async listWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
    try {
      const { stdout } = await execFileAsync('git', ['worktree', 'list', '--porcelain'], {
        cwd: repoPath,
      });

      return this.parseWorktreeList(stdout);
    } catch (error: any) {
      throw new Error(`Failed to list worktrees: ${error.message}`);
    }
  }

  /**
   * Worktree 정보 조회
   */
  static async getWorktreeInfo(
    repoPath: string,
    worktreePath: string
  ): Promise<WorktreeInfo> {
    const worktrees = await this.listWorktrees(repoPath);
    const info = worktrees.find((wt) => wt.path === worktreePath);

    if (!info) {
      throw new Error(`Worktree not found: ${worktreePath}`);
    }

    return info;
  }

  /**
   * Worktree 삭제
   */
  static async removeWorktree(options: WorktreeRemoveOptions): Promise<void> {
    const { worktreePath, force } = options;

    try {
      // 1. 미커밋 변경사항 확인 (force=false 일 때)
      if (!force) {
        const hasChanges = await this.hasUncommittedChanges(worktreePath);
        if (hasChanges) {
          throw new Error(
            'Worktree has uncommitted changes. Use force=true to delete anyway.'
          );
        }
      }

      // 2. Git worktree remove 실행 (보안: execFile 사용)
      const args = force
        ? ['worktree', 'remove', '--force', worktreePath]
        : ['worktree', 'remove', worktreePath];

      await execFileAsync('git', args, { cwd: worktreePath });
    } catch (error: any) {
      throw new Error(`Failed to remove worktree: ${error.message}`);
    }
  }

  /**
   * Patch 내보내기
   */
  static async exportPatch(options: PatchExportOptions): Promise<string> {
    const { worktreePath, baseBranch, outputPath } = options;

    try {
      // 1. 현재 브랜치명 조회
      const { stdout: currentBranch } = await execFileAsync(
        'git',
        ['branch', '--show-current'],
        { cwd: worktreePath }
      );

      // 2. Patch 파일 경로 결정
      const patchPath =
        outputPath || path.join(worktreePath, `${currentBranch.trim()}.patch`);

      // 3. git diff 실행 (보안: execFile 사용)
      const { stdout: diffOutput } = await execFileAsync(
        'git',
        ['diff', `${baseBranch}...HEAD`],
        { cwd: worktreePath }
      );

      // 4. Patch 파일 저장
      fs.writeFileSync(patchPath, diffOutput, 'utf-8');

      return patchPath;
    } catch (error: any) {
      throw new Error(`Failed to export patch: ${error.message}`);
    }
  }

  /**
   * 미커밋 변경사항 확인
   */
  private static async hasUncommittedChanges(worktreePath: string): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync('git', ['status', '--porcelain'], {
        cwd: worktreePath,
      });

      return stdout.trim().length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Worktree list 파싱
   */
  private static parseWorktreeList(output: string): WorktreeInfo[] {
    const worktrees: WorktreeInfo[] = [];
    const lines = output.split('\n');
    let current: Partial<WorktreeInfo> = {};

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        if (current.path) {
          worktrees.push(current as WorktreeInfo);
        }
        current = { path: line.substring(9) };
      } else if (line.startsWith('branch ')) {
        current.branch = line.substring(7).replace('refs/heads/', '');
      } else if (line.startsWith('HEAD ')) {
        current.commit = line.substring(5);
      } else if (line.startsWith('bare')) {
        current.bare = true;
      } else if (line.startsWith('detached')) {
        current.detached = true;
      } else if (line.startsWith('prunable')) {
        current.prunable = true;
      }
    }

    if (current.path) {
      worktrees.push(current as WorktreeInfo);
    }

    return worktrees;
  }
}
