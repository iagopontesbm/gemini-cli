/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from 'child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { env } from 'process';

const __dirname = dirname(fileURLToPath(import.meta.url));

function sanitizeTestName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-');
}

export class TestRig {
  constructor() {
    this.bundlePath = join(__dirname, '..', 'bundle/gemini.js');
    this.testDir = null;
  }

  setup(testName) {
    const sanitizedName = sanitizeTestName(testName);
    this.testDir = join(env.INTEGRATION_TEST_FILE_DIR, sanitizedName);
    mkdirSync(this.testDir, { recursive: true });
  }

  createFile(fileName, content) {
    const filePath = join(this.testDir, fileName);
    writeFileSync(filePath, content);
    return filePath;
  }

  run(prompt, ...args) {
    const output = execSync(
      `node ${this.bundlePath} --prompt "${prompt}" ${args.join(' ')}`,
      {
        cwd: this.testDir,
        encoding: 'utf-8',
      },
    );

    if (env.KEEP_OUTPUT === 'true') {
      console.log('--- CLI Output ---');
      console.log(output);
      console.log('--- End CLI Output ---');
    }

    return output;
  }

  readFile(fileName) {
    const content = readFileSync(join(this.testDir, fileName), 'utf-8');
    if (env.KEEP_OUTPUT === 'true') {
      console.log(`--- File Content: ${fileName} ---`);
      console.log(content);
      console.log(`--- End File Content: ${fileName} ---`);
    }
    return content;
  }
}
