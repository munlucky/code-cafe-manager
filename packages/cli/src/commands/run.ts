import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ClaudeCodeProvider } from '@codecafe/provider-claude-code';
import { resolve } from 'path';

/**
 * Get default provider from environment or default
 */
function getDefaultProvider(): string {
  return process.env.CODECAFE_DEFAULT_PROVIDER || 'claude-code';
}

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('Run Claude Code with a task')
    .option('--counter <path>', 'Project directory', '.')
    .option('--issue <text>', 'Issue or task description', '')
    .option('--provider <name>', 'Provider to use')
    .action(async (options) => {
      const spinner = ora('Starting CodeCafe...').start();

      try {
        const counter = resolve(options.counter);
        const provider = options.provider || getDefaultProvider();
        const issue = options.issue;

        if (!issue) {
          spinner.fail('No task specified');
          console.log(chalk.yellow('Usage:'));
          console.log(`  ${chalk.bold('codecafe run --issue "your task"')}`);
          process.exit(1);
        }

        spinner.text = 'Validating environment...';

        // Provider 검증
        if (provider === 'claude-code') {
          const result = await ClaudeCodeProvider.validateEnv();
          if (!result.valid) {
            spinner.fail(result.message || 'Provider validation failed');
            process.exit(1);
          }
        }

        spinner.text = 'Starting execution...';

        const providerInstance = new ClaudeCodeProvider();

        providerInstance.on('data', (data: string) => {
          process.stdout.write(data);
        });

        providerInstance.on('exit', ({ exitCode }: { exitCode: number; signal?: number }) => {
          if (exitCode === 0) {
            console.log(chalk.green('\n✓ Execution completed'));
          } else {
            console.log(chalk.red(`\n✗ Execution failed (exit code: ${exitCode})`));
            process.exit(exitCode);
          }
        });

        providerInstance.on('error', (error: Error) => {
          console.error(chalk.red(`\n✗ Error: ${error.message}`));
          process.exit(1);
        });

        spinner.succeed('Execution started');
        console.log(chalk.cyan(`Counter: ${counter}`));
        console.log(chalk.cyan(`Provider: ${provider}`));
        console.log(chalk.cyan(`Issue: ${issue}\n`));

        await providerInstance.run({
          workingDirectory: counter,
          prompt: issue,
        });
      } catch (error) {
        spinner.fail('Execution failed');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}
