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
  GoogleGenAI,
  Models,
} from '@google/genai';
import {
  ContentGenerator,
  ContentGeneratorConfig,
} from './contentGenerator.js';

export class GoogleGenAIGenerator implements ContentGenerator {
  private readonly models: Models;

  constructor(googleGenAI: GoogleGenAI) {
    this.models = googleGenAI.models;
  }

  generateContent(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse> {
    return this.models.generateContent(request);
  }

  generateContentStream(
    request: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    return this.models.generateContentStream(request);
  }

  countTokens(request: CountTokensParameters): Promise<CountTokensResponse> {
    return this.models.countTokens(request);
  }

  embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse> {
    return this.models.embedContent(request);
  }

  async listModels(): Promise<string[]> {
    const { models } = await this.models.list();
    return models.map((model) => model.name);
  }
}
