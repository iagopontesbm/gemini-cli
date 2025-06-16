/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { test } from 'node:test';
import { strict as assert } from 'assert';
import { TestRig } from './test-helper.js';
import * as fs from 'fs';
import * as path from 'path';

test('should be able to read multiple files', async (t) => {
  const rig = new TestRig();
  rig.setup(t.name);
  fs.writeFileSync(path.join(rig.testDir, 'file1.txt'), 'file 1 content');
  fs.writeFileSync(path.join(rig.testDir, 'file2.txt'), 'file 2 content');
  const prompt = `Can you read file1.txt and file2.txt`;
  const result = await rig.run(prompt);
  assert.ok(result.includes('file 1 content'));
  assert.ok(result.includes('file 2 content'));
});
