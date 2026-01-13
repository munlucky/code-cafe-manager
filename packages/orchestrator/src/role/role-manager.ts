import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { Role } from '../types';

/**
 * Role Manager - CRUD operations for role templates
 * Supports multi-path role loading with priority: .orch/roles > packages/roles > node_modules
 */
export class RoleManager {
  private rolesDir: string; // Kept for backward compatibility (for saveRole, deleteRole)
  private rolePaths: string[]; // Multi-path support

  constructor(orchDir?: string, rolePaths?: string[]) {
    // Backward compatibility: orchDir defaults to .orch
    this.rolesDir = path.join(orchDir || path.join(process.cwd(), '.orch'), 'roles');

    // Multi-path support with priority
    this.rolePaths = rolePaths || [
      path.join(process.cwd(), '.orch', 'roles'), // User-defined roles (highest priority)
      path.join(process.cwd(), 'packages', 'roles'), // Project built-in roles
      path.join(process.cwd(), 'node_modules', '@codecafe', 'roles'), // Package roles (fallback)
    ];
  }

  /**
   * List all available roles from all paths
   * Returns unique role IDs (de-duplicated across paths)
   */
  listRoles(): string[] {
    const roleIds = new Set<string>();

    for (const rolesDir of this.rolePaths) {
      if (fs.existsSync(rolesDir)) {
        try {
          fs.readdirSync(rolesDir)
            .filter((file) => file.endsWith('.md'))
            .forEach((file) => roleIds.add(path.basename(file, '.md')));
        } catch (error) {
          // Ignore directories that can't be read
          console.warn(`Failed to read roles directory: ${rolesDir}`, error);
        }
      }
    }

    return Array.from(roleIds).sort();
  }

  /**
   * Validate role ID to prevent path traversal attacks
   * @param roleId - Role ID to validate
   * @returns true if valid, false otherwise
   */
  private validateRoleId(roleId: string): boolean {
    // Only allow alphanumeric, underscore, hyphen
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    return validPattern.test(roleId);
  }

  /**
   * Load a role by ID
   * Searches all paths in priority order, returns first match
   */
  loadRole(roleId: string): Role | null {
    // Validate role ID to prevent path traversal
    if (!this.validateRoleId(roleId)) {
      console.error(`Invalid role ID: ${roleId} (must be alphanumeric, underscore, or hyphen only)`);
      return null;
    }

    for (const rolesDir of this.rolePaths) {
      const rolePath = path.join(rolesDir, `${roleId}.md`);

      // Additional safety: verify resolved path is within rolesDir
      const resolvedPath = path.resolve(rolePath);
      const resolvedDir = path.resolve(rolesDir);
      if (!resolvedPath.startsWith(resolvedDir + path.sep) && resolvedPath !== path.join(resolvedDir, `${roleId}.md`)) {
        console.error(`Path traversal attempt detected: ${roleId}`);
        continue;
      }

      if (fs.existsSync(rolePath)) {
        try {
          const fileContent = fs.readFileSync(rolePath, 'utf-8');
          const { data, content } = matter(fileContent);

          return {
            id: data.id || roleId,
            name: data.name || roleId,
            output_schema: data.output_schema || '',
            inputs: data.inputs || [],
            guards: data.guards || [],
            template: content.trim(),
          };
        } catch (error) {
          console.error(`Failed to load role ${roleId} from ${rolePath}:`, error);
          // Continue to next path
        }
      }
    }

    return null; // Not found in any path
  }

  /**
   * Save a role
   */
  saveRole(role: Role): void {
    // Validate role ID to prevent path traversal
    if (!this.validateRoleId(role.id)) {
      throw new Error(`Invalid role ID: ${role.id} (must be alphanumeric, underscore, or hyphen only)`);
    }

    if (!fs.existsSync(this.rolesDir)) {
      fs.mkdirSync(this.rolesDir, { recursive: true });
    }

    const rolePath = path.join(this.rolesDir, `${role.id}.md`);

    // Construct frontmatter
    const frontmatter: any = {
      id: role.id,
      name: role.name,
      output_schema: role.output_schema,
      inputs: role.inputs,
    };

    if (role.guards && role.guards.length > 0) {
      frontmatter.guards = role.guards;
    }

    // Use gray-matter to stringify
    const fileContent = matter.stringify(role.template, frontmatter);

    fs.writeFileSync(rolePath, fileContent, 'utf-8');
  }

  /**
   * Delete a role
   */
  deleteRole(roleId: string): boolean {
    // Validate role ID to prevent path traversal
    if (!this.validateRoleId(roleId)) {
      console.error(`Invalid role ID: ${roleId} (must be alphanumeric, underscore, or hyphen only)`);
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
   * Check if a role exists in any path
   */
  roleExists(roleId: string): boolean {
    // Validate role ID to prevent path traversal
    if (!this.validateRoleId(roleId)) {
      return false;
    }

    for (const rolesDir of this.rolePaths) {
      const rolePath = path.join(rolesDir, `${roleId}.md`);
      if (fs.existsSync(rolePath)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Create a role from template
   */
  createFromTemplate(roleId: string, templatePath?: string): void {
    if (this.roleExists(roleId)) {
      throw new Error(`Role ${roleId} already exists`);
    }

    let template: Role;

    if (templatePath && fs.existsSync(templatePath)) {
      // Load from custom template
      const fileContent = fs.readFileSync(templatePath, 'utf-8');
      const { data, content } = matter(fileContent);

      template = {
        id: roleId,
        name: data.name || roleId,
        output_schema: data.output_schema || '',
        inputs: data.inputs || [],
        guards: data.guards || [],
        template: content.trim(),
      };
    } else {
      // Create default template
      template = {
        id: roleId,
        name: roleId,
        output_schema: `schemas/${roleId}.schema.json`,
        inputs: ['.orch/context/requirements.md'],
        guards: ['Output must be valid JSON', 'Must follow schema'],
        template: `You are a specialized agent with the role: ${roleId}.

Read the following files:
{{#each inputs}}
- {{this}}
{{/each}}

Perform your task according to your role.

Output must be valid JSON matching the schema.`,
      };
    }

    this.saveRole(template);
  }

  /**
   * Get role file path
   */
  getRolePath(roleId: string): string {
    return path.join(this.rolesDir, `${roleId}.md`);
  }
}
