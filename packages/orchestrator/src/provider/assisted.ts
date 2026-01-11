import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import chokidar from 'chokidar';
import { ProviderAdapter } from './adapter';
import { RoleManager } from '../role/role-manager';
import { TemplateEngine } from '../role/template';
import { ProviderType } from '../types';
import { validateJson } from '../schema/validator';

/**
 * Assisted execution options
 */
export interface AssistedExecutionOptions {
  provider: ProviderType;
  role: string;
  context: Record<string, any>;
  outputDir: string;
  orchDir?: string;
}

/**
 * Assisted execution result
 */
export interface AssistedExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
}

export interface AssistedSchemaExecutionOptions extends AssistedExecutionOptions {
  schemaPath: string;
  maxRetries?: number;
  onValidationFail?: (errors: string[]) => void;
  onRetry?: (attempt: number, remaining: number) => void;
}

/**
 * Assisted Mode Executor
 * Generates prompts and waits for user to manually execute and provide results
 */
export class AssistedExecutor {
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
   * Execute in assisted mode
   */
  async execute(options: AssistedExecutionOptions): Promise<AssistedExecutionResult> {
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

      // 5. Show provider hint
      const hint = this.providerAdapter.getAssistedHint(options.provider);
      console.log(chalk.yellow('\n⚠️  Manual execution required:'));
      console.log(chalk.gray(`  Provider: ${options.provider}`));
      console.log(chalk.gray(`  ${hint}`));

      // 6. Show expected output path
      const resultPath = path.join(options.outputDir, 'result.json');
      console.log(chalk.blue('\n💾 Expected result file:'));
      console.log(chalk.gray(`  ${resultPath}`));

      // 7. Wait for result file
      console.log(chalk.yellow('\n⏳ Waiting for result file...'));
      console.log(chalk.gray('  (Press Ctrl+C to cancel)'));

      const result = await this.waitForResultFile(resultPath);

      if (result.success) {
        console.log(chalk.green('\n✓ Result file detected'));

        // Parse and return result
        try {
          const output = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
          return {
            success: true,
            output,
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to parse result JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      } else {
        return {
          success: false,
          error: result.error,
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
   * Execute in assisted mode with schema validation + retry
   */
  async executeWithSchema(
    options: AssistedSchemaExecutionOptions
  ): Promise<AssistedExecutionResult> {
    const maxRetries = options.maxRetries ?? 3;

    try {
      const promptResult = await this.generatePrompt(options);
      if (!promptResult.success) {
        return {
          success: false,
          error: promptResult.error || 'Failed to generate prompt',
        };
      }

      console.log(chalk.blue('\n?? Prompt generated'));
      console.log(chalk.gray(`  Location: ${promptResult.promptPath}`));

      const hint = this.providerAdapter.getAssistedHint(options.provider);
      console.log(chalk.yellow('\n??  Manual execution required:'));
      console.log(chalk.gray(`  Provider: ${options.provider}`));
      console.log(chalk.gray(`  ${hint}`));

      const resultPath = path.join(options.outputDir, 'result.json');
      console.log(chalk.blue('\n?? Expected result file:'));
      console.log(chalk.gray(`  ${resultPath}`));

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(chalk.yellow('\n? Waiting for result file...'));
        console.log(chalk.gray('  (Press Ctrl+C to cancel)'));

        const waitResult = await this.waitForResultFile(
          resultPath,
          3600000,
          attempt > 1
        );

        if (!waitResult.success) {
          return {
            success: false,
            error: waitResult.error,
          };
        }

        let output: any;
        try {
          output = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
        } catch (error) {
          const message = `Failed to parse result JSON: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`;
          options.onValidationFail?.([message]);
          console.log(chalk.red(`\n? ${message}`));

          if (attempt < maxRetries) {
            options.onRetry?.(attempt, maxRetries - attempt);
            console.log(chalk.yellow(`? Retry ${attempt}/${maxRetries}`));
            continue;
          }

          return { success: false, error: message };
        }

        const validation = await validateJson(output, options.schemaPath);
        if (validation.valid) {
          console.log(chalk.green('\n? Schema validation passed'));
          return {
            success: true,
            output: validation.data ?? output,
          };
        }

        const errors = validation.errors || ['Schema validation failed'];
        options.onValidationFail?.(errors);
        console.log(chalk.red('\n? Schema validation failed'));
        errors.forEach((err) => console.log(chalk.gray(`  - ${err}`)));

        if (attempt < maxRetries) {
          options.onRetry?.(attempt, maxRetries - attempt);
          console.log(chalk.yellow(`? Retry ${attempt}/${maxRetries}`));
          continue;
        }

        return {
          success: false,
          error: `Schema validation failed after ${maxRetries} attempts`,
        };
      }

      return {
        success: false,
        error: `Schema validation failed after ${maxRetries} attempts`,
      };
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
   * Wait for result file to be created/updated
   */
  private async waitForResultFile(
    filePath: string,
    timeout: number = 3600000, // 1 hour default
    requireChange: boolean = false
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      let resolved = false;
      let timeoutId: NodeJS.Timeout;

      // Setup file watcher
      const watcher = chokidar.watch(filePath, {
        persistent: true,
        ignoreInitial: requireChange,
        awaitWriteFinish: {
          stabilityThreshold: 500,
          pollInterval: 100,
        },
      });

      // Handle file created/changed
      watcher.on('add', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          watcher.close();
          resolve({ success: true });
        }
      });

      watcher.on('change', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          watcher.close();
          resolve({ success: true });
        }
      });

      // Handle errors
      watcher.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          watcher.close();
          resolve({
            success: false,
            error: `File watcher error: ${error.message}`,
          });
        }
      });

      // Setup timeout
      timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          watcher.close();
          resolve({
            success: false,
            error: `Timeout waiting for result file (${timeout}ms)`,
          });
        }
      }, timeout);

      // Check if file already exists
      if (!requireChange && fs.existsSync(filePath)) {
        // File exists, read it immediately
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          watcher.close();
          resolve({ success: true });
        }
      }
    });
  }

  /**
   * Generate prompt only (without waiting)
   */
  async generatePrompt(options: AssistedExecutionOptions): Promise<{
    success: boolean;
    promptPath?: string;
    error?: string;
  }> {
    try {
      // Load role
      const role = this.roleManager.loadRole(options.role);
      if (!role) {
        return {
          success: false,
          error: `Role not found: ${options.role}`,
        };
      }

      // Generate prompt
      const prompt = this.templateEngine.renderRole(role, options.context);

      // Create output directory
      if (!fs.existsSync(options.outputDir)) {
        fs.mkdirSync(options.outputDir, { recursive: true });
      }

      // Write prompt file
      const promptPath = path.join(options.outputDir, 'prompt.txt');
      fs.writeFileSync(promptPath, prompt, 'utf-8');

      return {
        success: true,
        promptPath,
      };
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
   * Read result from file
   */
  readResult(outputDir: string): { success: boolean; output?: any; error?: string } {
    const resultPath = path.join(outputDir, 'result.json');

    if (!fs.existsSync(resultPath)) {
      return {
        success: false,
        error: 'Result file not found',
      };
    }

    try {
      const content = fs.readFileSync(resultPath, 'utf-8');
      const output = JSON.parse(content);
      return {
        success: true,
        output,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          success: false,
          error: `Failed to parse result: ${error.message}`,
        };
      }
      return {
        success: false,
        error: 'Unknown error',
      };
    }
  }
}
