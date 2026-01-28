import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { homedir } from 'os';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';

/**
 * Get configuration directory from environment or default
 */
function getConfigDir(): string {
  return process.env.CODECAFE_CONFIG_DIR || join(homedir(), '.codecafe');
}

/**
 * Get default provider from environment or default
 */
function getDefaultProvider(): string {
  return process.env.CODECAFE_DEFAULT_PROVIDER || 'claude-code';
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize CodeCafe configuration')
    .action(async () => {
      const spinner = ora('Initializing CodeCafe...').start();

      try {
        const configDir = getConfigDir();

        // Create directories
        if (!existsSync(configDir)) {
          await mkdir(configDir, { recursive: true });
        }

        const dataDir = join(configDir, 'data');
        if (!existsSync(dataDir)) {
          await mkdir(dataDir, { recursive: true });
        }

        const logsDir = join(configDir, 'logs');
        if (!existsSync(logsDir)) {
          await mkdir(logsDir, { recursive: true });
        }

        spinner.succeed('CodeCafe initialized successfully!');

        console.log(chalk.cyan('\nConfiguration:'));
        console.log(`  Config directory: ${configDir}`);
        console.log(`  Default provider: ${getDefaultProvider()}`);
        console.log(`  Data directory: ${dataDir}`);
        console.log(`  Logs directory: ${logsDir}`);

        console.log(chalk.green('\nNext steps:'));
        console.log(`  1. Run ${chalk.bold('codecafe doctor')} to check your environment`);
        console.log(`  2. Run ${chalk.bold('codecafe run --issue "your task"')} to execute a task`);
        console.log(`  3. Run ${chalk.bold('codecafe ui')} to launch the desktop app`);
      } catch (error) {
        spinner.fail('Failed to initialize CodeCafe');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}
