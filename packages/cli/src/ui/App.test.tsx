// packages/cli/src/ui/App.test.tsx
import React from 'react';
import { render, cleanup } from 'ink-testing-library';
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { App } from './App.js';
import { useGeminiStream } from './hooks/useGeminiStream.js';
import { StreamingState } from '../core/gemini-stream.js';
import fs from 'fs';
import { initializeConfig } from '../config/globalConfig.js';

// --- Mocks ---

// Mock the useGeminiStream hook
vi.mock('./hooks/useGeminiStream.js', () => ({
  useGeminiStream: vi.fn(),
}));

// Mock fs/path/os used for warnings check
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}));
vi.mock('path', async (importOriginal) => {
  const originalPath = await importOriginal<typeof import('path')>();
  return {
    ...originalPath,
    default: originalPath,
    join: originalPath.join,
    resolve: originalPath.resolve,
    relative: originalPath.relative,
  };
});
vi.mock('os', async (importOriginal) => {
  const originalOs = await importOriginal<typeof import('os')>();
  return {
    ...originalOs,
    default: originalOs,
    tmpdir: vi.fn().mockReturnValue('/tmp'),
  };
});

// --- Test Suite ---
describe('App Component Rendering', () => {
  let mockSubmitQuery: ReturnType<typeof vi.fn>;

  // Helper to setup mocks (without history state mocking)
  const setupMocks = () => {
    mockSubmitQuery = vi.fn().mockResolvedValue(undefined);

    // Mock useGeminiStream hook
    (useGeminiStream as ReturnType<typeof vi.fn>).mockReturnValue({
      streamingState: StreamingState.Idle,
      submitQuery: mockSubmitQuery,
      initError: null,
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    initializeConfig({ model: 'test-model-v1' });
    setupMocks(); // Default setup
  });

  afterEach(() => {
    cleanup();
    vi.resetModules();
  });

  // --- Tests ---
  test('should render initial placeholder with model', () => {
    const { lastFrame } = render(<App directory="/test/dir" />); // Use direct render
    expect(lastFrame()).toContain('Ask Gemini (test-model-v1)');
  });

  test('should render InputPrompt with initial empty query', () => {
    const { lastFrame } = render(<App directory="/test/dir" />); // Use direct render
    expect(lastFrame()).toContain('> Ask Gemini (test-model-v1)... (try "/init" or "/help")');
  });

  // Navigation tests are now in useInputNavigation.test.ts

});
