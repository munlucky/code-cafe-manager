import { loadWorkflow, loadStageProfile } from './dist/schema/validator.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function test() {
  console.log('Testing validator...\n');

  // Test workflow validation
  console.log('1. Testing workflow validation:');
  const workflowPath = path.join(__dirname, 'templates/workflows/default.workflow.yml');
  const workflowResult = await loadWorkflow(workflowPath);
  
  if (workflowResult.valid) {
    console.log('✓ Workflow validation passed');
    console.log('  Data:', JSON.stringify(workflowResult.data, null, 2));
  } else {
    console.log('✗ Workflow validation failed');
    console.log('  Errors:', workflowResult.errors);
  }

  // Test stage profile validation
  console.log('\n2. Testing stage profile validation:');
  const profilePath = path.join(__dirname, 'templates/workflows/stages/plan.simple.yml');
  const profileResult = await loadStageProfile(profilePath);
  
  if (profileResult.valid) {
    console.log('✓ Stage profile validation passed');
    console.log('  Data:', JSON.stringify(profileResult.data, null, 2));
  } else {
    console.log('✗ Stage profile validation failed');
    console.log('  Errors:', profileResult.errors);
  }

  // Test committee profile
  console.log('\n3. Testing committee profile validation:');
  const committeePath = path.join(__dirname, 'templates/workflows/stages/plan.committee.yml');
  const committeeResult = await loadStageProfile(committeePath);
  
  if (committeeResult.valid) {
    console.log('✓ Committee profile validation passed');
  } else {
    console.log('✗ Committee profile validation failed');
    console.log('  Errors:', committeeResult.errors);
  }
}

test().catch(console.error);
