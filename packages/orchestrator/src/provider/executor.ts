import chalk from 'chalk';
import { HeadlessExecutor, HeadlessExecutionOptions, HeadlessExecutionResult } from './headless';
import { AssistedExecutor, AssistedExecutionOptions, AssistedExecutionResult } from './assisted';
import { ProviderType } from '../types';

/**
 * Execution mode
 */
export type ExecutionMode = 'headless' | 'assisted' | 'auto';

/**
 * Unified execution options
 */
export interface ExecutionOptions {
  provider: ProviderType;
  role: string;
  context: Record<string, any>;
  outputDir: string;
  orchDir?: string;
  mode?: ExecutionMode;
  env?: Record<string, string>;
  cwd?: string;
}

/**
 * Unified execution result
 */
export interface ExecutionResult {
  success: boolean;
  output?: any;
  rawText?: string;
  error?: string;
  mode: 'headless' | 'assisted';
  fallbackOccurred?: boolean;
}

export interface SchemaExecutionOptions extends ExecutionOptions {
  schemaPath: string;
  maxRetries?: number;
  onValidationFail?: (errors: string[]) => void;
  onRetry?: (attempt: number, remaining: number) => void;
  onFallback?: (reason: string) => void;
}

/**
 * Unified Provider Executor
 * Tries headless mode first, falls back to assisted mode on failure
 */
export class ProviderExecutor {
  private headlessExecutor: HeadlessExecutor;
  private assistedExecutor: AssistedExecutor;

  constructor(orchDir?: string) {
    this.headlessExecutor = new HeadlessExecutor(orchDir);
    this.assistedExecutor = new AssistedExecutor(orchDir);
  }

  /**
   * Execute with automatic mode selection
   */
  async execute(options: ExecutionOptions): Promise<ExecutionResult> {
    const mode = options.mode || 'auto';

    // Force assisted mode
    if (mode === 'assisted') {
      console.log(chalk.blue('\n📋 Using assisted mode (forced)'));
      const result = await this.assistedExecutor.execute(options);
      return {
        ...result,
        mode: 'assisted',
      };
    }

    // Force headless mode
    if (mode === 'headless') {
      console.log(chalk.blue('\n🤖 Using headless mode (forced)'));
      const result = await this.headlessExecutor.execute(options);
      return {
        ...result,
        mode: 'headless',
      };
    }

    // Auto mode: try headless first, fallback to assisted
    return await this.executeWithFallback(options);
  }

  /**
   * Execute with schema validation
   */
  async executeWithSchema(options: SchemaExecutionOptions): Promise<ExecutionResult> {
    const mode = options.mode || 'auto';

    // Force assisted mode
    if (mode === 'assisted') {
      console.log(chalk.blue('\n📋 Using assisted mode (forced)'));
      const result = await this.assistedExecutor.executeWithSchema(options);
      return {
        ...result,
        mode: 'assisted',
      };
    }

    // Force headless mode
    if (mode === 'headless') {
      console.log(chalk.blue('\n🤖 Using headless mode (forced)'));
      const result = await this.headlessExecutor.executeWithSchema(options);
      return {
        ...result,
        mode: 'headless',
      };
    }

    // Auto mode: try headless first, fallback to assisted
    return await this.executeWithSchemaAndFallback(options);
  }

  /**
   * Execute with automatic fallback (no schema)
   */
  private async executeWithFallback(options: ExecutionOptions): Promise<ExecutionResult> {
    // Check if headless is available
    if (!this.headlessExecutor.isHeadlessAvailable(options.provider)) {
      console.log(chalk.yellow('\n⚠️  Headless mode not available, using assisted mode'));
      const result = await this.assistedExecutor.execute(options);
      return {
        ...result,
        mode: 'assisted',
        fallbackOccurred: true,
      };
    }

    // Try headless mode
    console.log(chalk.blue('\n🤖 Trying headless mode...'));
    const headlessResult = await this.headlessExecutor.execute(options);

    if (headlessResult.success) {
      console.log(chalk.green('\n✓ Headless mode succeeded'));
      return {
        ...headlessResult,
        mode: 'headless',
      };
    }

    // Headless failed, fallback to assisted
    console.log(chalk.yellow('\n⚠️  Headless mode failed, falling back to assisted mode'));
    console.log(chalk.gray(`  Reason: ${headlessResult.error}`));

    const assistedResult = await this.assistedExecutor.execute(options);
    return {
      ...assistedResult,
      mode: 'assisted',
      fallbackOccurred: true,
    };
  }

  /**
   * Execute with automatic fallback (with schema)
   */
  private async executeWithSchemaAndFallback(
    options: SchemaExecutionOptions
  ): Promise<ExecutionResult> {
    // Check if headless is available
    if (!this.headlessExecutor.isHeadlessAvailable(options.provider)) {
      console.log(chalk.yellow('\n⚠️  Headless mode not available, using assisted mode'));
      options.onFallback?.('Headless mode not configured');

      const result = await this.assistedExecutor.executeWithSchema(options);
      return {
        ...result,
        mode: 'assisted',
        fallbackOccurred: true,
      };
    }

    // Try headless mode
    console.log(chalk.blue('\n🤖 Trying headless mode...'));
    const headlessResult = await this.headlessExecutor.executeWithSchema(options);

    if (headlessResult.success) {
      console.log(chalk.green('\n✓ Headless mode succeeded'));
      return {
        ...headlessResult,
        mode: 'headless',
      };
    }

    // Headless failed, fallback to assisted
    console.log(chalk.yellow('\n⚠️  Headless mode failed, falling back to assisted mode'));
    console.log(chalk.gray(`  Reason: ${headlessResult.error}`));
    options.onFallback?.(headlessResult.error || 'Unknown error');

    const assistedResult = await this.assistedExecutor.executeWithSchema(options);
    return {
      ...assistedResult,
      mode: 'assisted',
      fallbackOccurred: true,
    };
  }

  /**
   * Check if headless mode is available for provider
   */
  isHeadlessAvailable(provider: ProviderType): boolean {
    return this.headlessExecutor.isHeadlessAvailable(provider);
  }
}
