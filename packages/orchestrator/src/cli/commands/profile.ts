import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import chalk from 'chalk';
import type { StageType, StageAssignment } from '../../types.js';

interface AssignmentsConfig {
  assignments: Record<StageType, StageAssignment>;
}

export function setProfile(stage: StageType, profile: string, orchDir?: string): void {
  const configDir = path.join(orchDir || path.join(process.cwd(), '.orch'), 'config');
  const configPath = path.join(configDir, 'assignments.yml');

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const defaults: Record<StageType, StageAssignment> = {
    plan: { provider: 'claude-code', role: 'planner', profile: 'simple' },
    code: { provider: 'claude-code', role: 'coder', profile: 'simple' },
    test: { provider: 'claude-code', role: 'tester', profile: 'simple' },
    check: { provider: 'claude-code', role: 'checker', profile: 'simple' },
  };

  let config: AssignmentsConfig = { assignments: defaults };

  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      config = yaml.load(content) as AssignmentsConfig;
    } catch (error) {
      console.warn(chalk.yellow('Warning: Failed to read assignments.yml, creating new config'));
      config = { assignments: defaults };
    }
  }

  if (!config.assignments[stage]) {
    config.assignments[stage] = {
      provider: 'claude-code',
      role: stage,
      profile: 'simple',
    };
  }

  config.assignments[stage].profile = profile;

  fs.writeFileSync(configPath, yaml.dump(config), 'utf-8');
  console.log(chalk.green(`✓ Profile for stage "${stage}" set to "${profile}"`));
}

export function getProfile(stage?: StageType, orchDir?: string): void {
  const configPath = path.join(
    orchDir || path.join(process.cwd(), '.orch'),
    'config',
    'assignments.yml'
  );

  if (!fs.existsSync(configPath)) {
    console.log(chalk.yellow('No assignments.yml found. Using defaults.'));
    console.log('Defaults:');
    console.log('  plan: simple');
    console.log('  code: simple');
    console.log('  test: simple');
    console.log('  check: simple');
    return;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = yaml.load(content) as AssignmentsConfig;

    if (stage) {
      const assignment = config.assignments[stage];
      if (assignment) {
        console.log(chalk.cyan(`Profile for "${stage}": ${assignment.profile}`));
      } else {
        console.log(chalk.yellow(`No configuration found for stage "${stage}". Using default: simple`));
      }
    } else {
      console.log(chalk.cyan('Stage Profiles:'));
      const stages: StageType[] = ['plan', 'code', 'test', 'check'];
      stages.forEach((s) => {
        const assignment = config.assignments[s];
        const profile = assignment?.profile || 'simple';
        console.log(`  ${s}: ${profile}`);
      });
    }
  } catch (error) {
    console.error(chalk.red('Error reading assignments.yml:'), error);
  }
}

export function listProfiles(stage: StageType, orchDir?: string): void {
  const stageDir = path.join(
    orchDir || path.join(process.cwd(), '.orch'),
    'workflows',
    'stages'
  );

  if (!fs.existsSync(stageDir)) {
    console.log(chalk.yellow(`No stage profiles found in ${stageDir}`));
    return;
  }

  const files = fs.readdirSync(stageDir);
  const prefix = `${stage}.`;
  const suffix = '.yml';

  const profiles = files
    .filter((file) => file.startsWith(prefix) && file.endsWith(suffix))
    .map((file) => file.slice(prefix.length, -suffix.length));

  if (profiles.length === 0) {
    console.log(chalk.yellow(`No profiles found for stage "${stage}"`));
    return;
  }

  console.log(chalk.cyan(`Available profiles for "${stage}":`));
  profiles.forEach((profile) => {
    console.log(`  - ${profile}`);
  });
}
