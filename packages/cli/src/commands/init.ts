import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { CONFIG, ensureAllDirs } from '../config.js';
import { handleError } from '../utils/error-handler.js';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize CodeCafe configuration')
    .action(async () => {
      const spinner = ora('Initializing CodeCafe...').start();

      try {
        await ensureAllDirs();

        spinner.succeed('CodeCafe initialized successfully!');

        console.log(chalk.cyan('\nConfiguration:'));
        console.log(`  Config directory: ${CONFIG.dir}`);
        console.log(`  Default provider: ${CONFIG.defaultProvider}`);
        console.log(`  Data directory: ${CONFIG.dataDir}`);
        console.log(`  Logs directory: ${CONFIG.logsDir}`);

        console.log(chalk.green('\nNext steps:'));
        console.log(`  1. Run ${chalk.bold('codecafe doctor')} to check your environment`);
        console.log(`  2. Run ${chalk.bold('codecafe run --issue "your task"')} to execute a task`);
        console.log(`  3. Run ${chalk.bold('codecafe ui')} to launch the desktop app`);
      } catch (error) {
        handleError(error, { command: 'init', operation: 'Initialization' }, spinner);
        process.exit(1);
      }
    });
}
