import { create } from 'zustand';
import type { Recipe } from '../types/models';

interface RecipeState {
  recipes: string[]; // 레시피 파일명 목록
  currentRecipe: Recipe | null;
  currentRecipeName: string | null;
  setRecipes: (recipes: string[]) => void;
  setCurrentRecipe: (recipe: Recipe | null, name: string | null) => void;
}

export const useRecipeStore = create<RecipeState>((set) => ({
  recipes: [],
  currentRecipe: null,
  currentRecipeName: null,
  setRecipes: (recipes) => set({ recipes }),
  setCurrentRecipe: (recipe, name) =>
    set({ currentRecipe: recipe, currentRecipeName: name }),
}));
