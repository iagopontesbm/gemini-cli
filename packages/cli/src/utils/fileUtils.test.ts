/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile } from './fileUtils';
import { expect, test } from 'vitest';
import fs from 'fs/promises';
import path from 'path';

test('readFile reads and parses a TSV file', async () => {
  const tsvContent = `col1\tcol2\nval1\tval2`;
  const tsvPath = path.resolve(__dirname, 'test.tsv');
  await fs.writeFile(tsvPath, tsvContent);

  const data = await readFile(tsvPath);
  expect(data).toEqual([{ col1: 'val1', col2: 'val2' }]);

  await fs.unlink(tsvPath);
});
