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

test('should be able to replace content in a file', async (t) => {
  const rig = new TestRig();
  rig.setup(t.name);
  const filePath = path.join(rig.testDir, 'file_to_replace.txt');
  fs.writeFileSync(filePath, 'original content');
  const prompt =
    'Can you replace "original" with "replaced" in the file "file_to_replace.txt"';
  await rig.run(prompt);
  const newFileContent = fs.readFileSync(filePath, 'utf-8');
  assert.strictEqual(newFileContent, 'replaced content');
});
