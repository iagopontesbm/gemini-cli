/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawnSync } from 'child_process';
import { mkdirSync, rmSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const integrationTestsDir = join(rootDir, '.integration-tests');

if (process.env.GEMINI_SANDBOX === 'docker') {
    console.log('Building sandbox for Docker...');
    const buildResult = spawnSync('npm', ['run', 'build:all'], { stdio: 'inherit' });
    if (buildResult.status !== 0) {
        console.error('Sandbox build failed.');
        process.exit(1);
    }
}

const runId = `${Date.now()}`;
const runDir = join(integrationTestsDir, runId);

mkdirSync(runDir, { recursive: true });

const args = process.argv.slice(2);
const keepOutputIndex = args.indexOf('--keep-output');
const keepOutput = keepOutputIndex !== -1;
if (keepOutput) {
    args.splice(keepOutputIndex, 1);
    console.log(`Keeping output for test run in: ${runDir}`);
}

const testPatterns = args.length > 0 ? args : ['integration-tests/*.test.js'];
const testFiles = glob.sync(testPatterns, { cwd: rootDir, absolute: true });

let allTestsPassed = true;

for (const testFile of testFiles) {
    const testFileName = basename(testFile);
    const testFileDir = join(runDir, testFileName);
    mkdirSync(testFileDir, { recursive: true });

    console.log(`Running test file: ${testFileName}`);
    const result = spawnSync(
        'node',
        ['--test', testFile],
        {
            stdio: 'inherit',
            env: {
                ...process.env,
                INTEGRATION_TEST_FILE_DIR: testFileDir,
            },
        }
    );

    if (result.status !== 0) {
        console.error(`Test file failed: ${testFileName}`);
        allTestsPassed = false;
    }
}

if (!keepOutput) {
    rmSync(runDir, { recursive: true, force: true });
}

if (!allTestsPassed) {
    console.error("One or more test files failed.");
    process.exit(1);
}