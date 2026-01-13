/**
 * Vitest test setup file
 * Runs before all tests
 */

import { beforeAll, afterAll } from 'vitest';

// Set NODE_ENV to test (enables MockProviderAdapter)
process.env.NODE_ENV = 'test';

beforeAll(() => {
  console.log('Test suite starting...');
});

afterAll(() => {
  console.log('Test suite finished.');
});
