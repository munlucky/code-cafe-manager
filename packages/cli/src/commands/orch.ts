import { Command } from 'commander';
import chalk from 'chalk';
import {
  initOrchestrator,
  listRoles,
  addRole,
  editRole,
  removeRole,
  showRole,
  runWorkflow,
  resumeRun,
  showRunStatus,
  showRunLogs,
} from '@codecafe/orchestrator';

/**
 * Register orchestrator commands
 */
export function registerOrchCommand(program: Command) {
  const orch = program
    .command('orch')
    .description('Orchestrator commands (FSM + DAG workflow execution)');

  // orch init
  orch
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

  // orch run
  orch
    .command('run [workflow]')
    .description('Run a workflow')
    .option('-i, --interactive', 'Interactive mode with TUI')
    .option('--mode <mode>', 'Execution mode: assisted|headless', 'assisted')
    .action(async (workflow = 'default', options) => {
      try {
        const runState = await runWorkflow(workflow, { mode: options.mode });
        console.log(chalk.green(`? Run completed: ${runState.runId}`));
      } catch (error) {
        console.error(chalk.red('Run failed:'), error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // orch resume
  orch
    .command('resume <runId>')
    .description('Resume a paused run')
    .action(async (runId) => {
      try {
        const runState = await resumeRun(runId);
        console.log(chalk.green(`? Run resumed: ${runState.runId}`));
      } catch (error) {
        console.error(chalk.red('Resume failed:'), error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // orch status
  orch
    .command('status [runId]')
    .description('Show status of a run (shows all if runId not specified)')
    .action(async (runId) => {
      try {
        await showRunStatus(runId);
      } catch (error) {
        console.error(chalk.red('Status failed:'), error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  // orch logs
  orch
    .command('logs <runId>')
    .description('Show logs of a run')
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

  // orch role
  orch
    .command('role <action> [role]')
    .description('Manage roles (add|edit|rm|list|show)')
    .option('--from <template>', 'Template file to create role from')
    .action(async (action, role, options) => {
      try {
        switch (action) {
          case 'list':
            await listRoles();
            break;
          case 'add':
            if (!role) {
              console.error(chalk.red('Error: Role ID required'));
              console.log(chalk.gray('Usage: codecafe orch role add <roleId>'));
              process.exit(1);
            }
            await addRole(role, { from: options.from });
            break;
          case 'edit':
            if (!role) {
              console.error(chalk.red('Error: Role ID required'));
              console.log(chalk.gray('Usage: codecafe orch role edit <roleId>'));
              process.exit(1);
            }
            await editRole(role);
            break;
          case 'rm':
          case 'remove':
            if (!role) {
              console.error(chalk.red('Error: Role ID required'));
              console.log(chalk.gray('Usage: codecafe orch role rm <roleId>'));
              process.exit(1);
            }
            await removeRole(role);
            break;
          case 'show':
            if (!role) {
              console.error(chalk.red('Error: Role ID required'));
              console.log(chalk.gray('Usage: codecafe orch role show <roleId>'));
              process.exit(1);
            }
            await showRole(role);
            break;
          default:
            console.error(chalk.red(`Unknown action: ${action}`));
            console.log(chalk.gray('Available actions: list, add, edit, rm, show'));
            process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red('Error:'), error);
        process.exit(1);
      }
    });

  // orch profile
  orch
    .command('profile <action> [setting]')
    .description('Manage stage profiles (set|list)')
    .action(async (action, setting) => {
      console.log(chalk.yellow('🚧 Profile command not yet implemented'));
      console.log(chalk.gray(`  Action: ${action}`));
      if (setting) {
        console.log(chalk.gray(`  Setting: ${setting}`));
      }
    });

  // orch assign
  orch
    .command('assign <action> [setting]')
    .description('Manage provider/role assignments (set|show)')
    .action(async (action, setting) => {
      console.log(chalk.yellow('🚧 Assign command not yet implemented'));
      console.log(chalk.gray(`  Action: ${action}`));
      if (setting) {
        console.log(chalk.gray(`  Setting: ${setting}`));
      }
    });
}
