#!/usr/bin/env node

import { Command } from 'commander';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { registerInitCommand } from './commands/init.js';
import { registerDoctorCommand } from './commands/doctor.js';
import { registerRunCommand } from './commands/run.js';
import { registerUiCommand } from './commands/ui.js';
import { registerStatusCommand } from './commands/status.js';
import { registerBrewCommand } from './commands/brew.js';
import { registerOrchCommand } from './commands/orch.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  // package.json에서 버전 읽기
  const packageJson = JSON.parse(
    await readFile(join(__dirname, '../package.json'), 'utf-8')
  );

  const program = new Command();

  program
    .name('codecafe')
    .description('CodeCafe - AI CLI Orchestrator')
    .version(packageJson.version);

  // 명령 등록
  registerInitCommand(program);
  registerDoctorCommand(program);
  registerRunCommand(program);
  registerBrewCommand(program);
  registerStatusCommand(program);
  registerUiCommand(program);
  registerOrchCommand(program);

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
