/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { InferenceProvider } from './inferenceProvider.js';
import { GenerateContentParameters, GenerateContentResponse, GoogleGenAI } from '@google/genai';
import { ContentGeneratorConfig } from './contentGenerator.js';

export class GeminiApiProvider implements InferenceProvider {
  private readonly googleGenAI: GoogleGenAI;

  constructor(config: ContentGeneratorConfig) {
    if (!config.apiKey) {
      throw new Error('API key is required for Gemini API provider');
    }

    const version = process.env.CLI_VERSION || process.version;
    const httpOptions = {
      headers: {
        'User-Agent': `GeminiCLI/${version} (${process.platform}; ${process.arch})`,
      },
    };

    this.googleGenAI = new GoogleGenAI({
      apiKey: config.apiKey,
      vertexai: config.vertexai,
      httpOptions,
    });
  }

  async generateContentStream(request: GenerateContentParameters): Promise<AsyncGenerator<GenerateContentResponse>> {
    return this.googleGenAI.models.generateContentStream(request);
  }

  async listModels(): Promise<string[]> {
    const result = await this.googleGenAI.models.list();
    return result.models.map((model: any) => model.name);
  }
}