import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ClaudeCodeProvider } from '@codecafe/provider-claude-code';
import { CodexProvider } from '@codecafe/providers-codex';
import { spawn } from 'child_process';
import { ensureConfigDir } from '../config.js';

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Check environment and dependencies')
    .action(async () => {
      console.log(chalk.cyan.bold('CodeCafe Doctor\n'));

      let hasErrors = false;

      // 1. 설정 확인
      const configSpinner = ora('Checking configuration...').start();
      try {
        const configDir = await ensureConfigDir();
        configSpinner.succeed(`Configuration OK (${configDir})`);
      } catch (error) {
        configSpinner.fail('Configuration check failed');
        hasErrors = true;
      }

      // 2. Git 확인 (버전 체크 포함)
      const gitSpinner = ora('Checking git...').start();
      try {
        const gitVersion = await getGitVersion();
        if (gitVersion) {
          // Git 버전 체크 (2.20+ 필요)
          const versionMatch = gitVersion.match(/(\d+)\.(\d+)/);
          if (versionMatch) {
            const major = parseInt(versionMatch[1]);
            const minor = parseInt(versionMatch[2]);
            if (major < 2 || (major === 2 && minor < 20)) {
              gitSpinner.warn(`Git ${gitVersion} (2.20+ recommended for worktree support)`);
            } else {
              gitSpinner.succeed(`Git ${gitVersion} OK`);
            }
          } else {
            gitSpinner.succeed(`Git ${gitVersion} OK`);
          }
        } else {
          gitSpinner.fail('Git not found');
          hasErrors = true;
        }
      } catch (error) {
        gitSpinner.fail('Git not found');
        hasErrors = true;
      }

      // 3. Claude CLI 확인
      const claudeSpinner = ora('Checking Claude CLI...').start();
      try {
        const result = await ClaudeCodeProvider.validateEnv();
        if (result.valid) {
          claudeSpinner.succeed('Claude CLI OK');
        } else {
          claudeSpinner.fail(result.message || 'Claude CLI not found');
          console.log(
            chalk.yellow(`  Install: https://claude.com/claude-code`)
          );
          const provider = new ClaudeCodeProvider();
          console.log(chalk.yellow(`  Hint: ${provider.getAuthHint()}`));
          hasErrors = true;
        }
      } catch (error) {
        claudeSpinner.fail('Claude CLI check failed');
        hasErrors = true;
      }

      // 4. Codex CLI 확인 (M2 추가)
      const codexSpinner = ora('Checking Codex CLI...').start();
      try {
        const result = await CodexProvider.validateEnv();
        if (result.valid) {
          codexSpinner.succeed('Codex CLI OK');
        } else {
          codexSpinner.warn(result.message || 'Codex CLI not found (optional)');
          console.log(
            chalk.yellow(`  Install: https://github.com/google/codex`)
          );
          const provider = new CodexProvider();
          console.log(chalk.yellow(`  Hint: ${provider.getAuthHint()}`));
        }
      } catch (error) {
        codexSpinner.warn('Codex CLI not found (optional)');
      }

      // 5. Node.js 버전 확인
      const nodeSpinner = ora('Checking Node.js version...').start();
      const nodeVersion = process.versions.node;
      const major = parseInt(nodeVersion.split('.')[0]);
      if (major >= 18) {
        nodeSpinner.succeed(`Node.js ${nodeVersion} OK`);
      } else {
        nodeSpinner.warn(`Node.js ${nodeVersion} (recommend >= 18.0.0)`);
      }

      console.log();
      if (hasErrors) {
        console.log(chalk.red.bold('[FAIL] Some checks failed'));
        process.exit(1);
      } else {
        console.log(chalk.green.bold('[OK] All checks passed!'));
      }
    });
}

async function getGitVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = spawn('git', ['--version'], { stdio: 'pipe' });

    let output = '';
    proc.stdout?.on('data', (data) => {
      output += data.toString();
    });

    proc.on('error', () => resolve(null));
    proc.on('exit', (code) => {
      if (code === 0) {
        // "git version 2.39.1" -> "2.39.1"
        const match = output.match(/git version ([\d.]+)/);
        resolve(match ? match[1] : output.trim());
      } else {
        resolve(null);
      }
    });
  });
}
