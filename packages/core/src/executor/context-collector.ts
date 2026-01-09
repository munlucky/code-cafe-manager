import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, access } from 'fs/promises';
import { join } from 'path';

const execAsync = promisify(exec);

/**
 * Context Collector
 * Collects various context information for recipe execution
 */

export interface CollectedContext {
  [key: string]: any;
}

/**
 * Collect context based on requested items
 */
export async function collectContext(
  items: string[],
  workingDir: string
): Promise<CollectedContext> {
  const context: CollectedContext = {};

  for (const item of items) {
    try {
      const value = await collectItem(item, workingDir);
      context[item] = value;
    } catch (err) {
      console.warn(`Failed to collect context item "${item}":`, err);
      context[item] = null;
    }
  }

  return context;
}

/**
 * Collect a single context item
 */
async function collectItem(item: string, workingDir: string): Promise<any> {
  const parts = item.split('.');

  switch (parts[0]) {
    case 'git':
      return await collectGitInfo(parts[1], workingDir);

    case 'project':
      return await collectProjectInfo(parts[1], workingDir);

    case 'env':
      return process.env[parts[1]] || null;

    default:
      throw new Error(`Unknown context category: ${parts[0]}`);
  }
}

/**
 * Collect Git information
 */
async function collectGitInfo(type: string, workingDir: string): Promise<any> {
  try {
    switch (type) {
      case 'branch': {
        const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
          cwd: workingDir,
        });
        return stdout.trim();
      }

      case 'status': {
        const { stdout } = await execAsync('git status --porcelain', {
          cwd: workingDir,
        });
        return stdout.trim() === '' ? 'clean' : 'modified';
      }

      case 'recentCommits': {
        const { stdout } = await execAsync('git log -5 --oneline', {
          cwd: workingDir,
        });
        return stdout
          .trim()
          .split('\n')
          .map((line) => {
            const [hash, ...messageParts] = line.split(' ');
            return {
              hash,
              message: messageParts.join(' '),
            };
          });
      }

      case 'diff': {
        const { stdout } = await execAsync('git diff HEAD', {
          cwd: workingDir,
          maxBuffer: 1024 * 1024, // 1MB
        });
        return stdout.trim();
      }

      case 'stagedDiff': {
        const { stdout } = await execAsync('git diff --staged', {
          cwd: workingDir,
          maxBuffer: 1024 * 1024, // 1MB
        });
        return stdout.trim();
      }

      default:
        throw new Error(`Unknown git info type: ${type}`);
    }
  } catch (err: any) {
    // Not a git repository or git command failed
    return null;
  }
}

/**
 * Collect project information
 */
async function collectProjectInfo(type: string, workingDir: string): Promise<any> {
  try {
    switch (type) {
      case 'hasContextMd': {
        const contextPath = join(workingDir, '.claude', 'docs', 'tasks');
        try {
          await access(contextPath);
          return true;
        } catch {
          return false;
        }
      }

      case 'hasPendingQuestions': {
        const questionsPath = join(workingDir, '.claude', 'docs', 'tasks');
        try {
          await access(questionsPath);
          // TODO: Check for actual pending-questions.md files
          return false;
        } catch {
          return false;
        }
      }

      case 'openFiles': {
        // In M1, we don't have IDE integration
        // This would be populated by IDE extension in M2+
        return [];
      }

      case 'packageJson': {
        const pkgPath = join(workingDir, 'package.json');
        try {
          const content = await readFile(pkgPath, 'utf-8');
          return JSON.parse(content);
        } catch {
          return null;
        }
      }

      default:
        throw new Error(`Unknown project info type: ${type}`);
    }
  } catch (err: any) {
    return null;
  }
}
