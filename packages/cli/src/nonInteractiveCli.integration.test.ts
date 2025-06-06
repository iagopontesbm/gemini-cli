/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Config } from '@gemini-code/core';

vi.mock('@gemini-code/core', async (importOriginal) => {
  const actualCore = await importOriginal<typeof import('@gemini-code/core')>();
  return {
    ...actualCore,
    ChatSession: vi.fn().mockImplementation(() => ({
      sendMessage: async function* (prompt: string) {
        if (prompt === 'use a tool') {
          yield {
            source: 'model',
            type: 'tool_code',
            content: JSON.stringify({ name: 'test_tool', args: {} }),
          };
          yield {
            source: 'model',
            type: 'tool_result',
            name: 'test_tool',
            content: 'tool output',
          };
          yield {
            source: 'model',
            type: 'text',
            content: 'Final answer',
          };
        } else {
          yield {
            source: 'model',
            type: 'text',
            content: 'Hello from Gemini',
          };
        }
      },
    })),
  };
});

describe('runNonInteractive - integration', () => {
  let mockConfig: Config;
  let mockProcessStdoutWrite: ReturnType<typeof vi.fn>;
  let mockConsoleLog: ReturnType<typeof vi.fn>;
  let mockProcessExit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockConfig = {} as Config;
    mockProcessStdoutWrite = vi.fn();
    mockConsoleLog = vi.fn();
    process.stdout.write = mockProcessStdoutWrite;
    console.log = mockConsoleLog;
    mockProcessExit = vi.fn() as unknown as typeof process.exit;
    process.exit = mockProcessExit;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should handle a simple prompt and print the response', async () => {
    const { runNonInteractive } = await import('./nonInteractiveCli.js');
    await runNonInteractive(mockConfig, 'A simple prompt');

    expect(mockProcessStdoutWrite).toHaveBeenCalledWith('Hello from Gemini');
    expect(mockProcessStdoutWrite).toHaveBeenCalledWith('\n');
    expect(mockProcessExit).not.toHaveBeenCalled();
  });

  it('should handle a tool call and print the response', async () => {
    const { runNonInteractive } = await import('./nonInteractiveCli.js');
    await runNonInteractive(mockConfig, 'use a tool');

    expect(mockConsoleLog).toHaveBeenCalledWith(
      '\nTool Call:\n{"name":"test_tool","args":{}}'
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      '\nTool Result (test_tool):\ntool output'
    );
    expect(mockProcessStdoutWrite).toHaveBeenCalledWith('Final answer');
    expect(mockProcessStdoutWrite).toHaveBeenCalledWith('\n');
    expect(mockProcessExit).not.toHaveBeenCalled();
  });
});
