import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

/**
 * Initialize .orch directory structure with default templates
 */
export async function initOrchestrator(cwd: string = process.cwd()): Promise<void> {
  console.log(chalk.blue('Initializing orchestrator structure...'));

  const orchDir = path.join(cwd, '.orch');

  // Check if .orch already exists
  if (fs.existsSync(orchDir)) {
    console.log(chalk.yellow('⚠ .orch directory already exists'));
    const proceed = await confirmOverwrite();
    if (!proceed) {
      console.log(chalk.gray('Initialization cancelled'));
      return;
    }
  }

  // Create directory structure
  const dirs = [
    'context',
    'roles',
    'schemas',
    'workflows/stages',
    'config',
    'runs',
  ];

  for (const dir of dirs) {
    const fullPath = path.join(orchDir, dir);
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(chalk.green(`✓ Created ${dir}/`));
  }

  // Copy template files
  await copyTemplates(cwd, orchDir);

  console.log(chalk.green('\n✓ Orchestrator initialized successfully!'));
  console.log(chalk.gray('\nNext steps:'));
  console.log(chalk.gray('  1. Review default workflow: .orch/workflows/default.workflow.yml'));
  console.log(chalk.gray('  2. Customize roles: .orch/roles/'));
  console.log(chalk.gray('  3. Run workflow: codecafe orch run'));
}

/**
 * Copy template files from package to .orch directory
 */
async function copyTemplates(cwd: string, orchDir: string): Promise<void> {
  const templatesDir = path.join(__dirname, '../../../templates');

  // Copy context files
  copyFile(
    path.join(templatesDir, 'context/requirements.md'),
    path.join(orchDir, 'context/requirements.md')
  );
  copyFile(
    path.join(templatesDir, 'context/constraints.md'),
    path.join(orchDir, 'context/constraints.md')
  );
  copyFile(
    path.join(templatesDir, 'context/decisions.md'),
    path.join(orchDir, 'context/decisions.md')
  );

  // Copy role files
  const roles = ['planner', 'planner-synthesizer', 'coder', 'reviewer', 'tester', 'checker'];
  for (const role of roles) {
    copyFile(
      path.join(templatesDir, `roles/${role}.md`),
      path.join(orchDir, `roles/${role}.md`)
    );
  }

  // Copy schema files
  const schemas = ['plan', 'code', 'test', 'check'];
  for (const schema of schemas) {
    copyFile(
      path.join(templatesDir, `schemas/${schema}.schema.json`),
      path.join(orchDir, `schemas/${schema}.schema.json`)
    );
  }

  // Copy workflow files
  copyFile(
    path.join(templatesDir, 'workflows/default.workflow.yml'),
    path.join(orchDir, 'workflows/default.workflow.yml')
  );

  const stageProfiles = [
    'plan.simple',
    'plan.committee',
    'code.simple',
    'code.review-loop',
    'test.smoke',
    'test.deep',
    'check.gate',
  ];
  for (const profile of stageProfiles) {
    copyFile(
      path.join(templatesDir, `workflows/stages/${profile}.yml`),
      path.join(orchDir, `workflows/stages/${profile}.yml`)
    );
  }

  // Copy config files
  copyFile(
    path.join(templatesDir, 'config/assignments.yml'),
    path.join(orchDir, 'config/assignments.yml')
  );
  copyFile(
    path.join(templatesDir, 'config/providers.yml'),
    path.join(orchDir, 'config/providers.yml')
  );

  console.log(chalk.green('✓ Copied template files'));
}

/**
 * Copy a single file
 */
function copyFile(src: string, dest: string): void {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  } else {
    // Create placeholder if template doesn't exist
    const filename = path.basename(dest);
    fs.writeFileSync(dest, `# ${filename}\n\nTODO: Add content\n`);
  }
}

/**
 * Confirm overwrite (simple version for now)
 */
async function confirmOverwrite(): Promise<boolean> {
  // For now, just return false
  // In future, implement proper CLI prompt with inquirer
  return false;
}
