import { RecipeStep } from '../types.js';
import { StepGroup } from './types.js';

/**
 * DAG Resolver
 * Resolves execution order based on step dependencies using topological sort
 */

/**
 * Validates that there are no circular dependencies in the steps
 */
export function validateNoCycles(steps: RecipeStep[]): void {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const stepMap = new Map<string, RecipeStep>();

  for (const step of steps) {
    stepMap.set(step.id, step);
  }

  function hasCycle(stepId: string): boolean {
    if (recursionStack.has(stepId)) {
      return true;
    }

    if (visited.has(stepId)) {
      return false;
    }

    visited.add(stepId);
    recursionStack.add(stepId);

    const step = stepMap.get(stepId);
    if (step?.depends_on) {
      for (const depId of step.depends_on) {
        if (!stepMap.has(depId)) {
          throw new Error(`Step "${stepId}" depends on non-existent step "${depId}"`);
        }
        if (hasCycle(depId)) {
          return true;
        }
      }
    }

    recursionStack.delete(stepId);
    return false;
  }

  for (const step of steps) {
    if (hasCycle(step.id)) {
      throw new Error(`Circular dependency detected involving step "${step.id}"`);
    }
  }
}

/**
 * Resolves execution order using topological sort
 * Returns groups of steps that can be executed in parallel
 */
export function resolveExecutionOrder(steps: RecipeStep[]): StepGroup[] {
  // First validate no cycles
  validateNoCycles(steps);

  const stepMap = new Map<string, RecipeStep>();
  const inDegree = new Map<string, number>();
  const dependencies = new Map<string, Set<string>>();

  // Build dependency graph
  for (const step of steps) {
    stepMap.set(step.id, step);
    inDegree.set(step.id, 0);
    dependencies.set(step.id, new Set());
  }

  // Calculate in-degrees
  for (const step of steps) {
    if (step.depends_on) {
      for (const depId of step.depends_on) {
        const deps = dependencies.get(depId);
        if (deps) {
          deps.add(step.id);
        }
        inDegree.set(step.id, (inDegree.get(step.id) || 0) + 1);
      }
    }
  }

  // Topological sort by levels
  const groups: StepGroup[] = [];
  let level = 0;
  const processed = new Set<string>();

  while (processed.size < steps.length) {
    // Find all steps with in-degree 0 (no dependencies or dependencies satisfied)
    const currentLevel: RecipeStep[] = [];

    for (const step of steps) {
      if (processed.has(step.id)) {
        continue;
      }

      const degree = inDegree.get(step.id) || 0;
      if (degree === 0) {
        currentLevel.push(step);
      }
    }

    if (currentLevel.length === 0) {
      // Should not happen if validateNoCycles passed
      throw new Error('Unable to resolve execution order - possible circular dependency');
    }

    // Add current level to groups
    groups.push({
      level,
      steps: currentLevel,
    });

    // Process current level - reduce in-degree for dependent steps
    for (const step of currentLevel) {
      processed.add(step.id);

      const deps = dependencies.get(step.id);
      if (deps) {
        for (const depStepId of deps) {
          const currentDegree = inDegree.get(depStepId) || 0;
          inDegree.set(depStepId, currentDegree - 1);
        }
      }
    }

    level++;
  }

  return groups;
}
