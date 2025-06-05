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
} from '@google/genai';

/**
 * Interface abstracting the core functionalities for generating content and counting tokens.
 * This allows for different implementations, such as the actual GoogleGenAI SDK's
 * 'models' object or a mock/alternative provider.
 */
export interface ContentGenerator {
  /**
   * Makes a non-streaming request to generate content.
   */
  generateContent(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse>;

  /**
   * Makes a streaming request to generate content.
   */
  generateContentStream(
    request: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>>;

  /**
   * Makes a request to count tokens.
   */
  countTokens(request: CountTokensParameters): Promise<CountTokensResponse>;
}
