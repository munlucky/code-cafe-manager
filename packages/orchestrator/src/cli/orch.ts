#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { initOrchestrator } from './commands/init.js';
import { runWorkflow } from './commands/run.js';
import { resumeRun } from './commands/resume.js';
import { showRunStatus } from './commands/status.js';
import { showRunLogs } from './commands/logs.js';

const program = new Command();

program
  .name('codecafe-orch')
  .description('CodeCafe Orchestrator - Multi AI CLI orchestration')
  .version('0.1.0');

/**
 * Init command
 */
program
  .command('init')
  .description('Initialize .orch directory structure with default templates')
  .option('-f, --force', 'Force overwrite existing files')
  .action(async (options) => {
    try {
      await initOrchestrator(process.cwd());
    } catch (error) {
      console.error(chalk.red('Error initializing orchestrator:'), error);
      process.exit(1);
    }
  });

/**
 * Run command (placeholder)
 */
program
  .command('run')
  .description('Run a workflow')
  .argument('[workflow]', 'Workflow ID to run', 'default')
  .option('-i, --interactive', 'Interactive mode with TUI')
  .option('--mode <mode>', 'Execution mode: assisted|headless', 'assisted')
  .action(async (workflow, options) => {
    try {
      const runState = await runWorkflow(workflow, { mode: options.mode });
      console.log(chalk.green(`? Run completed: ${runState.runId}`));
    } catch (error) {
      console.error(chalk.red('Run failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Resume command (placeholder)
 */
program
  .command('resume')
  .description('Resume a paused run')
  .argument('<runId>', 'Run ID to resume')
  .action(async (runId) => {
    try {
      const runState = await resumeRun(runId);
      console.log(chalk.green(`? Run resumed: ${runState.runId}`));
    } catch (error) {
      console.error(chalk.red('Resume failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Status command (placeholder)
 */
program
  .command('status')
  .description('Show status of a run')
  .argument('[runId]', 'Run ID (shows all if not specified)')
  .action(async (runId) => {
    try {
      await showRunStatus(runId);
    } catch (error) {
      console.error(chalk.red('Status failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Logs command (placeholder)
 */
program
  .command('logs')
  .description('Show logs of a run')
  .argument('<runId>', 'Run ID')
  .option('-f, --follow', 'Follow log output')
  .option('--filter <type>', 'Filter by event type')
  .action(async (runId, options) => {
    try {
      await showRunLogs(runId, { follow: options.follow, filter: options.filter });
    } catch (error) {
      console.error(chalk.red('Logs failed:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Role command (placeholder)
 */
program
  .command('role')
  .description('Manage roles')
  .argument('<action>', 'Action: add|edit|rm|list')
  .argument('[role]', 'Role ID')
  .action(async (action, role) => {
    console.log(chalk.yellow('🚧 Role command not yet implemented'));
    console.log(chalk.gray(`  Action: ${action}`));
    if (role) {
      console.log(chalk.gray(`  Role: ${role}`));
    }
  });

/**
 * Profile command (placeholder)
 */
program
  .command('profile')
  .description('Manage stage profiles')
  .argument('<action>', 'Action: set|list')
  .argument('[setting]', 'Setting (e.g., plan=committee)')
  .action(async (action, setting) => {
    console.log(chalk.yellow('🚧 Profile command not yet implemented'));
    console.log(chalk.gray(`  Action: ${action}`));
    if (setting) {
      console.log(chalk.gray(`  Setting: ${setting}`));
    }
  });

/**
 * Assign command (placeholder)
 */
program
  .command('assign')
  .description('Manage provider/role assignments')
  .argument('<action>', 'Action: set|show')
  .argument('[setting]', 'Setting (e.g., code=codex:coder)')
  .action(async (action, setting) => {
    console.log(chalk.yellow('🚧 Assign command not yet implemented'));
    console.log(chalk.gray(`  Action: ${action}`));
    if (setting) {
      console.log(chalk.gray(`  Setting: ${setting}`));
    }
  });

// Parse arguments
program.parse();
