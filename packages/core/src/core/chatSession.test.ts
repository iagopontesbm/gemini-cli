/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from 'vitest';
import { ChatSession } from './chatSession.js';
import { Config } from '../config/config.js';

describe('ChatSession', () => {
  it('should be defined', () => {
    expect(ChatSession).toBeDefined();
  });

  it('should echo the prompt', async () => {
    const mockChat = {
      sendMessageStream: async function* () {
        yield { candidates: [{ content: { parts: [{ text: 'Echo: hello' }] } }] };
      },
    };
    const mockGeminiClient = {
      getChat: () => mockChat,
    };
    const mockToolRegistry = {
      getFunctionDeclarations: () => [],
    };
    const config = {
      getGeminiClient: () => mockGeminiClient,
      getToolRegistry: () => Promise.resolve(mockToolRegistry),
    } as unknown as Config;

    const session = new ChatSession(config);
    const stream = session.sendMessage('hello');
    const result = await stream.next();
    expect(result.value).toEqual({ source: 'model', type: 'text', content: 'Echo: hello' });
  });
});