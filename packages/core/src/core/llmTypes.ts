/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GenerateContentRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  topK?: number;
  topP?: number;
  // Add other common parameters as needed
}

export interface GenerateContentResponse {
  text: string;
  // Add other common response fields as needed
}

export interface CountTokensRequest {
  prompt: string;
}

export interface CountTokensResponse {
  tokenCount: number;
}

export interface EmbedContentRequest {
  content: string | string[];
}

export interface EmbedContentResponse {
  embedding: number[];
}
