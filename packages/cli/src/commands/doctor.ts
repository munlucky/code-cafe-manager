import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from '../config.js';
import { ClaudeCodeProvider } from '@codecafe/provider-claude-code';
import { spawn } from 'child_process';

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
        const configManager = new ConfigManager();
        const config = await configManager.loadConfig();
        configSpinner.succeed(
          `Configuration OK (${configManager.getConfigDir()})`
        );
      } catch (error) {
        configSpinner.fail('Configuration not found');
        console.log(
          chalk.yellow(`  Run ${chalk.bold('codecafe init')} to initialize`)
        );
        hasErrors = true;
      }

      // 2. Git 확인
      const gitSpinner = ora('Checking git...').start();
      try {
        const hasGit = await checkCommand('git', ['--version']);
        if (hasGit) {
          gitSpinner.succeed('Git OK');
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
          console.log(chalk.yellow(`  Hint: ${ClaudeCodeProvider.getAuthHint()}`));
          hasErrors = true;
        }
      } catch (error) {
        claudeSpinner.fail('Claude CLI check failed');
        hasErrors = true;
      }

      // 4. Node.js 버전 확인
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
        console.log(chalk.red.bold('✗ Some checks failed'));
        process.exit(1);
      } else {
        console.log(chalk.green.bold('✓ All checks passed!'));
      }
    });
}

async function checkCommand(
  command: string,
  args: string[]
): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, { stdio: 'ignore' });

    proc.on('error', () => resolve(false));
    proc.on('exit', (code) => resolve(code === 0));
  });
}
