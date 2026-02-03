import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import {
  WorktreeInfo,
  WorktreeCreateOptions,
  PatchExportOptions,
  WorktreeRemoveOptions,
  WorktreeMergeOptions,
  MergeResult,
  isValidWorktreeInfo,
} from './types.js';
import {
  WorktreeError,
  ErrorCode,
  getErrorMessage,
  createLogger,
} from '@codecafe/core';

const execFileAsync = promisify(execFile);
const logger = createLogger({ context: 'WorktreeManager' });

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
    } catch (error: unknown) {
      throw new WorktreeError(ErrorCode.WORKTREE_CREATE_FAILED, {
        message: `Failed to create worktree: ${getErrorMessage(error)}`,
        worktreePath: finalWorktreePath,
        cause: error instanceof Error ? error : undefined,
      });
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
    } catch (error: unknown) {
      throw new WorktreeError(ErrorCode.WORKTREE_ERROR, {
        message: `Failed to list worktrees: ${getErrorMessage(error)}`,
        cause: error instanceof Error ? error : undefined,
      });
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
      throw new WorktreeError(ErrorCode.WORKTREE_NOT_FOUND, {
        message: `Worktree not found: ${worktreePath}`,
        worktreePath,
      });
    }

    return info;
  }

  /**
   * Worktree 내부의 .git 파일에서 원본 저장소 경로 추출
   */
  private static async getRepoPathFromWorktree(worktreePath: string): Promise<string> {
    try {
      const gitFile = path.join(worktreePath, '.git');
      const content = await fsPromises.readFile(gitFile, 'utf-8');
      const match = content.match(/^gitdir: (.+?)(?:\.git-worktrees\/[^/\s]+)?$/m);
      if (match) {
        const gitdir = match[1].trim();
        // gitdir이 절대 경로인지 확인
        if (path.isAbsolute(gitdir)) {
          // .git/worktrees/<branch> 형태라면 상위로 올라감
          const worktreesMatch = gitdir.match(/^(.+)\.git-worktrees\/[^/]+$/);
          if (worktreesMatch) {
            return worktreesMatch[1];
          }
          return gitdir;
        }
        // 상대 경로인 경우 worktreePath 기준으로 계산
        return path.resolve(worktreePath, gitdir);
      }
    } catch (_error: unknown) {
      // .git 파일을 읽을 수 없으면 fallback
    }
    throw new WorktreeError(ErrorCode.WORKTREE_ERROR, {
      message: 'Cannot determine repository path from worktree',
      worktreePath,
    });
  }

  /**
   * Worktree 삭제
   */
  static async removeWorktree(options: WorktreeRemoveOptions): Promise<void> {
    const { worktreePath, repoPath, force } = options;

    // repoPath가 없으면 worktree 내부의 .git 파일에서 찾기
    let effectiveRepoPath = repoPath;
    if (!effectiveRepoPath) {
      try {
        effectiveRepoPath = await this.getRepoPathFromWorktree(worktreePath);
      } catch (_error: unknown) {
        // fallback: path.dirname(worktreePath) 사용 (거의 작동하지 않음)
        effectiveRepoPath = path.dirname(worktreePath);
      }
    }

    // Windows 파일 잠금(Permission denied) 대응을 위한 재시도 로직
    const maxRetries = 5;
    const retryDelay = 1000;
    let lastError: unknown;

    for (let i = 0; i < maxRetries; i++) {
      try {
        // 1. 미커밋 변경사항 확인 (force=false 일 때) - 첫 시도에만 확인하거나 매번 확인해도 무방
        if (!force && i === 0) {
          const hasChanges = await this.hasUncommittedChanges(worktreePath);
          if (hasChanges) {
            throw new WorktreeError(ErrorCode.WORKTREE_DELETE_FAILED, {
              message: 'Worktree has uncommitted changes. Use force=true to delete anyway.',
              worktreePath,
            });
          }
        }

        // 2. Git worktree remove 실행 (repoPath를 -C 옵션으로 지정)
        const args = [
          '-C', effectiveRepoPath,
          'worktree', 'remove',
          ...(force ? ['--force'] : []),
          worktreePath
        ];

        await execFileAsync('git', args);
        return; // 성공 시 종료

      } catch (error: unknown) {
        lastError = error;
        const msg = getErrorMessage(error);

        // 권한 문제나 잠금 문제인 경우 재시도
        if (msg.includes('Permission denied') || msg.includes('locked') || msg.includes('unlink')) {
          logger.warn(`Remove failed (attempt ${i + 1}/${maxRetries}): ${msg}. Retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }

        // 그 외 에러는 즉시 throw
        throw new WorktreeError(ErrorCode.WORKTREE_DELETE_FAILED, {
          message: `Failed to remove worktree: ${msg}`,
          worktreePath,
          cause: error instanceof Error ? error : undefined,
        });
      }
    }

    throw new WorktreeError(ErrorCode.WORKTREE_DELETE_FAILED, {
      message: `Failed to remove worktree after ${maxRetries} attempts: ${getErrorMessage(lastError)}`,
      worktreePath,
      cause: lastError instanceof Error ? lastError : undefined,
    });
  }

  /**
   * Worktree 브랜치를 대상 브랜치에 병합
   */
  static async mergeToTarget(options: WorktreeMergeOptions): Promise<MergeResult> {
    const { worktreePath, repoPath, targetBranch, deleteAfterMerge, squash, autoCommit } = options;

    try {
      // 0. Safe directory 설정
      await this.ensureSafeDirectory(repoPath);

      // 1. 현재 브랜치명 조회 (worktree에서)
      const { stdout: currentBranch } = await execFileAsync(
        'git',
        ['branch', '--show-current'],
        { cwd: worktreePath }
      );
      const branchToMerge = currentBranch.trim();

      if (!branchToMerge) {
        throw new WorktreeError(ErrorCode.WORKTREE_ERROR, {
          message: 'Cannot determine current branch in worktree',
          worktreePath,
        });
      }

      logger.info(`Merging ${branchToMerge} into ${targetBranch}`);

      // 2. 미커밋 변경사항 확인 및 처리
      const hasChanges = await this.hasUncommittedChanges(worktreePath);
      if (hasChanges) {
        if (autoCommit) {
          // autoCommit이 활성화되면 모든 변경사항을 자동 커밋
          logger.info('Auto-committing uncommitted changes...');
          await execFileAsync('git', ['add', '-A'], { cwd: worktreePath });
          await execFileAsync(
            'git',
            ['commit', '-m', `Auto-commit before merge to ${targetBranch}`],
            { cwd: worktreePath }
          );
          logger.info('Auto-commit completed');
        } else {
          throw new WorktreeError(ErrorCode.WORKTREE_ERROR, {
            message: 'Worktree has uncommitted changes. Please commit or stash changes before merging.',
            worktreePath,
          });
        }
      }

      // 3. 메인 레포에서 대상 브랜치로 체크아웃
      await execFileAsync('git', ['checkout', targetBranch], { cwd: repoPath });

      // 4. 최신 상태로 pull (선택적 - 로컬 병합만 수행)
      try {
        await execFileAsync('git', ['pull', '--ff-only'], { cwd: repoPath });
      } catch (_error: unknown) {
        // pull 실패해도 로컬 병합은 진행 (원격이 없을 수 있음)
        logger.info('Pull failed, continuing with local merge');
      }

      // 5. 병합 실행
      const mergeArgs = squash
        ? ['merge', '--squash', branchToMerge]
        : ['merge', '--no-ff', branchToMerge, '-m', `Merge branch '${branchToMerge}' into ${targetBranch}`];

      await execFileAsync('git', mergeArgs, { cwd: repoPath });

      // squash 병합인 경우 별도 커밋 필요
      let commitHash: string | undefined;
      if (squash) {
        await execFileAsync(
          'git',
          ['commit', '-m', `Squash merge branch '${branchToMerge}' into ${targetBranch}`],
          { cwd: repoPath }
        );
      }

      // 6. 최종 커밋 해시 조회
      const { stdout: hash } = await execFileAsync(
        'git',
        ['rev-parse', 'HEAD'],
        { cwd: repoPath }
      );
      commitHash = hash.trim();

      logger.info(`Merge successful. Commit: ${commitHash}`);

      // 7. Worktree 삭제 (옵션)
      let worktreeRemoved = false;
      if (deleteAfterMerge) {
        await this.removeWorktree({ worktreePath, repoPath, force: true });
        worktreeRemoved = true;

        // 8. 브랜치 삭제 (worktree 삭제 후)
        try {
          await execFileAsync('git', ['branch', '-d', branchToMerge], { cwd: repoPath });
          logger.info(`Deleted branch: ${branchToMerge}`);
        } catch (branchError: unknown) {
          logger.warn(`Failed to delete branch: ${getErrorMessage(branchError)}`);
        }
      }

      return {
        success: true,
        mergedBranch: branchToMerge,
        targetBranch,
        commitHash,
        worktreeRemoved,
      };
    } catch (error: unknown) {
      logger.error('Merge failed:', { error: getErrorMessage(error) });
      return {
        success: false,
        mergedBranch: '',
        targetBranch,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Worktree만 삭제하고 브랜치와 커밋 내역은 유지
   * Order 작업 내역을 보존하면서 worktree 디렉터리만 정리
   */
  static async removeWorktreeOnly(
    worktreePath: string,
    repoPath: string
  ): Promise<{ success: boolean; branch: string; error?: string }> {
    try {
      // 1. Worktree 정보 조회 (브랜치명 보존)
      const worktreeInfo = await this.getWorktreeInfo(repoPath, worktreePath);
      const branch = worktreeInfo.branch;

      // 2. Worktree 삭제 (브랜치는 삭제하지 않음)
      await this.removeWorktree({ worktreePath, repoPath, force: true });

      logger.info(`Removed worktree only, branch preserved: ${branch}`);

      return { success: true, branch };
    } catch (error: unknown) {
      return { success: false, branch: '', error: getErrorMessage(error) };
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
    } catch (error: unknown) {
      throw new WorktreeError(ErrorCode.WORKTREE_ERROR, {
        message: `Failed to export patch: ${getErrorMessage(error)}`,
        worktreePath,
        cause: error instanceof Error ? error : undefined,
      });
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
    } catch (_error: unknown) {
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
        if (isValidWorktreeInfo(current)) {
          worktrees.push(current);
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

    if (isValidWorktreeInfo(current)) {
      worktrees.push(current);
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
    } catch (_error: unknown) {
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
    } catch (_error: unknown) {
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
      logger.info(`Added safe.directory: ${absolutePath}`);
    } catch (error: unknown) {
      logger.error(`Failed to add safe.directory '${absolutePath}': ${getErrorMessage(error)}`);
      // 설정 실패해도 worktree 생성 시도는 계속 진행
    }
  }
}
