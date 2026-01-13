import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { Role } from '../types';

/**
 * Manages CRUD operations for role templates, supporting multi-path loading.
 */
export class RoleManager {
  private rolesDir: string; // User-specific roles directory
  private rolePaths: string[]; // All searchable role directories

  constructor(orchDir?: string, rolePaths?: string[]) {
    this.rolesDir = path.join(orchDir || path.join(process.cwd(), '.orch'), 'roles');

    this.rolePaths = rolePaths || [
      this.rolesDir, // User-defined roles (highest priority)
      path.join(process.cwd(), 'packages', 'roles'), // Project built-in roles
      path.join(process.cwd(), 'node_modules', '@codecafe', 'roles'), // Package roles (fallback)
    ];
  }

  /**
   * Lists all unique, available role IDs from all configured paths.
   */
  listRoles(): string[] {
    const allRoleFiles = this.rolePaths.flatMap((dir) => {
      if (!fs.existsSync(dir)) return [];
      try {
        return fs
          .readdirSync(dir)
          .filter((file) => file.endsWith('.md'))
          .map((file) => path.basename(file, '.md'));
      } catch (error) {
        console.warn(`Failed to read roles directory: ${dir}`, error);
        return [];
      }
    });
    return [...new Set(allRoleFiles)].sort();
  }

  /**
   * Loads a role by its ID, searching all paths in priority order.
   */
  loadRole(roleId: string): Role | null {
    if (!this.validateRoleId(roleId)) {
      console.error(`Invalid role ID provided: ${roleId}`);
      return null;
    }

    for (const rolesDir of this.rolePaths) {
      const rolePath = path.join(rolesDir, `${roleId}.md`);

      const resolvedPath = path.resolve(rolePath);
      const resolvedDir = path.resolve(rolesDir);
      if (!resolvedPath.startsWith(resolvedDir + path.sep) && resolvedPath !== path.join(resolvedDir, `${roleId}.md`)) {
        console.error(`Path traversal attempt detected: ${roleId}`);
        continue;
      }

      if (fs.existsSync(rolePath)) {
        try {
          return this._parseRoleFile(rolePath, roleId);
        } catch (error) {
          console.error(`Failed to load role ${roleId} from ${rolePath}:`, error);
        }
      }
    }
    return null;
  }

  /**
   * Saves a role to the user-specific roles directory.
   */
  saveRole(role: Role): void {
    if (!this.validateRoleId(role.id)) {
      throw new Error(`Invalid role ID: ${role.id}`);
    }

    if (!fs.existsSync(this.rolesDir)) {
      fs.mkdirSync(this.rolesDir, { recursive: true });
    }

    const isPhase2 = role.skills !== undefined || role.recommendedProvider !== undefined;
    const frontmatter: Record<string, any> = { id: role.id, name: role.name };

    if (isPhase2) {
      if (role.recommendedProvider) frontmatter.recommended_provider = role.recommendedProvider;
      if (role.skills) frontmatter.skills = role.skills;
      if (role.variables?.length) frontmatter.variables = role.variables;
    } else {
      frontmatter.output_schema = role.output_schema;
      frontmatter.inputs = role.inputs;
      if (role.guards?.length) frontmatter.guards = role.guards;
    }

    const fileContent = matter.stringify(role.template, frontmatter);
    const rolePath = path.join(this.rolesDir, `${role.id}.md`);
    fs.writeFileSync(rolePath, fileContent, 'utf-8');
  }

  /**
   * Deletes a role from the user-specific roles directory.
   */
  deleteRole(roleId: string): boolean {
    if (!this.validateRoleId(roleId)) {
      console.error(`Invalid role ID provided: ${roleId}`);
      return false;
    }

    const rolePath = path.join(this.rolesDir, `${roleId}.md`);
    if (!fs.existsSync(rolePath)) {
      return false;
    }

    fs.unlinkSync(rolePath);
    return true;
  }

  /**
   * Checks if a role exists in any of the configured paths.
   */
  roleExists(roleId: string): boolean {
    if (!this.validateRoleId(roleId)) return false;

    return this.rolePaths.some((dir) =>
      fs.existsSync(path.join(dir, `${roleId}.md`)),
    );
  }

  /**
   * Creates a new role from a template file or a default template.
   */
  createFromTemplate(roleId: string, templatePath?: string): void {
    if (this.roleExists(roleId)) {
      throw new Error(`Role ${roleId} already exists`);
    }

    let template: Role;
    if (templatePath && fs.existsSync(templatePath)) {
      template = this._parseRoleFile(templatePath, roleId);
      template.id = roleId; // Ensure the ID is the new role's ID
      template.name = roleId;
    } else {
      template = {
        id: roleId,
        name: roleId,
        output_schema: `schemas/${roleId}.schema.json`,
        inputs: ['.orch/context/requirements.md'],
        guards: ['Output must be valid JSON', 'Must follow schema'],
        template: `You are a specialized agent with the role: ${roleId}.\n\nRead the following files:\n{{#each inputs}}\n- {{this}}\n{{/each}}\n\nPerform your task according to your role.\n\nOutput must be valid JSON matching the schema.`,
      };
    }

    this.saveRole(template);
  }

  /**
   * Returns the path for a role in the user-specific directory.
   */
  getRolePath(roleId: string): string {
    return path.join(this.rolesDir, `${roleId}.md`);
  }

  /**
   * Validates a role ID to prevent path traversal.
   * @returns true if the role ID is valid.
   */
  private validateRoleId(roleId: string): boolean {
    return /^[a-zA-Z0-9_-]+$/.test(roleId);
  }

  /**
   * Reads a role file and parses it into a Role object.
   */
  private _parseRoleFile(filePath: string, roleId: string): Role {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const { data, content } = matter(fileContent);

    const isPhase2 = 'recommended_provider' in data || 'skills' in data;

    if (isPhase2) {
      return {
        id: data.id || roleId,
        name: data.name || roleId,
        template: content.trim(),
        skills: data.skills || [],
        recommendedProvider: data.recommended_provider,
        variables: data.variables || [],
        isDefault: true,
        source: filePath,
      };
    } else {
      return {
        id: data.id || roleId,
        name: data.name || roleId,
        output_schema: data.output_schema || '',
        inputs: data.inputs || [],
        guards: data.guards || [],
        template: content.trim(),
      };
    }
  }
}
