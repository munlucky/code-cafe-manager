import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from '../config.js';
import { resolve } from 'path';
import { RecipeManager } from '@codecafe/core';
import { BaristaManager } from '@codecafe/core';
import { WorktreeManager } from '@codecafe/git-worktree';
import { executeRecipe, ExecutionContext } from '@codecafe/core';
import { Order, OrderStatus } from '@codecafe/core';
import { ClaudeCodeProvider } from '@codecafe/provider-claude-code';

/**
 * Simple provider factory for CLI
 */
class SimpleProviderFactory {
  create(type: string, config?: any): any {
    switch (type) {
      case 'claude-code':
        return new ClaudeCodeProvider();
      case 'codex':
        // TODO: Add Codex provider
        throw new Error('Codex provider not yet implemented');
      default:
        throw new Error(`Unknown provider: ${type}`);
    }
  }
}

export function registerBrewCommand(program: Command): void {
  program
    .command('brew')
    .description('Brew a recipe (execute recipe with full orchestration)')
    .option('--recipe <path>', 'Recipe file path (YAML)', 'recipes/house-blend/pm-agent.yaml')
    .option('--counter <path>', 'Project directory (overrides recipe input)', '.')
    .option('--max-baristas <number>', 'Maximum number of baristas', '4')
    .action(async (options) => {
      const spinner = ora('Starting CodeCafe Brew...').start();

      try {
        const configManager = new ConfigManager();
        const config = await configManager.loadConfig();

        // Resolve paths
        const recipePath = resolve(options.recipe);
        const counter = resolve(options.counter);
        const maxBaristas = parseInt(options.maxBaristas, 10);

        spinner.text = 'Loading recipe...';

        // Load recipe
        const recipeManager = new RecipeManager();
        const recipe = await recipeManager.loadRecipe(recipePath);

        spinner.text = 'Validating environment...';

        // Validate provider
        const provider = recipe.defaults.provider;
        if (provider === 'claude-code') {
          const result = await ClaudeCodeProvider.validateEnv();
          if (!result.valid) {
            spinner.fail(result.message || 'Provider validation failed');
            process.exit(1);
          }
        }

        spinner.text = 'Creating barista manager...';

        // Create barista manager
        const baristaManager = new BaristaManager(maxBaristas);

        // Create initial baristas
        for (let i = 0; i < Math.min(2, maxBaristas); i++) {
          baristaManager.createBarista(provider);
        }

        spinner.text = 'Creating order...';

        // Create order
        const order: Order = {
          id: `order-${Date.now()}`,
          recipeId: recipe.name,
          recipeName: recipe.name,
          baristaId: null,
          status: OrderStatus.PENDING,
          counter: counter,
          provider: provider,
          vars: {},
          createdAt: new Date(),
          startedAt: null,
          endedAt: null,
        };

        // Handle worktree mode
        if (recipe.defaults.workspace.mode === 'worktree') {
          spinner.text = 'Creating worktree...';

          const worktreeInfo = await WorktreeManager.createWorktree({
            repoPath: counter,
            baseBranch: recipe.defaults.workspace.baseBranch || 'main',
            newBranch: order.id,
          });

          order.counter = worktreeInfo.path;
          order.worktreeInfo = {
            path: worktreeInfo.path,
            branch: worktreeInfo.branch!,
            baseBranch: recipe.defaults.workspace.baseBranch || 'main',
          };

          spinner.succeed('Worktree created');
          console.log(chalk.cyan(`  Path: ${worktreeInfo.path}`));
          console.log(chalk.cyan(`  Branch: ${worktreeInfo.branch}`));
        }

        spinner.succeed('Order created');
        console.log(chalk.cyan(`Order ID: ${order.id}`));
        console.log(chalk.cyan(`Recipe: ${recipe.name}`));
        console.log(chalk.cyan(`Counter: ${order.counter}`));
        console.log(chalk.cyan(`Provider: ${provider}\n`));

        spinner.start('Executing recipe...');

        // Update order status
        order.status = OrderStatus.RUNNING;
        order.startedAt = new Date();

        // Create execution context
        const context: ExecutionContext = {
          order,
          recipe,
          baristaManager,
          providerFactory: new SimpleProviderFactory(),
          stepOutputs: new Map(),
        };

        // Execute recipe
        const result = await executeRecipe(context);

        // Update order
        order.status = result.status === 'completed' ? OrderStatus.COMPLETED : OrderStatus.FAILED;
        order.endedAt = result.endedAt;
        order.error = result.error;

        if (result.status === 'completed') {
          spinner.succeed('Recipe execution completed');

          // Export patch if worktree mode
          if (order.worktreeInfo && recipe.defaults.workspace.mode === 'worktree') {
            spinner.start('Exporting patch...');

            const patchPath = await WorktreeManager.exportPatch({
              worktreePath: order.worktreeInfo.path,
              baseBranch: order.worktreeInfo.baseBranch,
            });

            spinner.succeed('Patch exported');
            console.log(chalk.cyan(`  Patch: ${patchPath}`));

            // Clean up worktree if configured
            if (recipe.defaults.workspace.clean) {
              spinner.start('Cleaning up worktree...');

              try {
                await WorktreeManager.removeWorktree({
                  worktreePath: order.worktreeInfo.path,
                  force: false,
                });
                spinner.succeed('Worktree removed');
              } catch (err) {
                spinner.warn(`Worktree cleanup skipped: ${(err as Error).message}`);
              }
            }
          }

          console.log(chalk.green('\n✓ Brew completed successfully'));
          console.log(chalk.gray(`  Steps executed: ${result.steps.length}`));
          console.log(chalk.gray(`  Duration: ${result.endedAt.getTime() - result.startedAt.getTime()}ms`));
        } else {
          spinner.fail('Recipe execution failed');
          console.log(chalk.red(`\n✗ Error: ${result.error}`));

          // Show failed steps
          const failedSteps = result.steps.filter((s: any) => s.status === 'failed');
          if (failedSteps.length > 0) {
            console.log(chalk.yellow('\nFailed steps:'));
            for (const step of failedSteps) {
              console.log(chalk.red(`  - ${step.stepId}: ${step.error}`));
            }
          }

          process.exit(1);
        }
      } catch (error) {
        spinner.fail('Brew failed');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}
