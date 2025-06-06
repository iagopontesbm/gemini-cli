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

import { spawnSync } from 'child_process';
import { join } from 'path';

const root = join(import.meta.dirname, '..');

const isSandboxEnabled = process.env.SANDBOX_ENABLED === '1' || process.env.SANDBOX_ENABLED === 'true';
const isQuiet = process.argv[2] === '-q';

if (isSandboxEnabled) {
  if (isQuiet) {
    process.exit(0);
  }
  // This will likely fail on Windows if sandbox.sh is not cross-platform
  const result = spawnSync('bash', [join(root, 'scripts/sandbox.sh'), ...process.argv.slice(2)], { stdio: 'inherit' });
  process.exit(result.status ?? 1);
} else {
  if (isQuiet) {
    process.exit(1);
  }
  console.log("Sandboxing is not enabled.");
  process.exit(1);
}
