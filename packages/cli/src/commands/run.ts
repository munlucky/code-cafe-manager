import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from '../config.js';
import { ClaudeCodeProvider } from '@codecafe/provider-claude-code';
import { resolve } from 'path';

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('Run a recipe (default: house-blend pm-agent)')
    .option('--counter <path>', 'Project directory', '.')
    .option('--issue <text>', 'Issue or task description', '')
    .option('--provider <name>', 'Provider to use', 'claude-code')
    .option('--recipe <path>', 'Recipe file path (YAML)')
    .action(async (options) => {
      const spinner = ora('Starting CodeCafe...').start();

      try {
        const configManager = new ConfigManager();
        const config = await configManager.loadConfig();

        const counter = resolve(options.counter);
        const provider = options.provider || config.defaultProvider;
        const issue = options.issue;

        if (!issue && !options.recipe) {
          spinner.fail('No task specified');
          console.log(chalk.yellow('Usage:'));
          console.log(`  ${chalk.bold('codecafe run --issue "your task"')}`);
          console.log(`  ${chalk.bold('codecafe run --recipe path/to/recipe.yaml')}`);
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

        // M1: 단순 실행 (레시피 없이 직접 Claude Code 실행)
        if (!options.recipe) {
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
        } else {
          // TODO: 레시피 기반 실행 (M1에서는 미구현)
          spinner.fail('Recipe-based execution is not yet implemented');
          process.exit(1);
        }
      } catch (error) {
        spinner.fail('Execution failed');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}
