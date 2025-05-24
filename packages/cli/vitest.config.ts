/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    outputFile: {
      junit: 'junit.xml' // Configure JUnit output file here
    },
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: [
        ['text', { file: 'full-text-summary.txt' }], // Text summary to file
        'html',
        'json', // Detailed JSON to coverage/coverage-final.json by default
        'lcov',
        'cobertura',
        ['json-summary', { outputFile: 'coverage-summary.json' }] // Summary JSON to file
      ]
    }
  },
});
