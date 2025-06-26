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
  Content,
  Part,
  Candidate,
  GenerateContentResponseUsageMetadata,
  ContentListUnion,
  PartUnion,
  ContentEmbedding,
} from '@google/genai';
import { ContentGenerator, ContentGeneratorConfig } from './contentGenerator.js';
import { fetchWithTimeout } from '../utils/fetch.js';

/**
 * Helper function to normalize ContentListUnion to Content array
 */
function normalizeContents(contents: any): Content[] {
  if (!contents) return [];

  // If it's already an array of Content objects
  if (Array.isArray(contents)) {
    return contents.filter((item: any) => item && typeof item === 'object' && 'parts' in item);
  }

  // If it's a single Content object
  if (typeof contents === 'object' && 'parts' in contents) {
    return [contents];
  }

  // If it's a string or PartUnion, convert to Content
  if (typeof contents === 'string') {
    return [{ parts: [{ text: contents }], role: 'user' }];
  }

  // If it's a Part object
  if (typeof contents === 'object' && ('text' in contents || 'inlineData' in contents)) {
    return [{ parts: [contents], role: 'user' }];
  }

  return [];
}

/**
 * Generic HTTP-based content generator for OpenAI-compatible APIs
 */
export class OpenAICompatibleContentGenerator implements ContentGenerator {
  constructor(private config: ContentGeneratorConfig) {}

  async generateContent(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse> {
    const openAIRequest = this.convertToOpenAIFormat(request);

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        ...this.config.customHeaders,
      },
      body: JSON.stringify(openAIRequest),
      // Note: AbortSignal.timeout might not be available in older Node.js versions
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return this.convertFromOpenAIFormat(data);
  }

  async generateContentStream(
    request: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    return this.generateContentStreamInternal(request);
  }

  private async *generateContentStreamInternal(
    request: GenerateContentParameters,
  ): AsyncGenerator<GenerateContentResponse> {
    const openAIRequest = { ...this.convertToOpenAIFormat(request), stream: true };
    
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        ...this.config.customHeaders,
      },
      body: JSON.stringify(openAIRequest),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;
            
