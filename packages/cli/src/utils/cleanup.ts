/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { getProjectTempDir } from '@google/gemini-cli-core';

const MAX_CHECKPOINTS = 5; // Keep the 5 most recent checkpoints

export async function cleanupOldCheckpoints() {
  const tempDir = getProjectTempDir(process.cwd());
  const checkpointsDir = join(tempDir, 'checkpoints');

  try {
    await fs.mkdir(checkpointsDir, { recursive: true });
    const files = await fs.readdir(checkpointsDir);
    const checkpointFiles = files
      .map((file) => ({
        name: file,
        path: join(checkpointsDir, file),
      }))
      .filter((file) => file.name.startsWith('session-')); // Filter for session checkpoint files

    const sortedFiles = await Promise.all(
      checkpointFiles.map(async (file) => {
        const stats = await fs.stat(file.path);
        return { ...file, mtimeMs: stats.mtimeMs };
      }),
    );

    sortedFiles.sort((a, b) => b.mtimeMs - a.mtimeMs); // Sort by modification time, newest first

    for (let i = MAX_CHECKPOINTS; i < sortedFiles.length; i++) {
      await fs.unlink(sortedFiles[i].path); // Delete older checkpoints
    }
  } catch (error) {
    // Ignore errors if the directory doesn't exist or fails to delete/read files.
    console.warn(`Error during checkpoint cleanup: ${error}`);
  }
}
