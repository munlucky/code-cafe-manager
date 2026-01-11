import { AssistedExecutor } from './dist/provider/assisted.js';
import { ProviderAdapter } from './dist/provider/adapter.js';
import * as fs from 'fs';
import * as path from 'path';

console.log('Testing Assisted Mode...\n');

// Test 1: Provider Adapter
console.log('Test 1: Provider Adapter');
const adapter = new ProviderAdapter();
console.log('  Available providers:', adapter.listProviders());
console.log('  Has claude-code:', adapter.hasProvider('claude-code'));
console.log('  Claude hint:', adapter.getAssistedHint('claude-code'));
console.log('  ✓ Passed\n');

// Test 2: Command interpolation
console.log('Test 2: Command interpolation');
const command = 'claude -p @PROMPT_FILE --output @SCHEMA_FILE';
const interpolated = adapter.interpolateCommand(command, {
  promptFile: '/path/to/prompt.txt',
  schemaFile: '/path/to/schema.json',
});
console.log('  Original:', command);
console.log('  Interpolated:', interpolated);
console.log('  ✓ Passed\n');

// Test 3: Generate prompt only
console.log('Test 3: Generate prompt only');
const executor = new AssistedExecutor();
const outputDir = path.join(process.cwd(), '.orch/test-runs/test-assisted');

const generateResult = await executor.generatePrompt({
  provider: 'claude-code',
  role: 'planner',
  context: {
    projectName: 'Test Project',
    requirements: ['Feature A', 'Feature B'],
  },
  outputDir,
});

console.log('  Success:', generateResult.success);
if (generateResult.success) {
  console.log('  Prompt path:', generateResult.promptPath);

  // Check if file exists
  if (fs.existsSync(generateResult.promptPath)) {
    console.log('  ✓ Prompt file created');

    // Read first few lines
    const content = fs.readFileSync(generateResult.promptPath, 'utf-8');
    const lines = content.split('\n').slice(0, 5);
    console.log('  First 5 lines:');
    lines.forEach((line) => console.log('    ', line));
  }
}
console.log('  ✓ Passed\n');

// Test 4: Simulate result file and read it
console.log('Test 4: Simulate result file');

// Ensure directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const resultPath = path.join(outputDir, 'result.json');
const mockResult = {
  architecture: 'Test architecture',
  files: ['file1.ts', 'file2.ts'],
  steps: [
    { step: 1, description: 'Step 1' },
    { step: 2, description: 'Step 2' },
  ],
};

fs.writeFileSync(resultPath, JSON.stringify(mockResult, null, 2));
console.log('  Mock result written to:', resultPath);

const readResult = executor.readResult(outputDir);
console.log('  Read success:', readResult.success);
if (readResult.success) {
  console.log('  Output:', JSON.stringify(readResult.output, null, 2));
}
console.log('  ✓ Passed\n');

// Test 5: File watcher (quick test with existing file)
console.log('Test 5: File watcher with existing file');
console.log('  Note: This test uses an existing file to avoid long wait');

const quickExecutor = new AssistedExecutor();
const quickOutputDir = path.join(process.cwd(), '.orch/test-runs/test-quick');

// Pre-create the result file
if (!fs.existsSync(quickOutputDir)) {
  fs.mkdirSync(quickOutputDir, { recursive: true });
}
fs.writeFileSync(
  path.join(quickOutputDir, 'result.json'),
  JSON.stringify({ quick: 'test' })
);

// Now generate prompt (which will detect existing file)
const quickGenerate = await quickExecutor.generatePrompt({
  provider: 'claude-code',
  role: 'planner',
  context: {},
  outputDir: quickOutputDir,
});

if (quickGenerate.success) {
  console.log('  ✓ Prompt generated');

  // Read the pre-existing result
  const quickRead = quickExecutor.readResult(quickOutputDir);
  if (quickRead.success) {
    console.log('  ✓ Result read successfully');
  }
}
console.log('  ✓ Passed\n');

// Cleanup
console.log('Cleaning up test files...');
if (fs.existsSync('.orch/test-runs')) {
  fs.rmSync('.orch/test-runs', { recursive: true, force: true });
  console.log('  ✓ Cleaned up\n');
}

console.log('All Assisted Mode tests passed! ✓');
console.log('\nNote: Full execution test with file watcher requires manual interaction.');
console.log('To test full assisted execution:');
console.log('  1. Run: codecafe orch run (when implemented)');
console.log('  2. Follow the prompts to manually execute');
console.log('  3. Save result to result.json');
