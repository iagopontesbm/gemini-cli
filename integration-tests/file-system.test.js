/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { strict as assert } from 'assert';
import { test } from 'node:test';
import { TestRig } from './test-helper.js';

test('reads a file', () => {
  const rig = new TestRig();
  try {
    rig.createFile('test.txt', 'hello world');
    const output = rig.run('read the file name test.txt');
    assert.ok(output.includes('hello world'));
  } finally {
    rig.cleanup();
  }
});

test('writes a file', () => {
  const rig = new TestRig();
  try {
    rig.run('edit test.txt to have a hello world message', '-y');
    const fileContent = rig.readFile('test.txt');
    assert.ok(fileContent.includes('hello world'));
  } finally {
    rig.cleanup();
  }
});
