/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { test, expect } from '@jest/globals';
import { TestRun } from '../test-helper';

test('should be able to search the web', async () => {
  const testRun = new TestRun();
  try {
    const prompt = 'what planet do we live on';
    const result = await testRun.run(prompt);
    expect(result.stdout).toContain('Earth');
  } finally {
    testRun.cleanUp();
  }
});
