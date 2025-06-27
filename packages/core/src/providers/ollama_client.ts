/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ContentGenerator } from '../core/contentGenerator.js';
import {
  GenerateContentRequest,
  GenerateContentResponse,
  CountTokensRequest,
  CountTokensResponse,
  EmbedContentRequest,
  EmbedContentResponse,
} from '../core/llmTypes.js';

export interface OllamaClientOptions {
  model: string;
  host?: string; // e.g., http://localhost:11434
}

export class OllamaClient implements ContentGenerator {
  private model: string;
  private host: string;

  constructor(options: OllamaClientOptions) {
    this.model = options.model;
    this.host = options.host || 'http://localhost:11434'; // Default host
  }

  async generateContent(
    req: GenerateContentRequest,
  ): Promise<GenerateContentResponse> {
    // TODO: Implement actual API call to Ollama using the official ollama library
    // This is a placeholder implementation.
    console.log(
      `Calling Ollama generateContent with model ${this.model} and prompt: ${req.prompt} at host ${this.host}`,
    );
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API call
    return {
      text: `Response from Ollama model ${this.model}: ${req.prompt}`,
    };
  }

  async generateContentStream(
    req: GenerateContentRequest,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    // TODO: Implement streaming API call to Ollama
    console.log(
      `Calling Ollama generateContentStream with model ${this.model} and prompt: ${req.prompt} at host ${this.host}`,
    );
    const self = this; // eslint-disable-line @typescript-eslint/no-this-alias
    return (async function* (): AsyncGenerator<GenerateContentResponse> {
      yield {
        text: `Streaming response from Ollama model ${self.model}: ${req.prompt}`,
      };
    })();
  }

  async countTokens(req: CountTokensRequest): Promise<CountTokensResponse> {
    // TODO: Implement token counting for Ollama (Ollama API does not directly support this, may need a workaround)
    console.log(
      `Calling Ollama countTokens with model ${this.model} and prompt: ${req.prompt} at host ${this.host}`,
    );
    return {
      tokenCount: req.prompt.length, // Placeholder
    };
  }

  async embedContent(
    req: EmbedContentRequest,
  ): Promise<EmbedContentResponse> {
    // TODO: Implement embedding API call to Ollama
    console.log(
      `Calling Ollama embedContent with model ${this.model} at host ${this.host}`,
    );
    return {
      embedding: [0.7, 0.8, 0.9], // Placeholder
    };
  }
}
