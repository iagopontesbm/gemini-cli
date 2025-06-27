/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from 'ink-testing-library';
import { act } from 'react-dom/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileContextProvider, useFileContext } from './FileContextContext.js';
import { Config } from '@google/gemini-cli-core';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs module
vi.mock('fs/promises');
vi.mock('path');

const mockFs = vi.mocked(fs);
const mockPath = vi.mocked(path);

// Mock Config
const mockConfig = {
  getTargetDir: () => '/test/project',
} as unknown as Config;

// Test component that uses the context
const TestComponent = () => {
  const { state, actions } = useFileContext();
  
  return (
    <div>
      <div>Files: {state.totalFiles}</div>
      <div>Tokens: {state.totalTokens}</div>
      <button onClick={() => actions.addFile('test.txt')}>
        Add File
      </button>
      <button onClick={() => actions.removeFile('test.txt')}>
        Remove File
      </button>
      <button onClick={() => actions.clearContext()}>
        Clear Context
      </button>
    </div>
  );
};

describe('FileContextContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock path.resolve
    mockPath.resolve.mockReturnValue('/test/project/test.txt');
    
    // Mock fs.stat
    mockFs.stat.mockResolvedValue({
      isDirectory: () => false,
      size: 1024,
    } as any);
  });

  it('should provide initial state', () => {
    const { lastFrame } = render(
      <FileContextProvider config={mockConfig}>
        <TestComponent />
      </FileContextProvider>
    );

    expect(lastFrame()).toContain('Files: 0');
    expect(lastFrame()).toContain('Tokens: 0');
  });

  it('should add files to context', async () => {
    const { lastFrame, stdin } = render(
      <FileContextProvider config={mockConfig}>
        <TestComponent />
      </FileContextProvider>
    );

    await act(async () => {
      stdin.write('a'); // Simulate clicking Add File
    });

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(lastFrame()).toContain('Files: 1');
    expect(lastFrame()).toContain('Tokens: 256'); // 1024 / 4
  });

  it('should remove files from context', async () => {
    const { lastFrame, stdin } = render(
      <FileContextProvider config={mockConfig}>
        <TestComponent />
      </FileContextProvider>
    );

    // Add file first
    await act(async () => {
      stdin.write('a'); // Simulate clicking Add File
    });

    await new Promise(resolve => setTimeout(resolve, 0));

    // Remove file
    await act(async () => {
      stdin.write('r'); // Simulate clicking Remove File
    });

    expect(lastFrame()).toContain('Files: 0');
    expect(lastFrame()).toContain('Tokens: 0');
  });

  it('should clear context', async () => {
    const { lastFrame, stdin } = render(
      <FileContextProvider config={mockConfig}>
        <TestComponent />
      </FileContextProvider>
    );

    // Add file first
    await act(async () => {
      stdin.write('a'); // Simulate clicking Add File
    });

    await new Promise(resolve => setTimeout(resolve, 0));

    // Clear context
    await act(async () => {
      stdin.write('c'); // Simulate clicking Clear Context
    });

    expect(lastFrame()).toContain('Files: 0');
    expect(lastFrame()).toContain('Tokens: 0');
  });

  it('should prevent adding duplicate files', async () => {
    const { lastFrame, stdin } = render(
      <FileContextProvider config={mockConfig}>
        <TestComponent />
      </FileContextProvider>
    );

    // Add file twice
    await act(async () => {
      stdin.write('a'); // Simulate clicking Add File
      stdin.write('a'); // Simulate clicking Add File again
    });

    await new Promise(resolve => setTimeout(resolve, 0));

    // Should only have one file
    expect(lastFrame()).toContain('Files: 1');
  });

  it('should handle file not found errors', async () => {
    // Mock fs.stat to throw error
    mockFs.stat.mockRejectedValue(new Error('File not found'));

    const { lastFrame, stdin } = render(
      <FileContextProvider config={mockConfig}>
        <TestComponent />
      </FileContextProvider>
    );

    await act(async () => {
      stdin.write('a'); // Simulate clicking Add File
    });

    await new Promise(resolve => setTimeout(resolve, 0));

    // Should not add file
    expect(lastFrame()).toContain('Files: 0');
  });

  it('should skip directories', async () => {
    // Mock fs.stat to return directory
    mockFs.stat.mockResolvedValue({
      isDirectory: () => true,
      size: 0,
    } as any);

    const { lastFrame, stdin } = render(
      <FileContextProvider config={mockConfig}>
        <TestComponent />
      </FileContextProvider>
    );

    await act(async () => {
      stdin.write('a'); // Simulate clicking Add File
    });

    await new Promise(resolve => setTimeout(resolve, 0));

    // Should not add directory
    expect(lastFrame()).toContain('Files: 0');
  });
}); 