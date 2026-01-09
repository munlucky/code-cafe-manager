import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from '../config.js';
import { ClaudeCodeProvider } from '@codecafe/provider-claude-code';
import { resolve } from 'path';
import { RecipeManager } from '@codecafe/core';
import { executeRecipe, type ExecutionContext } from '@codecafe/core';
import { BaristaManager } from '@codecafe/core';
import { OrderManager } from '@codecafe/core';

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
          // 레시피 기반 실행
          const recipeManager = new RecipeManager();
          const recipe = await recipeManager.loadRecipe(resolve(options.recipe));

          spinner.text = `Loading recipe: ${recipe.name} v${recipe.version}`;

          // Create managers
          const baristaManager = new BaristaManager(4);
          const orderManager = new OrderManager();

          // Create order
          const order = orderManager.createOrder(
            recipe.name,
            recipe.name,
            counter,
            provider as any,
            { userMessage: issue || '' }
          );

          // Create provider factory
          const providerFactory = {
            create: (type: string, config?: any) => {
              if (type === 'claude-code') {
                return new ClaudeCodeProvider();
              }
              throw new Error(`Unknown provider: ${type}`);
            },
          };

          // Create execution context
          const ctx: ExecutionContext = {
            order,
            recipe,
            baristaManager,
            providerFactory,
            stepOutputs: new Map(),
          };

          spinner.succeed('Recipe loaded');
          console.log(chalk.cyan(`Recipe: ${recipe.name} v${recipe.version}`));
          console.log(chalk.cyan(`Counter: ${counter}`));
          console.log(chalk.cyan(`Provider: ${provider}\n`));

          // Execute recipe
          const executionSpinner = ora('Executing recipe...').start();

          try {
            const result = await executeRecipe(ctx);

            if (result.status === 'completed') {
              executionSpinner.succeed('Recipe execution completed');
              console.log(chalk.green('\n✓ All steps completed successfully'));

              // Print step results
              console.log(chalk.cyan('\nStep Results:'));
              for (const stepResult of result.steps) {
                const statusIcon = stepResult.status === 'success' ? '✓' : '✗';
                const statusColor = stepResult.status === 'success' ? chalk.green : chalk.red;
                console.log(statusColor(`  ${statusIcon} ${stepResult.stepId}`));
                if (stepResult.output) {
                  console.log(chalk.gray(`    ${stepResult.output.slice(0, 200)}...`));
                }
              }
            } else {
              executionSpinner.fail('Recipe execution failed');
              console.log(chalk.red(`\n✗ Execution failed: ${result.error}`));
              process.exit(1);
            }
          } catch (error) {
            executionSpinner.fail('Recipe execution error');
            console.error(chalk.red(error instanceof Error ? error.message : String(error)));
            process.exit(1);
          }
        }
      } catch (error) {
        spinner.fail('Execution failed');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}
