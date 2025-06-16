/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { test, expect } from '@jest/globals';
import { TestRun } from '../test-helper';
import * as fs from 'fs';
import * as path from 'path';

test('should be able to read multiple files', async () => {
  const testRun = new TestRun();
  try {
    fs.writeFileSync(
      path.join(testRun.testDirectory, 'file1.txt'),
      'file 1 content',
    );
    fs.writeFileSync(
      path.join(testRun.testDirectory, 'file2.txt'),
      'file 2 content',
    );
    const prompt = 'Can you read file1.txt and file2.txt';
    const result = await testRun.run(prompt);
    expect(result.stdout).toContain('file 1 content');
    expect(result.stdout).toContain('file 2 content');
  } finally {
    testRun.cleanUp();
  }
});
