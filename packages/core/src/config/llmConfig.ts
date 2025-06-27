/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export enum ProviderType {
  OLLAMA = 'ollama',
  LMSTUDIO = 'lmstudio',
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GEMINI = 'gemini', // For the existing CodeAssistServer
  // Add other provider types as needed
}

export interface ModelConfig {
  title: string;
  provider: ProviderType;
  model: string; // Model name specific to the provider
  apiKey?: string;
  apiBase?: string; // For OpenAI-compatible backends or custom Ollama/LMStudio hosts
  systemMessage?: string;
  temperature?: number;
  topK?: number;
  topP?: number;
  maxTokens?: number; // Alias for maxOutputTokens or similar
  contextLength?: number;
  maxCompletionTokens?: number;
  client?: string; // For LMStudio client URL
  keep_alive_seconds?: string | number; // For Ollama/LMStudio keep_alive
  default?: boolean; // To mark a model as the default
}

export interface LlmConfig {
  models: ModelConfig[];
}
