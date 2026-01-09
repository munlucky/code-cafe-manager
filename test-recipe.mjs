import { RecipeManager } from './packages/core/dist/recipe.js';
import { resolve } from 'path';

async function testRecipe() {
  try {
    const recipeManager = new RecipeManager();
    const recipePath = process.argv[2] || resolve('recipes/house-blend/test-simple.yaml');

    console.log('Loading recipe:', recipePath);
    const recipe = await recipeManager.loadRecipe(recipePath);

    console.log('Recipe loaded successfully!');
    console.log('Name:', recipe.name);
    console.log('Version:', recipe.version);
    console.log('Steps:', recipe.steps.length);

    // Test validation
    console.log('\nValidating recipe...');
    recipeManager.validateRecipe(recipe);
    console.log('✓ Recipe validation passed');

    // Print steps
    console.log('\nSteps:');
    for (const step of recipe.steps) {
      console.log(`  - ${step.id} (${step.type})`);
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testRecipe();
