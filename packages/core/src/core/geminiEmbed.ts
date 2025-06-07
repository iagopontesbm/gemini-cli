/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EmbedContentParameters,
  EmbedContentResponse,
  GoogleGenAI,
} from '@google/genai';

export class GeminiEmbed {
  private static instance: GeminiEmbed;
  private googleGenAI: GoogleGenAI;

  private constructor(apiKey: string) {
    this.googleGenAI = new GoogleGenAI({ apiKey });
  }

  static initialize(apiKey: string) {
    if (!GeminiEmbed.instance) {
      GeminiEmbed.instance = new GeminiEmbed(apiKey);
    }
  }

  static getInstance(): GeminiEmbed {
    if (!GeminiEmbed.instance) {
      throw new Error(
        'GeminiEmbed has not been initialized. Call initialize(apiKey) first.',
      );
    }
    return GeminiEmbed.instance;
  }

  async generateEmbedding(text: string, model: string): Promise<number[]> {
    const embedModelParams: EmbedContentParameters = {
      model,
      contents: [text],
    };
    const embedContentResponse: EmbedContentResponse =
      await this.googleGenAI.models.embedContent(embedModelParams);
    if (
      !embedContentResponse.embeddings ||
      embedContentResponse.embeddings.length === 0
    ) {
      throw new Error('No embeddings found');
    }
    const values = embedContentResponse.embeddings[0].values;
    if (!values || values.length === 0) {
      throw new Error('No values found in embeddings');
    }
    return values;
  }
}
