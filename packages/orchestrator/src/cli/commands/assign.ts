import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import chalk from 'chalk';
import type { StageType, StageAssignment, ProviderType } from '../../types.js';

interface AssignmentsConfig {
  assignments: Record<StageType, StageAssignment>;
}

export function setAssignment(
  stage: StageType,
  provider: ProviderType,
  role: string,
  orchDir?: string
): void {
  const configDir = path.join(orchDir || path.join(process.cwd(), '.orch'), 'config');
  const configPath = path.join(configDir, 'assignments.yml');

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const defaults: Record<StageType, StageAssignment> = {
    analyze: { provider: 'claude-code', role: 'planner', profile: 'simple' },
    plan: { provider: 'claude-code', role: 'planner', profile: 'simple' },
    code: { provider: 'claude-code', role: 'coder', profile: 'simple' },
    review: { provider: 'claude-code', role: 'checker', profile: 'simple' },
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

  config.assignments[stage].provider = provider;
  config.assignments[stage].role = role;

  fs.writeFileSync(configPath, yaml.dump(config), 'utf-8');
  console.log(chalk.green(`✓ Assignment for stage "${stage}" set to "${provider}:${role}"`));
}

export function getAssignment(stage?: StageType, orchDir?: string): void {
  const configPath = path.join(
    orchDir || path.join(process.cwd(), '.orch'),
    'config',
    'assignments.yml'
  );

  const defaults: Record<StageType, StageAssignment> = {
    analyze: { provider: 'claude-code', role: 'planner', profile: 'simple' },
    plan: { provider: 'claude-code', role: 'planner', profile: 'simple' },
    code: { provider: 'claude-code', role: 'coder', profile: 'simple' },
    review: { provider: 'claude-code', role: 'checker', profile: 'simple' },
    test: { provider: 'claude-code', role: 'tester', profile: 'simple' },
    check: { provider: 'claude-code', role: 'checker', profile: 'simple' },
  };

  let config: AssignmentsConfig = { assignments: defaults };

  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const loaded = yaml.load(content) as AssignmentsConfig;
      config.assignments = { ...defaults, ...loaded.assignments };
    } catch (error) {
      console.warn(chalk.yellow('Warning: Failed to read assignments.yml, using defaults'));
    }
  }

  if (stage) {
    const assignment = config.assignments[stage];
    console.log(chalk.cyan(`Assignment for "${stage}":`));
    console.log(`  Provider: ${assignment.provider}`);
    console.log(`  Role: ${assignment.role}`);
    console.log(`  Profile: ${assignment.profile}`);
  } else {
    console.log(chalk.cyan('Stage Assignments:'));
    const stages: StageType[] = ['plan', 'code', 'test', 'check'];
    stages.forEach((s) => {
      const assignment = config.assignments[s];
      console.log(`  ${s}: ${assignment.provider}:${assignment.role} (${assignment.profile})`);
    });
  }
}

export function listRoles(orchDir?: string): void {
  const rolesDir = path.join(orchDir || path.join(process.cwd(), '.orch'), 'roles');

  if (!fs.existsSync(rolesDir)) {
    console.log(chalk.yellow(`No roles directory found at ${rolesDir}`));
    return;
  }

  const files = fs.readdirSync(rolesDir);
  const roleFiles = files.filter((file) => file.endsWith('.md'));

  if (roleFiles.length === 0) {
    console.log(chalk.yellow('No roles found'));
    return;
  }

  console.log(chalk.cyan('Available roles:'));
  roleFiles.forEach((file) => {
    const roleId = file.slice(0, -3); // Remove .md extension
    console.log(`  - ${roleId}`);
  });
}