            try {
              const parsed = JSON.parse(data);
              yield this.convertFromOpenAIFormat(parsed, true);
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async countTokens(request: CountTokensParameters): Promise<CountTokensResponse> {
    // Approximate token counting - most APIs don't provide exact token counting
    const contents = normalizeContents(request.contents);
    const text = this.extractTextFromContents(contents);
    const approximateTokens = Math.ceil(text.length / 4); // Rough approximation

    return {
      totalTokens: approximateTokens,
    };
  }

  async embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse> {
    const contents = normalizeContents(request.contents);
    const text = this.extractTextFromContents(contents);
    
    const response = await fetch(`${this.config.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        ...this.config.customHeaders,
      },
      body: JSON.stringify({
        input: text,
        model: request.model || 'text-embedding-ada-002',
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      embeddings: [{
        values: data.data[0].embedding,
      }],
    };
  }

  private convertToOpenAIFormat(request: GenerateContentParameters): any {
    const contents = normalizeContents(request.contents);
    const messages = contents.map((content: Content) => ({
      role: content.role === 'model' ? 'assistant' : content.role,
      content: content.parts?.map((part: Part) => {
        if ('text' in part) {
          return part.text;
        }
        // Handle other part types as needed
        return JSON.stringify(part);
      }).join('\n') || '',
    }));

    return {
      model: request.model || this.config.model,
      messages,
      temperature: request.config?.temperature || 0.7,
      max_tokens: request.config?.maxOutputTokens || 2048,
      top_p: request.config?.topP || 1,
      stream: false,
    };
  }

  private convertFromOpenAIFormat(data: any, isStream = false): GenerateContentResponse {
    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error('No choices in response');
    }

    const text = isStream 
      ? choice.delta?.content || ''
      : choice.message?.content || '';

    const candidate: Candidate = {
      content: {
        parts: [{ text }],
        role: 'model',
      },
      finishReason: choice.finish_reason || 'STOP',
      index: 0,
    };

    const usageMetadata: GenerateContentResponseUsageMetadata = {
      promptTokenCount: data.usage?.prompt_tokens || 0,
      candidatesTokenCount: data.usage?.completion_tokens || 0,
      totalTokenCount: data.usage?.total_tokens || 0,
    };

    return {
      candidates: [candidate],
      usageMetadata,
      text: text,
      data: undefined,
      functionCalls: [],
      executableCode: undefined,
      codeExecutionResult: undefined,
    };
  }

  private extractTextFromContents(contents: Content[]): string {
    return contents
      .map(content =>
        content.parts
          ?.map((part: Part) => ('text' in part ? part.text : ''))
          .join(' ') || ''
      )
      .join(' ');
  }

  private extractTextFromContent(content: Content): string {
    return content.parts
      ?.map((part: Part) => ('text' in part ? part.text : ''))
      .join(' ') || '';
  }
}

/**
 * Anthropic Claude API content generator
 */
export class AnthropicContentGenerator implements ContentGenerator {
  constructor(private config: ContentGeneratorConfig) {}

  async generateContent(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse> {
    const anthropicRequest = this.convertToAnthropicFormat(request);
    
    const response = await fetch(`${this.config.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey!,
        'anthropic-version': '2023-06-01',
        ...this.config.customHeaders,
      },
      body: JSON.stringify(anthropicRequest),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return this.convertFromAnthropicFormat(data);
  }

  async generateContentStream(
    request: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    return this.generateContentStreamInternal(request);
  }

  private async *generateContentStreamInternal(
    request: GenerateContentParameters,
  ): AsyncGenerator<GenerateContentResponse> {
    const anthropicRequest = { 
      ...this.convertToAnthropicFormat(request), 
      stream: true 
    };
    
    const response = await fetch(`${this.config.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey!,
        'anthropic-version': '2023-06-01',
        ...this.config.customHeaders,
      },
      body: JSON.stringify(anthropicRequest),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta') {
                yield this.convertFromAnthropicFormat(parsed, true);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async countTokens(request: CountTokensParameters): Promise<CountTokensResponse> {
    // Anthropic doesn't provide token counting API, so approximate
    const contents = normalizeContents(request.contents);
    const text = this.extractTextFromContents(contents);
    const approximateTokens = Math.ceil(text.length / 4);

    return {
      totalTokens: approximateTokens,
    };
  }

  async embedContent(_request: EmbedContentParameters): Promise<EmbedContentResponse> {
    throw new Error('Anthropic does not support embeddings');
  }

  private convertToAnthropicFormat(request: GenerateContentParameters): any {
    const contents = normalizeContents(request.contents);
    const messages = contents.map((content: Content) => ({
      role: content.role === 'model' ? 'assistant' : 'user',
      content: content.parts?.map((part: Part) => {
        if ('text' in part) {
          return { type: 'text', text: part.text };
        }
        return { type: 'text', text: JSON.stringify(part) };
      }) || [],
    }));

    return {
      model: request.model || this.config.model,
      messages,
      max_tokens: request.config?.maxOutputTokens || 2048,
      temperature: request.config?.temperature || 0.7,
      top_p: request.config?.topP || 1,
    };
  }

  private convertFromAnthropicFormat(data: any, isStream = false): GenerateContentResponse {
    const text = isStream 
      ? data.delta?.text || ''
      : data.content?.[0]?.text || '';

    const candidate: Candidate = {
      content: {
        parts: [{ text }],
        role: 'model',
      },
      finishReason: data.stop_reason || 'STOP',
      index: 0,
    };

    const usageMetadata: GenerateContentResponseUsageMetadata = {
      promptTokenCount: data.usage?.input_tokens || 0,
      candidatesTokenCount: data.usage?.output_tokens || 0,
      totalTokenCount: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    };

    return {
      candidates: [candidate],
      usageMetadata,
      text: text,
      data: undefined,
      functionCalls: [],
      executableCode: undefined,
      codeExecutionResult: undefined,
    };
  }

  private extractTextFromContents(contents: Content[]): string {
    return contents
      .map(content =>
        content.parts
          ?.map((part: Part) => ('text' in part ? part.text : ''))
          .join(' ') || ''
      )
      .join(' ');
  }
}
