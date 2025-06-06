/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Content,
  FunctionCall,
  GenerateContentResponse,
  Part,
} from '@google/genai';
import { Config } from '../config/config.js';
import { GeminiChat } from './geminiChat.js';
import { ToolRegistry } from '../tools/tool-registry.js';
import { executeToolCall } from './nonInteractiveToolExecutor.js';
import { ToolCallRequestInfo } from './turn.js';

export enum ChatEventSource {
  USER = 'user',
  MODEL = 'model',
}

export type ChatEvent =
  | {
      source: ChatEventSource.MODEL;
      type: 'text';
      content: string;
    }
  | {
      source: ChatEventSource.MODEL;
      type: 'tool_code';
      content: string;
    }
  | {
      source: ChatEventSource.MODEL;
      type: 'tool_result';
      name: string;
      content: string;
      isError?: boolean;
    };

export class ChatSession {
  private geminiChat!: GeminiChat;
  private toolRegistry!: ToolRegistry;
  private initialized = false;

  constructor(private readonly config: Config) {}

  private async init() {
    if (this.initialized) return;
    this.geminiChat = await this.config.getGeminiClient().getChat();
    this.toolRegistry = await this.config.getToolRegistry();
    this.initialized = true;
  }

  async *sendMessage(prompt: string): AsyncGenerator<ChatEvent> {
    await this.init();

    const abortController = new AbortController();
    let currentMessages: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];

    while (true) {
      const functionCalls: FunctionCall[] = [];

      const responseStream = await this.geminiChat.sendMessageStream({
        message: currentMessages[0]?.parts || [],
        config: {
          abortSignal: abortController.signal,
          tools: [
            { functionDeclarations: this.toolRegistry.getFunctionDeclarations() },
          ],
        },
      });

      for await (const resp of responseStream) {
        if (abortController.signal.aborted) {
          return;
        }
        const textPart = this.getResponseText(resp);
        if (textPart) {
          yield { source: ChatEventSource.MODEL, type: 'text', content: textPart };
        }
        if (resp.functionCalls) {
          functionCalls.push(...resp.functionCalls);
        }
      }

      if (functionCalls.length > 0) {
        for (const fc of functionCalls) {
          yield {
            source: ChatEventSource.MODEL,
            type: 'tool_code',
            content: JSON.stringify(fc, null, 2),
          };
        }

        const toolResponseParts: Part[] = [];

        for (const fc of functionCalls) {
          const callId = fc.id ?? `${fc.name}-${Date.now()}`;
          const requestInfo: ToolCallRequestInfo = {
            callId,
            name: fc.name as string,
            args: (fc.args ?? {}) as Record<string, unknown>,
          };

          const toolResponse = await executeToolCall(
            requestInfo,
            this.toolRegistry,
            abortController.signal,
          );

          yield {
            source: ChatEventSource.MODEL,
            type: 'tool_result',
            name: fc.name as string,
            content: toolResponse.resultDisplay ? toolResponse.resultDisplay.toString() : '',
            isError: !!toolResponse.error,
          };

          if (toolResponse.responseParts) {
            const parts = Array.isArray(toolResponse.responseParts)
              ? toolResponse.responseParts
              : [toolResponse.responseParts];
            toolResponseParts.push(...parts.map(part => (typeof part === 'string' ? {text: part} : part)));
          }
        }
        currentMessages = [{ role: 'user', parts: toolResponseParts }];
      } else {
        return;
      }
    }
  }

  private getResponseText(response: GenerateContentResponse): string | null {
    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      if (
        candidate.content &&
        candidate.content.parts &&
        candidate.content.parts.length > 0
      ) {
        return candidate.content.parts
          .filter((part) => part.text)
          .map((part) => part.text)
          .join('');
      }
    }
    return null;
  }
}
