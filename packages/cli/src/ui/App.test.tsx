// packages/cli/src/ui/App.test.tsx
import React from 'react';
import { render, cleanup } from 'ink-testing-library';
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import App from './App.js';
import { useGeminiStream } from './hooks/useGeminiStream.js';
import { StreamingState } from '../core/gemini-stream.js';
import fs from 'fs';
import { Config, loadConfig, globalConfig } from '../config/config.js';

// --- Mocks ---

// Mock config loader
vi.mock('../config/config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config/config.js')>();
  return {
    ...actual,
    loadConfig: vi.fn(),
    globalConfig: new actual.Config('', 'test-model-v1', '/test/dir'),
  };
});

// Mock the useGeminiStream hook
vi.mock('./hooks/useGeminiStream.js', () => ({
  useGeminiStream: vi.fn(),
}));

// Mock the useInputNavigation hook (assuming App uses this now instead of useInputHistory)
vi.mock('./hooks/useInputNavigation.js', () => ({
  useInputNavigation: vi.fn(),
}));

// Mock fs (Corrected structure)
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

// Mock path (Corrected structure if needed, ensure default export)
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

// Mock os (Corrected structure if needed, ensure default export)
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

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();

    // Set the mock return value for loadConfig
    (loadConfig as ReturnType<typeof vi.fn>).mockReturnValue(
      new Config('test-key', 'test-model-v1', '/test/dir')
    );

    // Setup mock return values for hooks
    mockSubmitQuery = vi.fn().mockResolvedValue(undefined);
    (useGeminiStream as ReturnType<typeof vi.fn>).mockReturnValue({
      streamingState: StreamingState.Idle,
      submitQuery: mockSubmitQuery,
      initError: null,
    });

    // No need to mock useInputNavigation return value as it doesn't return anything

    // Mock fs.existsSync via the module mock
    // (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
    vi.resetModules();
  });

  // Helper function to render App (if needed, props might change)
  const renderApp = () => {
    // Pass necessary props, potentially using mocked globalConfig
    return render(<App directory={globalConfig.getTargetDir()} />);
  };

  // --- Tests ---
  test('should render initial placeholder with model', () => {
    const { lastFrame } = renderApp();
    // Check against the model from the mocked loadConfig
    expect(lastFrame()).toContain('Ask Gemini (test-model-v1)');
  });

  test('should render InputPrompt initially', () => {
    const { lastFrame } = renderApp();
    // Check for the input prompt placeholder text
    expect(lastFrame()).toContain('> Ask Gemini (test-model-v1)... (try "/init" or "/help")');
  });
});
