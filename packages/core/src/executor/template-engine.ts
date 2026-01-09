/**
 * Template Engine
 * Handles variable interpolation in recipe steps
 */

export interface TemplateContext {
  [key: string]: any;
}

/**
 * Process template string with context
 * Supports {{ variable.path }} syntax
 */
export function processTemplate(template: string, context: TemplateContext): string {
  if (!template) {
    return template;
  }

  // Find all {{ ... }} patterns
  const pattern = /\{\{\s*([^}]+)\s*\}\}/g;

  return template.replace(pattern, (match, path) => {
    const value = resolveValue(path.trim(), context);

    if (value === undefined || value === null) {
      console.warn(`Template variable "${path}" not found in context`);
      return match; // Keep original if not found
    }

    // Convert to string
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  });
}

/**
 * Process template object recursively
 */
export function processTemplateObject(obj: any, context: TemplateContext): any {
  if (typeof obj === 'string') {
    return processTemplate(obj, context);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => processTemplateObject(item, context));
  }

  if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = processTemplateObject(value, context);
    }
    return result;
  }

  return obj;
}

/**
 * Resolve nested value from context using dot notation
 * Example: "user.name" from { user: { name: "Alice" } } -> "Alice"
 */
function resolveValue(path: string, context: TemplateContext): any {
  const parts = path.split('.');
  let current: any = context;

  for (const part of parts) {
    if (current === undefined || current === null) {
      return undefined;
    }

    // Handle array access: foo[0]
    const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, arrayName, indexStr] = arrayMatch;
      current = current[arrayName];
      if (!Array.isArray(current)) {
        return undefined;
      }
      current = current[parseInt(indexStr, 10)];
    } else {
      current = current[part];
    }
  }

  return current;
}

/**
 * Evaluate condition expression
 * Supports basic comparisons and logical operators
 */
export function evaluateCondition(condition: string, context: TemplateContext): boolean {
  if (!condition) {
    return true;
  }

  try {
    // First, resolve all template variables in the condition
    const processedCondition = processTemplate(condition, context);

    // Parse and evaluate the condition
    // For M1, support simple comparisons
    // Example: "complexity == 'simple'"
    // Example: "missingInfo.length > 0"

    // Simple equality check
    const eqMatch = processedCondition.match(/^(.+?)\s*==\s*(.+)$/);
    if (eqMatch) {
      const [, left, right] = eqMatch;
      return normalizeValue(left.trim()) === normalizeValue(right.trim());
    }

    // Simple inequality check
    const neqMatch = processedCondition.match(/^(.+?)\s*!=\s*(.+)$/);
    if (neqMatch) {
      const [, left, right] = neqMatch;
      return normalizeValue(left.trim()) !== normalizeValue(right.trim());
    }

    // Greater than
    const gtMatch = processedCondition.match(/^(.+?)\s*>\s*(.+)$/);
    if (gtMatch) {
      const [, left, right] = gtMatch;
      return Number(left.trim()) > Number(right.trim());
    }

    // Less than
    const ltMatch = processedCondition.match(/^(.+?)\s*<\s*(.+)$/);
    if (ltMatch) {
      const [, left, right] = ltMatch;
      return Number(left.trim()) < Number(right.trim());
    }

    // Greater than or equal
    const gteMatch = processedCondition.match(/^(.+?)\s*>=\s*(.+)$/);
    if (gteMatch) {
      const [, left, right] = gteMatch;
      return Number(left.trim()) >= Number(right.trim());
    }

    // Less than or equal
    const lteMatch = processedCondition.match(/^(.+?)\s*<=\s*(.+)$/);
    if (lteMatch) {
      const [, left, right] = lteMatch;
      return Number(left.trim()) <= Number(right.trim());
    }

    // Boolean evaluation
    const boolValue = processedCondition.trim().toLowerCase();
    if (boolValue === 'true') return true;
    if (boolValue === 'false') return false;

    // Default: truthy check
    return !!processedCondition;
  } catch (err) {
    console.error(`Failed to evaluate condition "${condition}":`, err);
    return false;
  }
}

/**
 * Normalize value for comparison (remove quotes, trim)
 */
function normalizeValue(value: string): string {
  let normalized = value.trim();

  // Remove quotes
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1);
  }

  return normalized;
}
