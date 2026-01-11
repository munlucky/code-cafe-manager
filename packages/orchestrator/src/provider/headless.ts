import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';
import chalk from 'chalk';
import { ProviderAdapter } from './adapter';
import { RoleManager } from '../role/role-manager';
import { TemplateEngine } from '../role/template';
import { ProviderType } from '../types';
import { validateJson } from '../schema/validator';

/**
 * Headless execution options
 */
export interface HeadlessExecutionOptions {
  provider: ProviderType;
  role: string;
  context: Record<string, any>;
  outputDir: string;
  orchDir?: string;
  env?: Record<string, string>;
  cwd?: string;
}

/**
 * Headless execution result
 */
export interface HeadlessExecutionResult {
  success: boolean;
  output?: any;
  rawText?: string;
  error?: string;
  stderr?: string;
}

export interface HeadlessSchemaExecutionOptions extends HeadlessExecutionOptions {
  schemaPath: string;
  maxRetries?: number;
  onValidationFail?: (errors: string[]) => void;
  onRetry?: (attempt: number, remaining: number) => void;
}

/**
 * Headless Mode Executor
 * Automatically executes provider CLI and captures output
 */
export class HeadlessExecutor {
  private providerAdapter: ProviderAdapter;
  private roleManager: RoleManager;
  private templateEngine: TemplateEngine;

  constructor(orchDir?: string) {
    const baseDir = orchDir || path.join(process.cwd(), '.orch');
    this.providerAdapter = new ProviderAdapter(baseDir);
    this.roleManager = new RoleManager(baseDir);
    this.templateEngine = new TemplateEngine();
  }

  /**
   * Execute in headless mode
   */
  async execute(options: HeadlessExecutionOptions): Promise<HeadlessExecutionResult> {
    try {
      // 1. Load role
      const role = this.roleManager.loadRole(options.role);
      if (!role) {
        return {
          success: false,
          error: `Role not found: ${options.role}`,
        };
      }

      // 2. Generate prompt
      const prompt = this.templateEngine.renderRole(role, options.context);

      // 3. Create output directory
      if (!fs.existsSync(options.outputDir)) {
        fs.mkdirSync(options.outputDir, { recursive: true });
      }

      // 4. Write prompt file
      const promptPath = path.join(options.outputDir, 'prompt.txt');
      fs.writeFileSync(promptPath, prompt, 'utf-8');

      console.log(chalk.blue('\n📝 Prompt generated'));
      console.log(chalk.gray(`  Location: ${promptPath}`));

      // 5. Get headless command
      const cmdTemplate = this.providerAdapter.getHeadlessCommand(options.provider);
      if (!cmdTemplate) {
        return {
          success: false,
          error: `Headless command not configured for provider: ${options.provider}`,
        };
      }

      // 6. Interpolate command
      const command = this.providerAdapter.interpolateCommand(cmdTemplate, {
        promptFile: promptPath,
        promptText: prompt,
      });

      console.log(chalk.blue('\n🚀 Executing headless command'));
      console.log(chalk.gray(`  Provider: ${options.provider}`));
      console.log(chalk.gray(`  Command: ${command}`));

      // 7. Execute command
      const result = await this.executeCommand(command, {
        cwd: options.cwd || process.cwd(),
        env: { ...process.env, ...options.env } as Record<string, string>,
        timeout: this.providerAdapter.getTimeout(options.provider),
      });

      if (!result.success) {
        return result;
      }

      // 8. Parse JSON output
      console.log(chalk.green('\n✓ Command executed successfully'));

      try {
        const output = JSON.parse(result.rawText || '{}');
        return {
          success: true,
          output,
          rawText: result.rawText,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to parse JSON output: ${error instanceof Error ? error.message : 'Unknown error'}`,
          rawText: result.rawText,
        };
      }
    } catch (error) {
      if (error instanceof Error) {
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: 'Unknown error',
      };
    }
  }

  /**
   * Execute in headless mode with schema validation + retry
   */
  async executeWithSchema(
    options: HeadlessSchemaExecutionOptions
  ): Promise<HeadlessExecutionResult> {
    const maxRetries = options.maxRetries ?? 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(chalk.yellow(`\n🔄 Attempt ${attempt}/${maxRetries}`));

      const result = await this.execute(options);

      if (!result.success) {
        if (attempt < maxRetries) {
          options.onRetry?.(attempt, maxRetries - attempt);
          console.log(chalk.yellow(`⚠️  Execution failed, retrying...`));
          continue;
        }
        return result;
      }

      // Validate against schema
      const validation = await validateJson(result.output, options.schemaPath);
      if (validation.valid) {
        console.log(chalk.green('\n✓ Schema validation passed'));
        return {
          success: true,
          output: validation.data ?? result.output,
          rawText: result.rawText,
        };
      }

      const errors = validation.errors || ['Schema validation failed'];
      options.onValidationFail?.(errors);
      console.log(chalk.red('\n✗ Schema validation failed'));
      errors.forEach((err) => console.log(chalk.gray(`  - ${err}`)));

      if (attempt < maxRetries) {
        options.onRetry?.(attempt, maxRetries - attempt);
        console.log(chalk.yellow(`⚠️  Retrying...`));
        continue;
      }

      return {
        success: false,
        error: `Schema validation failed after ${maxRetries} attempts`,
        output: result.output,
        rawText: result.rawText,
      };
    }

    return {
      success: false,
      error: `Execution failed after ${maxRetries} attempts`,
    };
  }

  /**
   * Execute shell command and capture output
   */
  private async executeCommand(
    command: string,
    options: {
      cwd?: string;
      env?: Record<string, string>;
      timeout?: number;
    }
  ): Promise<HeadlessExecutionResult> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';

      // Parse command (simple split by space, doesn't handle quoted args properly)
      // For production, use a proper shell parser
      const parts = command.split(' ');
      const cmd = parts[0];
      const args = parts.slice(1);

      const proc = child_process.spawn(cmd, args, {
        cwd: options.cwd,
        env: options.env,
        shell: true,
      });

      // Capture stdout
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      // Capture stderr
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle exit
      proc.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            rawText: stdout,
          });
        } else {
          resolve({
            success: false,
            error: `Command exited with code ${code}`,
            stderr,
            rawText: stdout,
          });
        }
      });

      // Handle error
      proc.on('error', (error) => {
        resolve({
          success: false,
          error: `Failed to execute command: ${error.message}`,
        });
      });

      // Setup timeout
      if (options.timeout) {
        setTimeout(() => {
          proc.kill();
          resolve({
            success: false,
            error: `Command timeout after ${options.timeout}ms`,
            stderr,
            rawText: stdout,
          });
        }, options.timeout);
      }
    });
  }

  /**
   * Check if headless mode is available for provider
   */
  isHeadlessAvailable(provider: ProviderType): boolean {
    const cmd = this.providerAdapter.getHeadlessCommand(provider);
    return cmd !== '';
  }
}
