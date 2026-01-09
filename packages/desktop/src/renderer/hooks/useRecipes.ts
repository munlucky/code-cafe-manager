import { useRecipeStore } from '../store/useRecipeStore';
import type { Recipe } from '../types/models';

export function useRecipes() {
  const { recipes, currentRecipe, currentRecipeName, setRecipes, setCurrentRecipe } =
    useRecipeStore();

  const fetchRecipes = async () => {
    try {
      const result = await window.codecafe.listRecipes();
      if (result.success && result.data) {
        setRecipes(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch recipes:', error);
    }
  };

  const loadRecipe = async (name: string) => {
    try {
      const result = await window.codecafe.getRecipe(name);
      if (result.success && result.data) {
        setCurrentRecipe(result.data, name);
      }
    } catch (error) {
      console.error('Failed to load recipe:', error);
    }
  };

  const saveRecipe = async (name: string, data: Recipe) => {
    try {
      const result = await window.codecafe.saveRecipe(name, data);
      if (result.success) {
        await fetchRecipes();
      }
      return result;
    } catch (error) {
      console.error('Failed to save recipe:', error);
      throw error;
    }
  };

  const validateRecipe = async (data: Recipe) => {
    try {
      return await window.codecafe.validateRecipe(data);
    } catch (error) {
      console.error('Failed to validate recipe:', error);
      throw error;
    }
  };

  return {
    recipes,
    currentRecipe,
    currentRecipeName,
    fetchRecipes,
    loadRecipe,
    saveRecipe,
    validateRecipe,
  };
}
