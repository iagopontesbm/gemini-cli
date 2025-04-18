// packages/cli/src/ui/App.test.tsx
import React from 'react';
import { render, cleanup } from 'ink-testing-library';
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { App } from './App.js';
import { useGeminiStream } from './hooks/useGeminiStream.js';
import { StreamingState } from '../core/gemini-stream.js';
import fs from 'fs';
import { Config, loadConfig, globalConfig } from '../config/config.js';

// --- Mocks ---

// Mock config loader
vi.mock('../config/config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config/config.js')>();
  return {
    ...actual, // Keep other exports like Config class
    loadConfig: vi.fn(), // Mock loadConfig
    globalConfig: new actual.Config('', 'test-model-v1', ''), // Provide a default mock instance initially if needed
  };
});

// Mock the useGeminiStream hook
vi.mock('./hooks/useGeminiStream.js', () => ({
  useGeminiStream: vi.fn(),
}));

// Mock fs/path/os used for warnings check
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual, // Keep actual fs functions
    // Override specific functions needed for tests
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});
vi.mock(
  'path',
  async (importOriginal: () => Promise<typeof import('path')>) => {
    const originalPath = await importOriginal();
    return {
      ...originalPath,
      default: originalPath,
      join: originalPath.join,
      resolve: originalPath.resolve,
      relative: originalPath.relative,
    };
  },
);
vi.mock('os', async (importOriginal: () => Promise<typeof import('os')>) => {
  const originalOs = await importOriginal();
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
    // No need to mock fs.existsSync directly here anymore, the module mock handles it.
    // (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    // Set the mock return value for loadConfig *before* App renders
    (loadConfig as ReturnType<typeof vi.fn>).mockReturnValue(
      new Config('test-key', 'test-model-v1', '/test/dir'),
    );
    // We don't call initializeConfig or globalConfig here anymore
    setupMocks(); // Default setup
  });

  afterEach(() => {
    cleanup();
    vi.resetModules();
  });

  // --- Tests ---
  test('should render initial placeholder with model', () => {
    // globalConfig should now be the mocked instance via loadConfig mock
    const { lastFrame } = render(
      <App directory={globalConfig.getTargetDir()} />,
    ); // Use mocked globalConfig if needed
    expect(lastFrame()).toContain('Ask Gemini (test-model-v1)');
  });

  test('should render InputPrompt with initial empty query', () => {
    const { lastFrame } = render(<App directory="/test/dir" />); // Use direct render or mocked config
    expect(lastFrame()).toContain(
      '> Ask Gemini (test-model-v1)... (try "/init" or "/help")',
    );
  });

  // Navigation tests are now in useInputNavigation.test.ts
});
