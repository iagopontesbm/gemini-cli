/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatSession } from './useChatSession.js';

// Mock the core module
vi.mock('@gemini-code/core', async (importOriginal) => {
  const actualCore = await importOriginal<typeof import('@gemini-code/core')>();
  return {
    ...actualCore,
    ChatSession: vi.fn().mockImplementation(() => ({
      sendMessage: async function* () {
        yield { source: 'model', type: 'text', content: 'Hello' };
        yield { source: 'model', type: 'text', content: ' World' };
      },
    })),
  };
});

describe('useChatSession', () => {
  it('should send a message and receive events', async () => {
    const { result } = renderHook(() => useChatSession({}));

    await act(async () => {
      await result.current.sendMessage('test prompt');
    });

    expect(result.current.events).toEqual([
      { source: 'model', type: 'text', content: 'Hello' },
      { source: 'model', type: 'text', content: ' World' },
    ]);
    expect(result.current.loading).toBe(false);
  });
});
