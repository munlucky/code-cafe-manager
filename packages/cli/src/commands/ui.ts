import { Command } from 'commander';
import chalk from 'chalk';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export function registerUiCommand(program: Command): void {
  program
    .command('ui')
    .description('Launch CodeCafe Manager (Electron UI)')
    .action(() => {
      console.log(chalk.cyan('Launching CodeCafe Manager...'));

      // Desktop 패키지 빌드된 경로 확인
      const desktopMainPath = path.join(
        __dirname,
        '../../desktop/dist/main/index.js'
      );

      if (!fs.existsSync(desktopMainPath)) {
        console.error(chalk.red('Electron app not built!'));
        console.error(chalk.yellow('Run: pnpm --filter desktop build'));
        process.exit(1);
      }

      // Electron 실행
      const electronProcess = spawn(
        'electron',
        [desktopMainPath],
        { stdio: 'inherit' }
      );

      electronProcess.on('error', (err) => {
        console.error(chalk.red('Failed to launch Electron:'), err);
        process.exit(1);
      });
    });
}
