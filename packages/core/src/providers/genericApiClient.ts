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
import { ProviderConfig } from '../config/providerConfig.js';

export interface GenericApiClient {
  generateContent(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse>;

  generateContentStream(
    request: GenerateContentParameters,
  ): AsyncGenerator<GenerateContentResponse>;

  countTokens(request: CountTokensParameters): Promise<CountTokensResponse>;

  embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse>;
}

export interface OpenAICompatibleMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

export interface OpenAICompatibleRequest {
  model: string;
  messages: OpenAICompatibleMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
  functions?: Array<{
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  }>;
  function_call?: 'auto' | 'none' | { name: string };
}

export interface OpenAICompatibleResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message?: {
      role: string;
      content: string | null;
      function_call?: {
        name: string;
        arguments: string;
      };
    };
    delta?: {
      role?: string;
      content?: string;
      function_call?: {
        name?: string;
        arguments?: string;
      };
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAICompatibleClient implements GenericApiClient {
  private provider: ProviderConfig;
  private httpOptions: { headers: Record<string, string> };

  constructor(provider: ProviderConfig, httpOptions: { headers: Record<string, string> } = { headers: {} }) {
    this.provider = provider;
    this.httpOptions = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.auth.apiKey}`,
        ...provider.auth.headers,
        ...httpOptions.headers,
      }
    };
  }

  async generateContent(request: GenerateContentParameters): Promise<GenerateContentResponse> {
    const openaiRequest = this.convertToOpenAIFormat(request);
    const response = await this.makeRequest('/chat/completions', openaiRequest);
    return this.convertFromOpenAIFormat(response);
  }

  async *generateContentStream(request: GenerateContentParameters): AsyncGenerator<GenerateContentResponse> {
    const openaiRequest = this.convertToOpenAIFormat(request, true);
    const response = await fetch(`${this.provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.httpOptions.headers,
      body: JSON.stringify(openaiRequest),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    if (!response.body) {
      throw new Error('No response body for streaming request');
    }

    const reader = response.body.getReader();
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
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data) as OpenAICompatibleResponse;
              const converted = this.convertFromOpenAIFormat(parsed);
              yield converted;
            } catch (error) {
              // Skip malformed JSON
              continue;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async countTokens(request: CountTokensParameters): Promise<CountTokensResponse> {
    // Most OpenAI-compatible APIs don't have a dedicated token counting endpoint
    // We'll estimate based on the content length as a fallback
    const content = Array.isArray((request as any).contents) 
      ? (request as any).contents.map((c: any) => c.parts?.map((p: any) => p.text || '').join(' ') || '').join(' ')
      : '';
    
    const estimatedTokens = Math.ceil(content.length / 4); // Rough estimation
    
    return {
      totalTokens: estimatedTokens,
    };
  }

  async embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse> {
    const embeddingRequest = {
      model: this.provider.models.embedding || this.provider.models.chat,
      input: (request as any).contents?.map((c: any) => c.parts?.map((p: any) => p.text).join(' ')).join(' ') || '',
    };

    const response = await this.makeRequest('/embeddings', embeddingRequest);
    
    return {
      embeddings: [
        {
          values: response.data?.[0]?.embedding || [],
        }
      ],
    };
  }

  private convertToOpenAIFormat(request: GenerateContentParameters, stream: boolean = false): OpenAICompatibleRequest {
    const messages: OpenAICompatibleMessage[] = [];
    const req = request as any;

    // Handle system instruction
    if (req.systemInstruction) {
      messages.push({
        role: 'system',
        content: req.systemInstruction.parts?.map((p: any) => p.text).join(' ') || '',
      });
    }

    // Convert contents to messages
    if (req.contents) {
      for (const content of req.contents) {
        const role = content.role === 'model' ? 'assistant' : content.role as 'user' | 'assistant';
        const text = content.parts?.map((p: any) => p.text || '').join(' ') || '';
        
        if (text.trim()) {
          messages.push({
            role,
            content: text,
          });
        }
      }
    }

    const openaiRequest: OpenAICompatibleRequest = {
      model: this.provider.models.chat,
      messages,
      stream,
    };

    // Add generation config if provided
    if (req.generationConfig) {
      if (req.generationConfig.temperature !== undefined) {
        openaiRequest.temperature = req.generationConfig.temperature;
      }
      if (req.generationConfig.maxOutputTokens !== undefined) {
        openaiRequest.max_tokens = req.generationConfig.maxOutputTokens;
      }
      if (req.generationConfig.topP !== undefined) {
        openaiRequest.top_p = req.generationConfig.topP;
      }
    }

    // Add tools if provided
    if (req.tools && req.tools.length > 0) {
      openaiRequest.functions = req.tools.map((tool: any) => ({
        name: tool.functionDeclaration?.name || '',
        description: tool.functionDeclaration?.description,
        parameters: tool.functionDeclaration?.parameters || {},
      }));
      openaiRequest.function_call = 'auto';
    }

    return openaiRequest;
  }

  private convertFromOpenAIFormat(response: OpenAICompatibleResponse): GenerateContentResponse {
    const choice = response.choices?.[0];
    if (!choice) {
      throw new Error('No choices in OpenAI response');
    }

    const message = choice.message || choice.delta;
    if (!message) {
      throw new Error('No message in OpenAI choice');
    }

    const result: GenerateContentResponse = {
      candidates: [{
        content: {
          parts: message.content ? [{ text: message.content }] : [],
          role: 'model',
        },
        finishReason: this.mapFinishReason(choice.finish_reason) as any,
        index: choice.index,
        safetyRatings: [],
      }],
      promptFeedback: {
        safetyRatings: [],
      },
      text: () => message.content || '',
      data: {},
      functionCalls: () => [],
      executableCode: () => [],
      codeExecutionResult: () => undefined,
    } as any;

    // Handle function calls
    if (message.function_call && result.candidates && result.candidates[0] && result.candidates[0].content) {
      result.candidates[0].content.parts = [{
        functionCall: {
          name: message.function_call.name,
          args: JSON.parse(message.function_call.arguments || '{}'),
        },
      }];
    }

    // Add usage metadata if available
    if (response.usage) {
      (result as any).usageMetadata = {
        promptTokenCount: response.usage.prompt_tokens,
        candidatesTokenCount: response.usage.completion_tokens,
        totalTokenCount: response.usage.total_tokens,
      };
    }

    return result;
  }

  private mapFinishReason(reason: string | null): string {
    switch (reason) {
      case 'stop':
        return 'STOP';
      case 'length':
        return 'MAX_TOKENS';
      case 'function_call':
        return 'STOP';
      case 'content_filter':
        return 'SAFETY';
      default:
        return 'OTHER';
    }
  }

  private async makeRequest(endpoint: string, body: unknown): Promise<any> {
    const url = `${this.provider.baseUrl}${endpoint}`;
    const timeout = this.provider.settings?.timeout || 30000;
    const maxRetries = this.provider.settings?.maxRetries || 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          method: 'POST',
          headers: this.httpOptions.headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        return await response.json();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}