/**
 * Recipe (Workflow) CRUD handlers hook
 */

import { useCallback } from 'react';
import type { Recipe } from '../types/design';
import { convertToDesignRecipe } from '../utils/converters';

interface UseRecipeHandlersOptions {
  onRecipesChange: React.Dispatch<React.SetStateAction<Recipe[]>>;
}

export function useRecipeHandlers({ onRecipesChange }: UseRecipeHandlersOptions) {
  const handleAddRecipe = useCallback(
    async (recipe: Recipe) => {
      const res = await window.codecafe.workflow.create(recipe);
      if (res.success && res.data) {
        onRecipesChange((prev) => [...prev, convertToDesignRecipe(res.data!)]);
      }
    },
    [onRecipesChange]
  );

  const handleUpdateRecipe = useCallback(
    async (recipe: Recipe) => {
      const res = await window.codecafe.workflow.update(recipe);
      if (res.success && res.data) {
        onRecipesChange((prev) =>
          prev.map((r) =>
            r.id === recipe.id ? convertToDesignRecipe(res.data!) : r
          )
        );
      }
    },
    [onRecipesChange]
  );

  const handleDeleteRecipe = useCallback(
    async (id: string) => {
      const res = await window.codecafe.workflow.delete(id);
      if (res.success) {
        onRecipesChange((prev) => prev.filter((r) => r.id !== id));
      }
    },
    [onRecipesChange]
  );

  return {
    handleAddRecipe,
    handleUpdateRecipe,
    handleDeleteRecipe,
  };
}
