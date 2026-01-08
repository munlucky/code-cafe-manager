import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from '../config.js';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize CodeCafe configuration')
    .action(async () => {
      const spinner = ora('Initializing CodeCafe...').start();

      try {
        const configManager = new ConfigManager();
        await configManager.init();

        const config = await configManager.loadConfig();

        spinner.succeed('CodeCafe initialized successfully!');

        console.log(chalk.cyan('\nConfiguration:'));
        console.log(`  Config directory: ${configManager.getConfigDir()}`);
        console.log(`  Default provider: ${config.defaultProvider}`);
        console.log(`  Default menu: ${config.defaultMenu}`);
        console.log(`  Max baristas: ${config.maxBaristas}`);

        console.log(chalk.cyan('\nDefault menu sources:'));
        for (const menu of config.menuSources) {
          console.log(`  - ${menu.name} (${menu.type}): ${menu.source}`);
        }

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
