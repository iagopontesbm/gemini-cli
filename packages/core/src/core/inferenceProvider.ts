/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GenerateContentParameters, GenerateContentResponse } from '@google/genai';

/**
 * Defines the standard interface for an AI model inference provider.
 */
export interface InferenceProvider {
  /**
   * Makes a request to the provider to generate content and returns the response as a stream.
   * @param request The content generation request, formatted according to the Google AI SDK.
   * @returns A promise that resolves with an async generator of content responses.
   */
  generateContentStream(request: GenerateContentParameters): Promise<AsyncGenerator<GenerateContentResponse>>;

  /**
   * Lists the models available from this provider.
   * @returns A promise that resolves with an array of model ID strings.
   */
  listModels(): Promise<string[]>;
}