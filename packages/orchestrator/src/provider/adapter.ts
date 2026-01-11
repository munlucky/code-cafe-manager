import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ProviderConfig, ProviderType } from '../types';

/**
 * Provider Adapter - Load and manage provider configurations
 */
export class ProviderAdapter {
  private configs: Map<ProviderType, ProviderConfig>;
  private configPath: string;

  constructor(orchDir: string = path.join(process.cwd(), '.orch')) {
    this.configPath = path.join(orchDir, 'config/providers.yml');
    this.configs = new Map();
    this.loadConfigs();
  }

  /**
   * Load provider configurations from YAML file
   */
  private loadConfigs(): void {
    if (!fs.existsSync(this.configPath)) {
      console.warn(`Provider config not found: ${this.configPath}`);
      this.loadDefaults();
      return;
    }

    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      const data = yaml.load(content) as any;

      if (data && data.providers) {
        for (const [providerName, config] of Object.entries(data.providers)) {
          this.configs.set(providerName as ProviderType, config as ProviderConfig);
        }
      }
    } catch (error) {
      console.error('Failed to load provider configs:', error);
      this.loadDefaults();
    }
  }

  /**
   * Load default provider configurations
   */
  private loadDefaults(): void {
    this.configs.set('claude-code', {
      headless_cmd: 'claude -p @PROMPT_FILE --output-format json',
      assisted_hint: 'Run in Claude Code terminal: paste prompt.txt and save result to result.json',
      timeout: 1800000,
    });

    this.configs.set('codex', {
      headless_cmd: 'codex exec --json -i @PROMPT_FILE',
      assisted_hint: 'Run in Codex terminal and save JSON result to result.json',
      timeout: 1800000,
    });

    this.configs.set('gemini', {
      headless_cmd: 'gemini -p @PROMPT_TEXT --output-format json',
      assisted_hint: 'Run in Gemini CLI and save JSON result to result.json',
      timeout: 1800000,
    });
  }

  /**
   * Get provider configuration
   */
  getConfig(provider: ProviderType): ProviderConfig | null {
    return this.configs.get(provider) || null;
  }

  /**
   * Get assisted hint for provider
   */
  getAssistedHint(provider: ProviderType): string {
    const config = this.getConfig(provider);
    return config?.assisted_hint || 'Run provider and save result to result.json';
  }

  /**
   * Get headless command template for provider
   */
  getHeadlessCommand(provider: ProviderType): string {
    const config = this.getConfig(provider);
    return config?.headless_cmd || '';
  }

  /**
   * Get timeout for provider
   */
  getTimeout(provider: ProviderType): number {
    const config = this.getConfig(provider);
    return config?.timeout || 1800000;
  }

  /**
   * Interpolate command template variables
   */
  interpolateCommand(
    command: string,
    variables: {
      promptFile?: string;
      schemaFile?: string;
      promptText?: string;
    }
  ): string {
    let result = command;

    if (variables.promptFile) {
      result = result.replace(/@PROMPT_FILE/g, variables.promptFile);
    }

    if (variables.schemaFile) {
      result = result.replace(/@SCHEMA_FILE/g, variables.schemaFile);
    }

    if (variables.promptText) {
      result = result.replace(/@PROMPT_TEXT/g, variables.promptText);
    }

    return result;
  }

  /**
   * List all available providers
   */
  listProviders(): ProviderType[] {
    return Array.from(this.configs.keys());
  }

  /**
   * Check if provider is configured
   */
  hasProvider(provider: ProviderType): boolean {
    return this.configs.has(provider);
  }
}
