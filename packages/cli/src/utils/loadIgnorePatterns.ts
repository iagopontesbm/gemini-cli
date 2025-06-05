/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Loads and parses a .geminiignore file from the given workspace root.
 * @param workspaceRoot The absolute path to the workspace root.
 * @returns A promise that resolves to an array of glob patterns.
 */
export function loadGeminiIgnorePatterns(
  workspaceRoot: string,
): string[] {
  const ignoreFilePath = path.join(workspaceRoot, '.geminiignore');
  const patterns: string[] = [];

  try {
    const fileContent = fs.readFileSync(ignoreFilePath, 'utf-8');
    const lines = fileContent.split(/\r?\n/);

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        patterns.push(trimmedLine);
      }
    }
    if (patterns.length > 0) {
      console.log(`[INFO] Loaded ${patterns.length} patterns from .geminiignore`);
    }
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && typeof error.code === 'string') {
      if (error.code === 'ENOENT') {
        // .geminiignore not found, which is fine.
        console.log('[INFO] No .geminiignore file found. Proceeding without custom ignore patterns.');
      } else {
        // Other error reading the file (e.g., permissions)
        console.warn(
          `[WARN] Could not read .geminiignore file at ${ignoreFilePath}: ${error.message}`,
        );
      }
    } else {
      // For other types of errors, or if code is not available
      console.warn(
        `[WARN] An unexpected error occurred while trying to read ${ignoreFilePath}: ${String(error)}`,
      );
    }
  }
  return patterns;
} 