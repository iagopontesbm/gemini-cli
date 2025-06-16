/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { test, expect } from '@jest/globals';
import { TestRun } from '../test-helper';

test('should be able to fetch a url', async () => {
  const testRun = new TestRun();
  try {
    const prompt = 'Can you fetch the content from https://www.google.com';
    const result = await testRun.run(prompt);
    expect(result.stdout).toContain('<title>Google</title>');
  } finally {
    testRun.cleanUp();
  }
});
