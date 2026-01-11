import Handlebars from 'handlebars';
import { Role } from '../types';

export class TemplateEngine {
  private handlebars: typeof Handlebars;

  constructor() {
    this.handlebars = Handlebars.create();
    this.registerHelpers();
  }

  private registerHelpers(): void {
    this.handlebars.registerHelper('json', (obj) => {
      return JSON.stringify(obj, null, 2);
    });

    this.handlebars.registerHelper('ifEquals', function (this: any, arg1: any, arg2: any, options: any) {
      return arg1 === arg2 ? options.fn(this) : options.inverse(this);
    });

    this.handlebars.registerHelper('length', (arr) => {
      return Array.isArray(arr) ? arr.length : 0;
    });
  }

  renderRole(role: Role, context: Record<string, any>): string {
    try {
      const template = this.handlebars.compile(role.template);

      const mergedContext = {
        ...context,
        inputs: role.inputs,
        guards: role.guards,
        schema: role.output_schema,
      };

      return template(mergedContext);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Template rendering failed: ${error.message}`);
      }
      throw error;
    }
  }

  render(templateString: string, context: Record<string, any>): string {
    try {
      const template = this.handlebars.compile(templateString);
      return template(context);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Template rendering failed: ${error.message}`);
      }
      throw error;
    }
  }

  validateTemplate(templateString: string): { valid: boolean; error?: string } {
    try {
      this.handlebars.compile(templateString);
      return { valid: true };
    } catch (error) {
      if (error instanceof Error) {
        return { valid: false, error: error.message };
      }
      return { valid: false, error: 'Unknown error' };
    }
  }

  extractVariables(templateString: string): string[] {
    const variables = new Set<string>();
    const regex = /\{\{([^}]+)\}\}/g;
    let match;

    while ((match = regex.exec(templateString)) !== null) {
      const variable = match[1].trim();

      const cleaned = variable
        .replace(/^#.*?\s+/, '')
        .replace(/^\/.*$/, '')
        .replace(/^\.\.\//g, '')
        .split(/\s+/)[0]
        .split('.')[0];

      if (cleaned && !cleaned.startsWith('#') && !cleaned.startsWith('/')) {
        variables.add(cleaned);
      }
    }

    return Array.from(variables);
  }
}

export const templateEngine = new TemplateEngine();
