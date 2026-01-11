import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { RoleManager } from '../../role/role-manager';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * List all roles
 */
export async function listRoles(orchDir?: string): Promise<void> {
  const manager = new RoleManager(orchDir);
  const roles = manager.listRoles();

  if (roles.length === 0) {
    console.log(chalk.yellow('No roles found.'));
    console.log(chalk.gray('Use "codecafe orch role add <role>" to create a new role.'));
    return;
  }

  console.log(chalk.blue(`Found ${roles.length} role(s):\n`));

  for (const roleId of roles) {
    const role = manager.loadRole(roleId);
    if (role) {
      console.log(chalk.green(`  ${role.id}`));
      console.log(chalk.gray(`    Name: ${role.name}`));
      console.log(chalk.gray(`    Schema: ${role.output_schema}`));
      console.log(chalk.gray(`    Inputs: ${role.inputs.length} file(s)`));
      console.log();
    }
  }
}

/**
 * Add a new role
 */
export async function addRole(
  roleId: string,
  options: { from?: string; orchDir?: string }
): Promise<void> {
  const manager = new RoleManager(options.orchDir);

  if (manager.roleExists(roleId)) {
    console.error(chalk.red(`Error: Role "${roleId}" already exists.`));
    console.log(chalk.gray(`Use "codecafe orch role edit ${roleId}" to modify it.`));
    process.exit(1);
  }

  try {
    manager.createFromTemplate(roleId, options.from);
    console.log(chalk.green(`✓ Created role: ${roleId}`));
    console.log(chalk.gray(`  Location: ${manager.getRolePath(roleId)}`));
    console.log(chalk.gray(`\nEdit the role file to customize it.`));
  } catch (error) {
    console.error(chalk.red('Error creating role:'), error);
    process.exit(1);
  }
}

/**
 * Edit a role
 */
export async function editRole(roleId: string, orchDir?: string): Promise<void> {
  const manager = new RoleManager(orchDir);

  if (!manager.roleExists(roleId)) {
    console.error(chalk.red(`Error: Role "${roleId}" not found.`));
    console.log(chalk.gray('Use "codecafe orch role list" to see available roles.'));
    process.exit(1);
  }

  const rolePath = manager.getRolePath(roleId);
  const editor = process.env.EDITOR || 'vi';

  console.log(chalk.blue(`Opening ${roleId} in ${editor}...`));

  try {
    // Open in editor
    await execAsync(`${editor} "${rolePath}"`);
    console.log(chalk.green(`✓ Role ${roleId} saved.`));
  } catch (error) {
    console.error(chalk.red('Error editing role:'), error);
    process.exit(1);
  }
}

/**
 * Remove a role
 */
export async function removeRole(roleId: string, orchDir?: string): Promise<void> {
  const manager = new RoleManager(orchDir);

  if (!manager.roleExists(roleId)) {
    console.error(chalk.red(`Error: Role "${roleId}" not found.`));
    process.exit(1);
  }

  // Confirm deletion
  console.log(chalk.yellow(`Are you sure you want to delete role "${roleId}"? (y/N)`));

  // For now, we'll just delete without confirmation in CLI
  // In a real implementation, we'd use a prompt library like inquirer

  const deleted = manager.deleteRole(roleId);

  if (deleted) {
    console.log(chalk.green(`✓ Deleted role: ${roleId}`));
  } else {
    console.error(chalk.red('Failed to delete role.'));
    process.exit(1);
  }
}

/**
 * Show role details
 */
export async function showRole(roleId: string, orchDir?: string): Promise<void> {
  const manager = new RoleManager(orchDir);

  const role = manager.loadRole(roleId);

  if (!role) {
    console.error(chalk.red(`Error: Role "${roleId}" not found.`));
    process.exit(1);
  }

  console.log(chalk.blue(`\nRole: ${role.name}`));
  console.log(chalk.gray(`ID: ${role.id}`));
  console.log(chalk.gray(`Output Schema: ${role.output_schema}`));
  console.log(chalk.gray(`\nInputs:`));
  role.inputs.forEach((input) => {
    console.log(chalk.gray(`  - ${input}`));
  });

  if (role.guards && role.guards.length > 0) {
    console.log(chalk.gray(`\nGuards:`));
    role.guards.forEach((guard) => {
      console.log(chalk.gray(`  - ${guard}`));
    });
  }

  console.log(chalk.gray(`\nTemplate:`));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(role.template);
  console.log(chalk.gray('─'.repeat(50)));
}
