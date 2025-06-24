/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Config } from '../config/config.js';
import {
  setSimulate429,
  disableSimulationAfterFallback,
  shouldSimulate429,
} from './testUtils.js';
import { DEFAULT_GEMINI_FLASH_MODEL } from '../config/models.js';

describe('Flash Fallback Integration', () => {
  let config: Config;

  beforeEach(() => {
    config = new Config({
      sessionId: 'test-session',
      targetDir: '/test',
      debugMode: false,
      cwd: '/test',
      model: 'gemini-2.5-pro',
    });

    // Reset simulation state
    setSimulate429(false);
  });

  it('should automatically accept fallback', async () => {
    // Set up a minimal flash fallback handler for testing
    const flashFallbackHandler = async (): Promise<boolean> => true;

    config.setFlashFallbackHandler(flashFallbackHandler);

    // Call the handler directly to test
    const result = await config.flashFallbackHandler!(
      'gemini-2.5-pro',
      DEFAULT_GEMINI_FLASH_MODEL,
    );

    // Verify it automatically accepts
    expect(result).toBe(true);
  });

  it('should disable simulation after fallback', () => {
    // Enable simulation
    setSimulate429(true);

    // Verify simulation is enabled
    expect(shouldSimulate429()).toBe(true);

    // Disable simulation after fallback
    disableSimulationAfterFallback();

    // Verify simulation is now disabled
    expect(shouldSimulate429()).toBe(false);
  });
});
