/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { test } from 'node:test';
import { strict as assert } from 'assert';
import { TestRig } from './test-helper.js';

test('should be able to fetch a url', async (t) => {
  const rig = new TestRig();
  rig.setup(t.name);
  const prompt = 'Can you fetch the content from https://www.google.com';
  const result = await rig.run(prompt);
  assert.ok(result.toLowerCase().includes('<title>google</title>'));
});
