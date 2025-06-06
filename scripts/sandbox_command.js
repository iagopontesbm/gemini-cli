/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import os from 'os';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import dotenv from 'dotenv';

const argv = yargs(hideBin(process.argv))
  .option('q', {
    alias: 'quiet',
    type: 'boolean',
    default: false,
  }).argv;

let geminiSandbox = process.env.GEMINI_SANDBOX;

if (!geminiSandbox) {
  const userSettingsFile = join(os.homedir(), '.gemini', 'settings.json');
  if (existsSync(userSettingsFile)) {
    const settings = JSON.parse(readFileSync(userSettingsFile, 'utf-8'));
    if (settings.sandbox) {
      geminiSandbox = settings.sandbox;
    }
  }
}

if (!geminiSandbox) {
  let currentDir = process.cwd();
  while (currentDir !== '/') {
    const geminiEnv = join(currentDir, '.gemini', '.env');
    const regularEnv = join(currentDir, '.env');
    if (existsSync(geminiEnv)) {
      dotenv.config({ path: geminiEnv });
      break;
    } else if (existsSync(regularEnv)) {
      dotenv.config({ path: regularEnv });
      break;
    }
    currentDir = dirname(currentDir);
  }
  geminiSandbox = process.env.GEMINI_SANDBOX;
}

if (process.env.GEMINI_CODE_SANDBOX) {
  console.warn("WARNING: GEMINI_CODE_SANDBOX is deprecated. Use GEMINI_SANDBOX instead.");
  geminiSandbox = process.env.GEMINI_CODE_SANDBOX;
}

geminiSandbox = (geminiSandbox || '').toLowerCase();

let command = '';
if (['1', 'true'].includes(geminiSandbox)) {
  try {
    execSync('command -v docker', { stdio: 'ignore' });
    command = 'docker';
  } catch {
    try {
      execSync('command -v podman', { stdio: 'ignore' });
      command = 'podman';
    } catch {
      console.error("ERROR: install docker or podman or specify command in GEMINI_SANDBOX");
      process.exit(1);
    }
  }
} else if (geminiSandbox && !['0', 'false'].includes(geminiSandbox)) {
  try {
    execSync(`command -v ${geminiSandbox}`, { stdio: 'ignore' });
    command = geminiSandbox;
  } catch {
    console.error(`ERROR: missing sandbox command '${geminiSandbox}' (from GEMINI_SANDBOX)`);
    process.exit(1);
  }
} else {
  if (os.platform() === 'darwin' && process.env.SEATBELT_PROFILE !== 'none') {
    try {
      execSync('command -v sandbox-exec', { stdio: 'ignore' });
      command = 'sandbox-exec';
    } catch {
      process.exit(1);
    }
  } else {
    process.exit(1);
  }
}

if (!argv.q) {
  console.log(command);
}
process.exit(0);
