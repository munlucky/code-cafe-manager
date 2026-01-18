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
 * 경로를 슬래시 형식으로 정규화 (Windows 호환)
 * Git은 슬래시 형식 경로를 기대하므로 백슬래시를 슬래시로 변환
 */
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

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

    // 0. Safe directory 설정 (Windows dubious ownership 에러 방지)
    await this.ensureSafeDirectory(repoPath);

    // 1. 브랜치 중복 확인 (필요 시 suffix 추가)
    const finalBranchName = await this.getUniqueBranchName(repoPath, newBranch);

    // Worktree 경로 결정 (사전 합의서: 프로젝트 외부)
    const finalWorktreePath =
      worktreePath ||
      path.resolve(repoPath, '..', '.codecafe-worktrees', finalBranchName);

    try {
      // 2. Worktree 디렉터리 생성
      fs.mkdirSync(path.dirname(finalWorktreePath), { recursive: true });

      // 3. Git worktree add 실행 (보안: execFile 사용)
      await execFileAsync(
        'git',
        ['worktree', 'add', '-b', finalBranchName, finalWorktreePath, baseBranch],
        { cwd: repoPath }
      );

      // 4. Worktree 정보 조회
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
    // 경로 비교 시 슬래시 형식으로 정규화 (Windows 호환)
    const normalizedWorktreePath = normalizePath(worktreePath);
    const info = worktrees.find((wt) => normalizePath(wt.path) === normalizedWorktreePath);

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

  /**
   * 중복되지 않는 브랜치명 생성
   * 브랜치가 이미 존재하면 suffix를 붙여서 고유한 이름 생성 (예: order-123 -> order-123-2)
   */
  private static async getUniqueBranchName(repoPath: string, baseName: string): Promise<string> {
    const branches = await this.listBranches(repoPath);
    let candidateName = baseName;
    let suffix = 2;

    while (branches.includes(candidateName)) {
      candidateName = `${baseName}-${suffix}`;
      suffix++;
    }

    return candidateName;
  }

  /**
   * 모든 브랜치 목록 조회
   */
  private static async listBranches(repoPath: string): Promise<string[]> {
    try {
      const { stdout } = await execFileAsync(
        'git',
        ['branch', '--format=%(refname:short)'],
        { cwd: repoPath }
      );
      return stdout.trim().split('\n').filter(Boolean);
    } catch (error: any) {
      // 브랜치가 없는 경우 빈 배열 반환
      return [];
    }
  }

  /**
   * Safe directory 설정 (Windows dubious ownership 에러 방지)
   * Git 2.35.2+에서 다른 사용자 소유 저장소 접근 시 발생하는 보안 에러 해결
   *
   * 주의: git config --global 명령은 cwd 없이 실행해야 함
   * dubious ownership 저장소에서 cwd로 실행하면 명령 자체가 실패함
   */
  private static async ensureSafeDirectory(repoPath: string): Promise<void> {
    // Git은 슬래시 형식 경로를 기대하므로 Windows 백슬래시를 슬래시로 변환
    const absolutePath = path.resolve(repoPath).replace(/\\/g, '/');
    let safeDirectories: string[] = [];

    // 1. 현재 safe.directory 목록 확인 (cwd 없이 실행 - global 설정이므로)
    try {
      const { stdout } = await execFileAsync(
        'git',
        ['config', '--global', '--get-all', 'safe.directory']
      );
      safeDirectories = stdout.trim().split('\n').filter(Boolean);
    } catch {
      // safe.directory 설정이 없으면 git-config는 exit code 1을 반환
      // 정상적인 경우이므로 빈 배열로 진행
    }

    // 2. 이미 등록되어 있으면 스킵 (대소문자 무시, 슬래시 정규화)
    const isAlreadySafe = safeDirectories.some(
      (dir: string) => dir.replace(/\\/g, '/').toLowerCase() === absolutePath.toLowerCase() || dir === '*'
    );

    if (isAlreadySafe) {
      return;
    }

    // 3. safe.directory에 추가 (cwd 없이 실행 - global 설정이므로)
    try {
      await execFileAsync(
        'git',
        ['config', '--global', '--add', 'safe.directory', absolutePath]
      );
      console.log(`[WorktreeManager] Added safe.directory: ${absolutePath}`);
    } catch (error: any) {
      console.error(`[WorktreeManager] Failed to add safe.directory '${absolutePath}': ${error.message}`);
      // 설정 실패해도 worktree 생성 시도는 계속 진행
    }
  }
}
