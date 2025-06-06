/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runNonInteractive } from './nonInteractiveCli.js';
import { Config } from '@gemini-code/core';

vi.mock('@gemini-code/core', async (importOriginal) => {
  const actualCore = await importOriginal<typeof import('@gemini-code/core')>();
  return {
    ...actualCore,
    ChatSession: vi.fn(),
  };
});

describe('runNonInteractive', () => {
  let mockConfig: Config;
  let mockProcessStdoutWrite: ReturnType<typeof vi.fn>;
  let mockProcessExit: ReturnType<typeof vi.fn>;
  let mockSendMessage: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockSendMessage = vi.fn();
    const MockChatSession = vi.mocked((await import('@gemini-code/core')).ChatSession);
    MockChatSession.mockImplementation(() => ({
      sendMessage: mockSendMessage,
    }) as any);

    mockConfig = {} as Config;
    mockProcessStdoutWrite = vi.fn();
    process.stdout.write = mockProcessStdoutWrite;
    mockProcessExit = vi.fn() as any;
    process.exit = mockProcessExit;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should process input and write text output', async () => {
    mockSendMessage.mockImplementation(async function* () {
      yield { type: 'text', content: 'Hello' };
      yield { type: 'text', content: ' World' };
    });

    await runNonInteractive(mockConfig, 'Test input');

    expect(mockSendMessage).toHaveBeenCalledWith('Test input');
    expect(mockProcessStdoutWrite).toHaveBeenCalledWith('Hello');
    expect(mockProcessStdoutWrite).toHaveBeenCalledWith(' World');
    expect(mockProcessStdoutWrite).toHaveBeenCalledWith('\n');
  });

  it('should handle a single tool call and respond', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockSendMessage.mockImplementation(async function* () {
      yield { type: 'tool_code', content: '{"name":"testTool"}' };
      yield { type: 'tool_result', name: 'testTool', content: 'Success' };
      yield { type: 'text', content: 'Final answer' };
    });

    await runNonInteractive(mockConfig, 'Use a tool');

    expect(consoleLogSpy).toHaveBeenCalledWith('\nTool Call:\n{"name":"testTool"}');
    expect(consoleLogSpy).toHaveBeenCalledWith('\nTool Result (testTool):\nSuccess');
    expect(mockProcessStdoutWrite).toHaveBeenCalledWith('Final answer');
    consoleLogSpy.mockRestore();
  });

  it('should handle error during tool execution', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSendMessage.mockImplementation(async function* () {
      yield { type: 'tool_code', content: '{"name":"errorTool"}' };
      yield {
        type: 'tool_result',
        name: 'errorTool',
        content: 'Failure',
        isError: true,
      };
      yield { type: 'text', content: 'Could not complete.' };
    });

    await runNonInteractive(mockConfig, 'Trigger tool error');

    expect(consoleLogSpy).toHaveBeenCalledWith(
      '\nTool Result (errorTool):\nFailure'
    );
    expect(mockProcessStdoutWrite).toHaveBeenCalledWith('Could not complete.');
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should exit with error if sendMessage throws', async () => {
    const apiError = new Error('API connection failed');
    mockSendMessage.mockImplementation(async function* () {
      throw apiError;
    });
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await runNonInteractive(mockConfig, 'Initial fail');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error processing input:',
      apiError
    );
    expect(mockProcessExit).toHaveBeenCalledWith(1);
    consoleErrorSpy.mockRestore();
  });
});
