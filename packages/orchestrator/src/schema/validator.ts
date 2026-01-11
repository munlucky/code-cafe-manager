import Ajv, { ValidateFunction } from 'ajv';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

const ajv = new Ajv({ allErrors: true });

// Cache for compiled validators
const validatorCache = new Map<string, ValidateFunction>();

/**
 * Load and validate a YAML file against a JSON schema
 */
export async function validateYaml<T = any>(
  yamlPath: string,
  schemaPath: string
): Promise<{ valid: boolean; data?: T; errors?: string[] }> {
  try {
    // Load YAML file
    const yamlContent = fs.readFileSync(yamlPath, 'utf-8');
    const data = yaml.load(yamlContent) as T;

    // Load or get cached validator
    let validator = validatorCache.get(schemaPath);
    if (!validator) {
      const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
      const schema = JSON.parse(schemaContent);
      validator = ajv.compile(schema);
      validatorCache.set(schemaPath, validator);
    }

    // Validate
    const valid = validator(data);

    if (!valid && validator.errors) {
      const errors = validator.errors.map((err) => {
        return `${err.instancePath || '/'} ${err.message}`;
      });
      return { valid: false, errors };
    }

    return { valid: true, data };
  } catch (error) {
    if (error instanceof Error) {
      return { valid: false, errors: [error.message] };
    }
    return { valid: false, errors: ['Unknown validation error'] };
  }
}

/**
 * Validate JSON data against a schema
 */
export async function validateJson<T = any>(
  data: any,
  schemaPath: string
): Promise<{ valid: boolean; data?: T; errors?: string[] }> {
  try {
    // Load or get cached validator
    let validator = validatorCache.get(schemaPath);
    if (!validator) {
      const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
      const schema = JSON.parse(schemaContent);
      validator = ajv.compile(schema);
      validatorCache.set(schemaPath, validator);
    }

    // Validate
    const valid = validator(data);

    if (!valid && validator.errors) {
      const errors = validator.errors.map((err) => {
        return `${err.instancePath || '/'} ${err.message}`;
      });
      return { valid: false, errors };
    }

    return { valid: true, data: data as T };
  } catch (error) {
    if (error instanceof Error) {
      return { valid: false, errors: [error.message] };
    }
    return { valid: false, errors: ['Unknown validation error'] };
  }
}

/**
 * Load workflow YAML file and validate
 */
export async function loadWorkflow(workflowPath: string) {
  const schemaPath = path.join(__dirname, 'workflow.schema.json');
  return validateYaml(workflowPath, schemaPath);
}

/**
 * Load stage profile YAML file and validate
 */
export async function loadStageProfile(profilePath: string) {
  const schemaPath = path.join(__dirname, 'stage-profile.schema.json');
  return validateYaml(profilePath, schemaPath);
}
