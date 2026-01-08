import { Command } from 'commander';
import chalk from 'chalk';
import { spawn } from 'child_process';

export function registerUiCommand(program: Command): void {
  program
    .command('ui')
    .description('Launch CodeCafe Manager (Electron UI)')
    .action(() => {
      console.log(chalk.cyan('Launching CodeCafe Manager...'));

      // TODO: Electron 앱 실행 경로 확인 필요
      // M1에서는 기본 안내 메시지만 표시
      console.log(chalk.yellow('Electron UI is not yet implemented in M1'));
      console.log(chalk.yellow('Coming soon in the next version!'));

      // 추후 구현:
      // const electronPath = join(__dirname, '../../desktop/dist/main/index.js');
      // spawn('electron', [electronPath], { stdio: 'inherit' });
    });
}
