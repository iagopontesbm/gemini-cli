/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { test, expect } from '@jest/globals';
import { TestRun } from '../test-helper';

test('should be able to run a shell command', async () => {
  const testRun = new TestRun();
  try {
    const prompt = 'Can you run the command "echo hello world"';
    const result = await testRun.run(prompt);
    expect(result.stdout).toContain('hello world');
  } finally {
    testRun.cleanUp();
  }
});
