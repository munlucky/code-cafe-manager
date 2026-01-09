import { RecipeManager, BaristaManager, OrderManager, executeRecipe } from './packages/core/dist/index.js';
import { resolve } from 'path';

async function testExecution() {
  try {
    console.log('=== Recipe Execution Test ===\n');

    // 1. Load recipe
    const recipeManager = new RecipeManager();
    const recipePath = resolve('recipes/house-blend/test-simple.yaml');

    console.log('Loading recipe:', recipePath);
    const recipe = await recipeManager.loadRecipe(recipePath);
    console.log('✓ Recipe loaded:', recipe.name, recipe.version, '\n');

    // 2. Create managers
    const baristaManager = new BaristaManager(4);
    const orderManager = new OrderManager();

    // 3. Create order
    const order = orderManager.createOrder(
      recipe.name,
      recipe.name,
      process.cwd(), // counter = current directory
      'claude-code',
      {}
    );
    console.log('✓ Order created:', order.id, '\n');

    // 4. Create simple provider factory (mock)
    const providerFactory = {
      create: (type, config) => {
        throw new Error('AI providers not needed for this test');
      },
    };

    // 5. Create execution context
    const ctx = {
      order,
      recipe,
      baristaManager,
      providerFactory,
      stepOutputs: new Map(),
    };

    // 6. Execute recipe
    console.log('Executing recipe...\n');
    const result = await executeRecipe(ctx);

    // 7. Print results
    console.log('\n=== Execution Results ===');
    console.log('Status:', result.status);
    console.log('Steps executed:', result.steps.length);

    if (result.error) {
      console.log('Error:', result.error);
    }

    console.log('\nStep Results:');
    for (const stepResult of result.steps) {
      const icon = stepResult.status === 'success' ? '✓' : '✗';
      console.log(`  ${icon} ${stepResult.stepId} (${stepResult.status})`);

      if (stepResult.output) {
        const preview = stepResult.output.slice(0, 200);
        console.log(`    Output: ${preview}${stepResult.output.length > 200 ? '...' : ''}`);
      }

      if (stepResult.error) {
        console.log(`    Error: ${stepResult.error}`);
      }

      if (stepResult.outputs) {
        console.log(`    Outputs:`, JSON.stringify(stepResult.outputs, null, 2));
      }
    }

    console.log('\n✓ Test completed');

  } catch (error) {
    console.error('\n✗ Test failed:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testExecution();
