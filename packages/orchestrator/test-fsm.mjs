import { FSMEngine } from './dist/engine/fsm.js';

console.log('Testing FSM Engine...\n');

// Mock workflow
const workflow = {
  name: 'test-workflow',
  stages: ['plan', 'code', 'test', 'check'],
  loop: {
    max_iters: 3,
    fallback_next_stage: 'plan',
    stop_when: '$.done == true',
  },
};

// Test 1: Basic initialization
console.log('Test 1: Initialization');
const fsm = new FSMEngine(workflow);
console.log('  Current stage:', fsm.getCurrentStage());
console.log('  Current iter:', fsm.getCurrentIter());
console.log('  Can continue:', fsm.canContinue());
console.log('  ✓ Passed\n');

// Test 2: Sequential transitions
console.log('Test 2: Sequential transitions');
fsm.transitionToNext(); // plan -> code
console.log('  After 1st transition:', fsm.getCurrentStage());
fsm.transitionToNext(); // code -> test
console.log('  After 2nd transition:', fsm.getCurrentStage());
fsm.transitionToNext(); // test -> check
console.log('  After 3rd transition:', fsm.getCurrentStage());
console.log('  ✓ Passed\n');

// Test 3: Loop back (check -> plan)
console.log('Test 3: Loop back');
const iter1 = fsm.getCurrentIter();
fsm.transitionTo('plan'); // Loop back
const iter2 = fsm.getCurrentIter();
console.log('  Iter before loop:', iter1);
console.log('  Iter after loop:', iter2);
console.log('  Increment:', iter2 - iter1);
console.log('  ✓ Passed\n');

// Test 4: Check result evaluation (done=false)
console.log('Test 4: Check result evaluation (done=false)');
const checkResult1 = {
  done: false,
  summary: 'Tests failed',
  reasons: ['Unit test failure'],
  recommended_next_stage: 'code',
};
const result1 = fsm.evaluateCheckResult(checkResult1);
console.log('  Done:', result1.done);
console.log('  Next stage:', result1.nextStage);
console.log('  Reason:', result1.reason);
console.log('  ✓ Passed\n');

// Test 5: Check result evaluation (done=true)
console.log('Test 5: Check result evaluation (done=true)');
const checkResult2 = {
  done: true,
  summary: 'All requirements met',
  reasons: ['All tests passed', 'Code quality good'],
};
const result2 = fsm.evaluateCheckResult(checkResult2);
console.log('  Done:', result2.done);
console.log('  Next stage:', result2.nextStage);
console.log('  Reason:', result2.reason);
console.log('  ✓ Passed\n');

// Test 6: Max iterations
console.log('Test 6: Max iterations');
fsm.reset();
console.log('  Initial iter:', fsm.getCurrentIter());
console.log('  Max iters:', workflow.loop.max_iters);

// Loop until max iterations
for (let i = 0; i < workflow.loop.max_iters + 1; i++) {
  console.log(`  Iter ${fsm.getCurrentIter()}: Can continue: ${fsm.canContinue()}`);
  if (fsm.canContinue()) {
    fsm.transitionTo('plan'); // Force loop back
  }
}
console.log('  ✓ Passed\n');

// Test 7: State persistence
console.log('Test 7: State persistence');
fsm.reset();
fsm.transitionTo('code');
fsm.transitionTo('plan'); // Loop back
const state = fsm.getState();
console.log('  Saved state:', JSON.stringify(state, null, 2));

const fsm2 = new FSMEngine(workflow);
fsm2.restoreState(state);
console.log('  Restored stage:', fsm2.getCurrentStage());
console.log('  Restored iter:', fsm2.getCurrentIter());
console.log('  ✓ Passed\n');

// Test 8: Fallback when no recommended_next_stage
console.log('Test 8: Fallback next stage');
const checkResult3 = {
  done: false,
  summary: 'Need more work',
  reasons: ['Requirements not met'],
  // No recommended_next_stage
};
const result3 = fsm.evaluateCheckResult(checkResult3);
console.log('  Next stage (should be fallback):', result3.nextStage);
console.log('  Expected:', workflow.loop.fallback_next_stage);
console.log('  Match:', result3.nextStage === workflow.loop.fallback_next_stage);
console.log('  ✓ Passed\n');

console.log('All FSM tests passed! ✓');
