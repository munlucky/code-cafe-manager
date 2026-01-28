/**
 * Provider Zod Schemas
 * Validation schemas for provider configuration data structures
 */

import { z } from 'zod';

/**
 * Schema for a single provider configuration
 */
export const ProviderConfigSchema = z.object({
  headless_cmd: z.string(),
  assisted_hint: z.string(),
  timeout: z.number().int().positive(),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

/**
 * Schema for the providers.yml file structure
 * Format:
 * providers:
 *   claude-code:
 *     headless_cmd: "..."
 *     assisted_hint: "..."
 *     timeout: 1800000
 */
export const ProvidersYamlSchema = z.object({
  providers: z.record(z.string(), ProviderConfigSchema),
});

export type ProvidersYaml = z.infer<typeof ProvidersYamlSchema>;

/**
 * Parse and validate provider configuration from YAML content
 * Returns validated data or throws a validation error
 */
export function parseProvidersYaml(data: unknown): ProvidersYaml {
  return ProvidersYamlSchema.parse(data);
}

/**
 * Safely parse provider configuration from YAML content
 * Returns a result object with success flag and data or error
 */
export function safeParseProvidersYaml(data: unknown): z.SafeParseReturnType<unknown, ProvidersYaml> {
  return ProvidersYamlSchema.safeParse(data);
}
