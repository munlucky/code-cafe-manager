import { describe, it, expect } from '@jest/globals';
import { validateNoCycles, resolveExecutionOrder } from '../executor/dag-resolver.js';
import { RecipeStep } from '../types.js';

describe('DAG Resolver', () => {
  describe('validateNoCycles', () => {
    it('should pass for steps with no dependencies', () => {
      const steps: RecipeStep[] = [
        { id: 'step1', type: 'ai.prompt', prompt: 'test' },
        { id: 'step2', type: 'ai.prompt', prompt: 'test' },
      ];

      expect(() => validateNoCycles(steps)).not.toThrow();
    });

    it('should pass for valid dependency chain', () => {
      const steps: RecipeStep[] = [
        { id: 'step1', type: 'ai.prompt', prompt: 'test' },
        { id: 'step2', type: 'ai.prompt', prompt: 'test', depends_on: ['step1'] },
        { id: 'step3', type: 'ai.prompt', prompt: 'test', depends_on: ['step2'] },
      ];

      expect(() => validateNoCycles(steps)).not.toThrow();
    });

    it('should fail for circular dependency', () => {
      const steps: RecipeStep[] = [
        { id: 'step1', type: 'ai.prompt', prompt: 'test', depends_on: ['step2'] },
        { id: 'step2', type: 'ai.prompt', prompt: 'test', depends_on: ['step1'] },
      ];

      expect(() => validateNoCycles(steps)).toThrow(/circular dependency/i);
    });

    it('should fail for self-reference', () => {
      const steps: RecipeStep[] = [
        { id: 'step1', type: 'ai.prompt', prompt: 'test', depends_on: ['step1'] },
      ];

      expect(() => validateNoCycles(steps)).toThrow(/circular dependency/i);
    });

    it('should fail for non-existent dependency', () => {
      const steps: RecipeStep[] = [
        { id: 'step1', type: 'ai.prompt', prompt: 'test', depends_on: ['step999'] },
      ];

      expect(() => validateNoCycles(steps)).toThrow(/non-existent step/i);
    });
  });

  describe('resolveExecutionOrder', () => {
    it('should group independent steps in same level', () => {
      const steps: RecipeStep[] = [
        { id: 'step1', type: 'ai.prompt', prompt: 'test' },
        { id: 'step2', type: 'ai.prompt', prompt: 'test' },
        { id: 'step3', type: 'ai.prompt', prompt: 'test' },
      ];

      const groups = resolveExecutionOrder(steps);

      expect(groups).toHaveLength(1);
      expect(groups[0].level).toBe(0);
      expect(groups[0].steps).toHaveLength(3);
    });

    it('should create separate levels for dependent steps', () => {
      const steps: RecipeStep[] = [
        { id: 'step1', type: 'ai.prompt', prompt: 'test' },
        { id: 'step2', type: 'ai.prompt', prompt: 'test', depends_on: ['step1'] },
        { id: 'step3', type: 'ai.prompt', prompt: 'test', depends_on: ['step2'] },
      ];

      const groups = resolveExecutionOrder(steps);

      expect(groups).toHaveLength(3);
      expect(groups[0].steps[0].id).toBe('step1');
      expect(groups[1].steps[0].id).toBe('step2');
      expect(groups[2].steps[0].id).toBe('step3');
    });

    it('should group steps with same dependency level', () => {
      const steps: RecipeStep[] = [
        { id: 'step1', type: 'ai.prompt', prompt: 'test' },
        { id: 'step2', type: 'ai.prompt', prompt: 'test', depends_on: ['step1'] },
        { id: 'step3', type: 'ai.prompt', prompt: 'test', depends_on: ['step1'] },
        { id: 'step4', type: 'ai.prompt', prompt: 'test', depends_on: ['step2', 'step3'] },
      ];

      const groups = resolveExecutionOrder(steps);

      expect(groups).toHaveLength(3);
      expect(groups[0].steps).toHaveLength(1); // step1
      expect(groups[1].steps).toHaveLength(2); // step2, step3
      expect(groups[2].steps).toHaveLength(1); // step4
    });

    it('should handle complex DAG', () => {
      const steps: RecipeStep[] = [
        { id: 'A', type: 'ai.prompt', prompt: 'test' },
        { id: 'B', type: 'ai.prompt', prompt: 'test' },
        { id: 'C', type: 'ai.prompt', prompt: 'test', depends_on: ['A'] },
        { id: 'D', type: 'ai.prompt', prompt: 'test', depends_on: ['B'] },
        { id: 'E', type: 'ai.prompt', prompt: 'test', depends_on: ['C', 'D'] },
      ];

      const groups = resolveExecutionOrder(steps);

      expect(groups).toHaveLength(3);
      expect(groups[0].steps).toHaveLength(2); // A, B
      expect(groups[1].steps).toHaveLength(2); // C, D
      expect(groups[2].steps).toHaveLength(1); // E
    });
  });
});
