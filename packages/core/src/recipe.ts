import { Recipe, RecipeStep } from './types.js';
import * as YAML from 'yaml';
import { readFile } from 'fs/promises';

/**
 * Recipe Manager
 * YAML 레시피를 로드하고 검증합니다.
 */
export class RecipeManager {
  private recipes: Map<string, Recipe> = new Map();

  /**
   * YAML 파일에서 레시피 로드
   */
  async loadRecipe(filePath: string): Promise<Recipe> {
    const content = await readFile(filePath, 'utf-8');
    const recipe = YAML.parse(content) as Recipe;

    // 기본 검증
    this.validateRecipe(recipe);

    // 레시피 저장
    this.recipes.set(recipe.name, recipe);

    return recipe;
  }

  /**
   * 문자열에서 레시피 파싱
   */
  parseRecipe(yamlContent: string): Recipe {
    const recipe = YAML.parse(yamlContent) as Recipe;
    this.validateRecipe(recipe);
    return recipe;
  }

  /**
   * 레시피 검증
   */
  validateRecipe(recipe: Recipe): void {
    if (!recipe.name) {
      throw new Error('Recipe name is required');
    }

    if (!recipe.version) {
      throw new Error('Recipe version is required');
    }

    if (!recipe.defaults?.provider) {
      throw new Error('Recipe defaults.provider is required');
    }

    if (!recipe.steps || recipe.steps.length === 0) {
      throw new Error('Recipe must have at least one step');
    }

    // Step 검증
    this.validateSteps(recipe.steps);
  }

  /**
   * Step 검증 (재귀)
   */
  private validateSteps(steps: RecipeStep[]): void {
    const stepIds = new Set<string>();

    for (const step of steps) {
      if (!step.id) {
        throw new Error('Step id is required');
      }

      if (stepIds.has(step.id)) {
        throw new Error(`Duplicate step id: ${step.id}`);
      }
      stepIds.add(step.id);

      if (!step.type) {
        throw new Error(`Step ${step.id}: type is required`);
      }

      // Step 타입별 검증
      if (step.type === 'ai.interactive' || step.type === 'ai.prompt') {
        if (!step.prompt && !step.agent_ref) {
          throw new Error(`Step ${step.id}: prompt or agent_ref is required`);
        }
      } else if (step.type === 'shell') {
        if (!step.command) {
          throw new Error(`Step ${step.id}: command is required`);
        }
      } else if (step.type === 'parallel') {
        if (!step.steps || step.steps.length === 0) {
          throw new Error(`Step ${step.id}: parallel step must have substeps`);
        }
        this.validateSteps(step.steps);
      } else if (step.type === 'conditional') {
        if (!step.condition) {
          throw new Error(`Step ${step.id}: condition is required for conditional step`);
        }
        if (step.when_true && step.when_true.length > 0) {
          this.validateSteps(step.when_true);
        }
        if (step.when_false && step.when_false.length > 0) {
          this.validateSteps(step.when_false);
        }
      } else if (step.type === 'context.collect') {
        if (!step.collect || step.collect.length === 0) {
          throw new Error(`Step ${step.id}: collect is required for context.collect step`);
        }
      } else if (step.type === 'data.passthrough') {
        // No specific validation needed
      }

      // depends_on 검증
      if (step.depends_on) {
        for (const depId of step.depends_on) {
          if (!stepIds.has(depId)) {
            throw new Error(`Step ${step.id}: depends_on references unknown step ${depId}`);
          }
        }
      }
    }
  }

  /**
   * 레시피 조회
   */
  getRecipe(name: string): Recipe | undefined {
    return this.recipes.get(name);
  }

  /**
   * 모든 레시피 조회
   */
  getAllRecipes(): Recipe[] {
    return Array.from(this.recipes.values());
  }

  /**
   * 레시피를 YAML로 변환
   */
  toYAML(recipe: Recipe): string {
    return YAML.stringify(recipe);
  }
}
