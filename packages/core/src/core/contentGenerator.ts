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
} from '@google/genai';
import { CodeAssistContentGenerator } from '../code_assist/contentGenerator.js';
import { doSetup } from '../code_assist/setup.js';

/**
 * Interface abstracting the core functionalities for generating content and counting tokens.
 */
export interface ContentGenerator {
  generateContent(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse>;

  generateContentStream(
    request: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>>;

  countTokens(request: CountTokensParameters): Promise<CountTokensResponse>;

  embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse>;
}

export type ContentGeneratorConfig = {
  model: string;
  apiKey?: string;
  vertexai?: boolean;
  codeAssist?: boolean;
};

export async function createContentGenerator(
  config: ContentGeneratorConfig,
): Promise<ContentGenerator> {
  if (config.codeAssist) {
    return new CodeAssistContentGenerator();
  }
  const version = process.env.CLI_VERSION || process.version;
  const googleGenAI = new GoogleGenAI({
    apiKey: config.apiKey === '' ? undefined : config.apiKey,
    vertexai: config.vertexai,
    httpOptions: {
      headers: {
        'User-Agent': `GeminiCLI/${version}/(${process.platform}; ${process.arch})`,
      },
    },
  });
  return googleGenAI.models;
}
