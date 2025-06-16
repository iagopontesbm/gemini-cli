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

test('should be able to write a file', async (t) => {
  const rig = new TestRig();
  rig.setup(t.name);
  const prompt = 'Can you write a file named "new_file.txt" with the content "new file content"';
  await rig.run(prompt);
  const newFilePath = path.join(rig.testDir, 'new_file.txt');
  assert.ok(fs.existsSync(newFilePath));
  const newFileContent = fs.readFileSync(newFilePath, 'utf-8');
  assert.strictEqual(newFileContent, 'new file content');
});

