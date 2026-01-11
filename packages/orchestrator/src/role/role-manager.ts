import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { Role } from '../types';

/**
 * Role Manager - CRUD operations for role templates
 */
export class RoleManager {
  private rolesDir: string;

  constructor(orchDir: string = path.join(process.cwd(), '.orch')) {
    this.rolesDir = path.join(orchDir, 'roles');
  }

  /**
   * List all available roles
   */
  listRoles(): string[] {
    if (!fs.existsSync(this.rolesDir)) {
      return [];
    }

    return fs
      .readdirSync(this.rolesDir)
      .filter((file) => file.endsWith('.md'))
      .map((file) => path.basename(file, '.md'));
  }

  /**
   * Load a role by ID
   */
  loadRole(roleId: string): Role | null {
    const rolePath = path.join(this.rolesDir, `${roleId}.md`);

    if (!fs.existsSync(rolePath)) {
      return null;
    }

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
      console.error(`Failed to load role ${roleId}:`, error);
      return null;
    }
  }

  /**
   * Save a role
   */
  saveRole(role: Role): void {
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
    const rolePath = path.join(this.rolesDir, `${roleId}.md`);

    if (!fs.existsSync(rolePath)) {
      return false;
    }

    fs.unlinkSync(rolePath);
    return true;
  }

  /**
   * Check if a role exists
   */
  roleExists(roleId: string): boolean {
    const rolePath = path.join(this.rolesDir, `${roleId}.md`);
    return fs.existsSync(rolePath);
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
