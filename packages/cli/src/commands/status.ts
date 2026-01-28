import { Command } from 'commander';
import chalk from 'chalk';
import { ExecutionFacade } from '@codecafe/orchestrator';
import { homedir } from 'os';
import { join } from 'path';

/**
 * Get configuration directory from environment or default
 */
function getConfigDir(): string {
  return process.env.CODECAFE_CONFIG_DIR || join(homedir(), '.codecafe');
}

/**
 * Get data directory from environment or default
 */
function getDataDir(): string {
  return process.env.CODECAFE_DATA_DIR || join(getConfigDir(), 'data');
}

/**
 * Get logs directory from environment or default
 */
function getLogsDir(): string {
  return process.env.CODECAFE_LOGS_DIR || join(getConfigDir(), 'logs');
}

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show baristas and orders status')
    .action(async () => {
      try {
        const facade = new ExecutionFacade({
          dataDir: getDataDir(),
          logsDir: getLogsDir(),
        });
        await facade.initState();

        const baristas = facade.getAllBaristas();
        const orders = facade.getAllOrders();

        console.log(chalk.cyan.bold('\n📋 CodeCafe Status\n'));

        // Baristas
        console.log(chalk.yellow('Baristas:'));
        if (baristas.length === 0) {
          console.log(chalk.gray('  No baristas created yet'));
        } else {
          for (const barista of baristas) {
            const statusColor =
              barista.status === 'IDLE'
                ? chalk.green
                : barista.status === 'RUNNING'
                ? chalk.blue
                : chalk.red;
            console.log(
              `  ${statusColor('●')} ${barista.id} - ${barista.status} (${barista.provider})`
            );
            if (barista.currentOrderId) {
              console.log(chalk.gray(`    → Order: ${barista.currentOrderId}`));
            }
          }
        }

        console.log();

        // Orders
        console.log(chalk.yellow('Orders:'));
        if (orders.length === 0) {
          console.log(chalk.gray('  No orders yet'));
        } else {
          const pending = orders.filter((o) => o.status === 'PENDING');
          const running = orders.filter((o) => o.status === 'RUNNING');
          const completed = orders.filter((o) => o.status === 'COMPLETED');
          const failed = orders.filter((o) => o.status === 'FAILED');

          console.log(chalk.gray(`  Pending: ${pending.length}`));
          console.log(chalk.blue(`  Running: ${running.length}`));
          console.log(chalk.green(`  Completed: ${completed.length}`));
          console.log(chalk.red(`  Failed: ${failed.length}`));

          console.log();
          console.log(chalk.yellow('Recent orders:'));
          const recent = orders.slice(-5).reverse();
          for (const order of recent) {
            const statusColor =
              order.status === 'COMPLETED'
                ? chalk.green
                : order.status === 'FAILED'
                ? chalk.red
                : order.status === 'RUNNING'
                ? chalk.blue
                : chalk.gray;
            console.log(`  ${statusColor(order.status)} ${order.id} - ${order.workflowName}`);
          }
        }

        console.log();
      } catch (error) {
        console.error(chalk.red('Failed to get status'));
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}
