/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CountTokensResponse,
  GenerateContentResponse,
  GenerateContentParameters,
  CountTokensParameters,
  EmbedContentResponse,
  EmbedContentParameters,
} from '@google/genai';
import {
  ContentGenerator,
  ContentGeneratorConfig,
} from './contentGenerator.js';

export class OllamaContentGenerator implements ContentGenerator {
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(config: ContentGeneratorConfig) {
    if (!config.ollamaBaseUrl) {
      throw new Error('Ollama base URL is not configured.');
    }
    this.baseUrl = config.ollamaBaseUrl;
    this.model = config.model;
  }

  async generateContent(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        prompt: request.contents[0].parts[0].text, // Assuming single text part for simplicity
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      candidates: [
        {
          content: {
            parts: [{ text: data.response }],
            role: 'model',
          },
        },
      ],
    };
  }

  async generateContentStream(
    request: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        prompt: request.contents[0].parts[0].text,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get reader from Ollama stream.');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    async function* generate(): AsyncGenerator<GenerateContentResponse> {
      while (true) {
        const { done, value } = await reader!.read();
        buffer += decoder.decode(value, { stream: true });

        while (buffer.includes('\n')) {
          const newlineIndex = buffer.indexOf('\n');
          const line = buffer.substring(0, newlineIndex).trim();
          buffer = buffer.substring(newlineIndex + 1);

          if (line) {
            try {
              const data = JSON.parse(line);
              if (data.response) {
                yield {
                  candidates: [
                    {
                      content: {
                        parts: [{ text: data.response }],
                        role: 'model',
                      },
                    },
                  ],
                };
              }
            } catch (e) {
              console.error('Error parsing Ollama stream line:', e);
            }
          }
        }

        if (done) {
          break;
        }
      }
    }

    return generate();
  }

  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    // Ollama does not have a direct token counting API, so we'll estimate or return a placeholder.
    // For a more accurate count, you'd need to integrate with a tokenizer library compatible with Ollama's models.
    const text = request.contents
      .map((c) => c.parts.map((p) => ('text' in p ? p.text : '')).join(''))
      .join('');
    const estimatedTokens = Math.ceil(text.length / 4); // Rough estimate: 1 token ~ 4 characters
    return { totalTokens: estimatedTokens };
  }

  async embedContent(
    request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        prompt: request.content.parts[0].text, // Assuming single text part
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      embeddings: [
        {
          value: data.embedding,
        },
      ],
    };
  }

  async listModels(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }
    const data = await response.json();
    return data.models.map((model: { name: string }) => model.name);
  }
}
