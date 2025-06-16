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

test('should be able to list a directory', async (t) => {
  const rig = new TestRig();
  rig.setup(t.name);
  fs.writeFileSync(path.join(rig.testDir, 'file1.txt'), 'file 1 content');
  fs.mkdirSync(path.join(rig.testDir, 'subdir'));
  const prompt = 'Can you list the files in the current directory';
  const result = await rig.run(prompt);
  assert.ok(result.includes('file1.txt'));
  assert.ok(result.includes('subdir'));
});
