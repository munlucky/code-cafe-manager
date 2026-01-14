import chalk from 'chalk';
import { RoleManager } from '../../role/role-manager';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { Role } from '../../types';

const execAsync = promisify(exec);

/**
 * Helper to ensure a role exists, exiting if it does not.
 */
function ensureRoleExists(manager: RoleManager, roleId: string): void {
  if (!manager.roleExists(roleId)) {
    console.error(chalk.red(`Error: Role "${roleId}" not found.`));
    console.log(chalk.gray('Use "codecafe orch role list" to see available roles.'));
    process.exit(1);
  }
}

/**
 * Helper to ensure a role does not already exist, exiting if it does.
 */
function ensureRoleDoesNotExist(manager: RoleManager, roleId: string): void {
  if (manager.roleExists(roleId)) {
    console.error(chalk.red(`Error: Role "${roleId}" already exists.`));
    console.log(chalk.gray(`Use "codecafe orch role edit ${roleId}" to modify it.`));
    process.exit(1);
  }
}

/**
 * Helper to load a role, exiting if it is not found or invalid.
 */
function loadRoleOrExit(manager: RoleManager, roleId: string): Role {
  const role = manager.loadRole(roleId);
  if (!role) {
    console.error(chalk.red(`Error: Role "${roleId}" not found or is invalid.`));
    console.log(chalk.gray('Use "codecafe orch role list" to see available roles.'));
    process.exit(1);
  }
  return role;
}

/**
 * Prints a compact summary of a role.
 */
function printRoleSummary(role: Role): void {
  console.log(chalk.green(`  ${role.id}`));
  console.log(chalk.gray(`    Name: ${role.name}`));
  if (role.skills) {
    // Phase 2 format
    console.log(chalk.gray(`    Provider: ${role.recommendedProvider || 'N/A'}`));
    console.log(chalk.gray(`    Skills: ${role.skills.length} skill(s)`));
  } else {
    // Phase 1 format
    console.log(chalk.gray(`    Schema: ${role.output_schema}`));
    console.log(chalk.gray(`    Inputs: ${role.inputs?.length || 0} file(s)`));
  }
  console.log();
}

/**
 * Lists all available roles.
 */
export async function listRoles(orchDir?: string): Promise<void> {
  const manager = new RoleManager(orchDir);
  const roleIds = manager.listRoles();

  if (roleIds.length === 0) {
    console.log(chalk.yellow('No roles found.'));
    console.log(chalk.gray('Use "codecafe orch role add <role>" to create one.'));
    return;
  }

  console.log(chalk.blue(`Found ${roleIds.length} role(s):\n`));
  roleIds
    .map((roleId) => manager.loadRole(roleId))
    .filter((role): role is Role => !!role)
    .forEach(printRoleSummary);
}

/**
 * Adds a new role from a template.
 */
export async function addRole(
  roleId: string,
  options: { from?: string; orchDir?: string },
): Promise<void> {
  const manager = new RoleManager(options.orchDir);
  ensureRoleDoesNotExist(manager, roleId);

  try {
    manager.createFromTemplate(roleId, options.from);
    console.log(chalk.green(`✓ Created role: ${roleId}`));
    console.log(chalk.gray(`  Location: ${manager.getRolePath(roleId)}`));
    console.log(chalk.gray('\nEdit the new role file to customize it.'));
  } catch (error) {
    console.error(chalk.red('Error creating role:'), error);
    process.exit(1);
  }
}

/**
 * Opens a role's file in the default editor.
 */
export async function editRole(roleId: string, orchDir?: string): Promise<void> {
  const manager = new RoleManager(orchDir);
  ensureRoleExists(manager, roleId);

  const rolePath = manager.getRolePath(roleId);
  const editor = process.env.EDITOR || 'vi';

  console.log(chalk.blue(`Opening ${roleId} in ${editor}...`));

  try {
    await execAsync(`${editor} "${rolePath}"`);
    console.log(chalk.green(`✓ Role ${roleId} saved.`));
  } catch (error) {
    console.error(chalk.red('Error editing role:'), error);
    process.exit(1);
  }
}

/**
 * Removes a role.
 */
export async function removeRole(roleId: string, orchDir?: string): Promise<void> {
  const manager = new RoleManager(orchDir);
  ensureRoleExists(manager, roleId);

  // TODO: Add interactive confirmation
  console.log(chalk.yellow(`Deleting role "${roleId}"...`));

  if (manager.deleteRole(roleId)) {
    console.log(chalk.green(`✓ Deleted role: ${roleId}`));
  } else {
    console.error(chalk.red(`Failed to delete role "${roleId}".`));
    console.error(chalk.gray('It may be a system role, or there was a file access error.'));
    process.exit(1);
  }
}

/**
 * Prints detailed information for a Phase 1 role.
 */
function printPhase1RoleDetails(role: Role): void {
  console.log(chalk.gray(`Output Schema: ${role.output_schema}`));
  console.log(chalk.gray('\nInputs:'));
  role.inputs?.forEach((input) => console.log(chalk.gray(`  - ${input}`)));

  if (role.guards?.length) {
    console.log(chalk.gray('\nGuards:'));
    role.guards.forEach((guard) => console.log(chalk.gray(`  - ${guard}`)));
  }
}

/**
 * Prints detailed information for a Phase 2 role.
 */
function printPhase2RoleDetails(role: Role): void {
  console.log(chalk.gray(`Recommended Provider: ${role.recommendedProvider || 'N/A'}`));
  console.log(chalk.gray('\nSkills:'));
  role.skills?.forEach((skill) => console.log(chalk.gray(`  - ${skill}`)));

  if (role.variables?.length) {
    console.log(chalk.gray('\nVariables:'));
    role.variables.forEach((v) => {
      const req = v.required ? 'required' : 'optional';
      console.log(chalk.gray(`  - ${v.name} (${v.type}, ${req})`));
    });
  }
}

/**
 * Shows detailed information about a role.
 */
export async function showRole(roleId: string, orchDir?: string): Promise<void> {
  const manager = new RoleManager(orchDir);
  const role = loadRoleOrExit(manager, roleId);

  console.log(chalk.blue(`\nRole: ${role.name}`));
  console.log(chalk.gray(`ID: ${role.id}`));

  if (role.skills) {
    printPhase2RoleDetails(role);
  } else {
    printPhase1RoleDetails(role);
  }

  console.log(chalk.gray('\nTemplate:'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(role.template);
  console.log(chalk.gray('─'.repeat(50)));
}
