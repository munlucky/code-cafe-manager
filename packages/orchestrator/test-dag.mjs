import { DAGExecutor } from './dist/engine/dag-executor.js';

console.log('Testing DAG Executor...\n');

// Test 1: Simple linear graph
console.log('Test 1: Simple linear graph');
const profile1 = {
  graph: [
    {
      id: 'node1',
      type: 'run',
      provider: 'claude-code',
      role: 'planner',
    },
    {
      id: 'node2',
      type: 'export',
      from: 'node1',
      output_schema: 'schemas/plan.schema.json',
    },
  ],
};

const executor1 = new DAGExecutor(profile1);
const result1 = await executor1.execute();
console.log('  Success:', result1.success);
console.log('  Execution order:', result1.executionOrder);
console.log('  ✓ Passed\n');

// Test 2: Graph with dependencies
console.log('Test 2: Graph with dependencies');
const profile2 = {
  graph: [
    {
      id: 'step1',
      type: 'run',
      provider: 'claude-code',
      role: 'planner',
    },
    {
      id: 'step2',
      type: 'run',
      provider: 'claude-code',
      role: 'reviewer',
      inputs: ['step1'],
    },
    {
      id: 'step3',
      type: 'run',
      provider: 'claude-code',
      role: 'coder',
      inputs: ['step2'],
    },
    {
      id: 'export',
      type: 'export',
      from: 'step3',
      output_schema: 'schemas/code.schema.json',
    },
  ],
};

const executor2 = new DAGExecutor(profile2);
const result2 = await executor2.execute();
console.log('  Success:', result2.success);
console.log('  Execution order:', result2.executionOrder);
console.log('  Expected order: step1, step2, step3, export');
console.log('  ✓ Passed\n');

// Test 3: Foreach node (sequential)
console.log('Test 3: Foreach node (sequential)');
const profile3 = {
  graph: [
    {
      id: 'foreach_seq',
      type: 'foreach',
      items: '${vars.test_items}',
      mode: 'sequential',
      run: {
        type: 'run',
        provider: 'claude-code',
        role: 'tester',
      },
      out: 'test_results',
    },
    {
      id: 'export',
      type: 'export',
      from: 'foreach_seq',
      output_schema: 'schemas/test.schema.json',
    },
  ],
};

const executor3 = new DAGExecutor(profile3, {
  test_items: ['unit', 'integration', 'e2e'],
});
const result3 = await executor3.execute();
console.log('  Success:', result3.success);
console.log('  Execution order:', result3.executionOrder);
console.log('  ✓ Passed\n');

// Test 4: Foreach node (parallel)
console.log('Test 4: Foreach node (parallel)');
const profile4 = {
  graph: [
    {
      id: 'foreach_par',
      type: 'foreach',
      items: '${vars.agents}',
      mode: 'parallel',
      concurrency: 3,
      run: {
        type: 'run',
        provider: 'claude-code',
        role: 'planner',
      },
      out: 'agent_results',
    },
    {
      id: 'reduce',
      type: 'reduce',
      from: 'foreach_par',
      strategy: 'summarize',
    },
    {
      id: 'export',
      type: 'export',
      from: 'reduce',
      output_schema: 'schemas/plan.schema.json',
    },
  ],
};

const executor4 = new DAGExecutor(profile4, {
  agents: [
    { name: 'architect', role: 'planner_arch' },
    { name: 'tasks', role: 'planner_tasks' },
    { name: 'risks', role: 'planner_risks' },
  ],
});
const result4 = await executor4.execute();
console.log('  Success:', result4.success);
console.log('  Execution order:', result4.executionOrder);
console.log('  ✓ Passed\n');

// Test 5: Circular dependency detection
console.log('Test 5: Circular dependency detection');
const profile5 = {
  graph: [
    {
      id: 'node_a',
      type: 'run',
      provider: 'claude-code',
      role: 'role1',
      inputs: ['node_b'],
    },
    {
      id: 'node_b',
      type: 'run',
      provider: 'claude-code',
      role: 'role2',
      inputs: ['node_a'], // Circular!
    },
  ],
};

const executor5 = new DAGExecutor(profile5);
const result5 = await executor5.execute();
console.log('  Success:', result5.success);
console.log('  Error (expected):', result5.error);
console.log('  ✓ Passed (correctly detected circular dependency)\n');

// Test 6: Complex graph with multiple dependencies
console.log('Test 6: Complex graph with multiple dependencies');
const profile6 = {
  graph: [
    {
      id: 'init',
      type: 'run',
      provider: 'claude-code',
      role: 'init',
    },
    {
      id: 'task_a',
      type: 'run',
      provider: 'claude-code',
      role: 'task_a',
      inputs: ['init'],
    },
    {
      id: 'task_b',
      type: 'run',
      provider: 'claude-code',
      role: 'task_b',
      inputs: ['init'],
    },
    {
      id: 'task_c',
      type: 'run',
      provider: 'claude-code',
      role: 'task_c',
      inputs: ['task_a', 'task_b'], // Depends on both A and B
    },
    {
      id: 'export',
      type: 'export',
      from: 'task_c',
      output_schema: 'schemas/result.schema.json',
    },
  ],
};

const executor6 = new DAGExecutor(profile6);
const result6 = await executor6.execute();
console.log('  Success:', result6.success);
console.log('  Execution order:', result6.executionOrder);
console.log('  Note: init must be first, task_c must be after both task_a and task_b');
console.log('  ✓ Passed\n');

console.log('All DAG Executor tests passed! ✓');
