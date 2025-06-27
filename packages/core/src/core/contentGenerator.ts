/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import { createCodeAssistContentGenerator } from '../code_assist/codeAssist.js';
import { DEFAULT_GEMINI_MODEL } from '../config/models.js';
import { getEffectiveModel } from './modelCheck.js';
import {
  GenerateContentRequest,
  GenerateContentResponse,
  CountTokensRequest,
  CountTokensResponse,
  EmbedContentRequest,
  EmbedContentResponse,
} from './llmTypes.js';

/**
 * Interface abstracting the core functionalities for generating content and counting tokens.
 */
export interface ContentGenerator {
  generateContent(
    request: GenerateContentRequest,
  ): Promise<GenerateContentResponse>;

  generateContentStream(
    request: GenerateContentRequest,
  ): Promise<AsyncGenerator<GenerateContentResponse>>;

  countTokens(request: CountTokensRequest): Promise<CountTokensResponse>;

  embedContent(request: EmbedContentRequest): Promise<EmbedContentResponse>;
}

export enum AuthType {
  LOGIN_WITH_GOOGLE_PERSONAL = 'oauth-personal',
  USE_GEMINI = 'gemini-api-key',
  USE_VERTEX_AI = 'vertex-ai',
  // Add other auth types if necessary, e.g., for API keys of other providers
  API_KEY = 'api-key', // Generic API key auth for non-Google providers
  NONE = 'none', // For providers like Ollama that might not need explicit auth
}

// Updated ContentGeneratorConfig to hold a full ModelConfig
export type ContentGeneratorConfig = {
  modelConfig: ModelConfig; // From llmConfig.ts
  authType?: AuthType; // Could be derived from modelConfig.provider or explicit
  // Other general settings if needed
};

export async function createContentGeneratorConfig(
  llmConfigManager: LlmConfigManager, // Pass the LlmConfigManager instance
  modelTitle?: string, // Optional: User-specified model title
  authType?: AuthType, // Optional: Specific auth type if overriding default for provider
): Promise<ContentGeneratorConfig> {
  let modelConfig = modelTitle
    ? llmConfigManager.getModel(modelTitle)
    : llmConfigManager.getDefaultModel();

  if (!modelConfig) {
    // Fallback if the specified model or default model isn't found
    // This could be an internal default or an error
    console.warn(
      `Model with title '${modelTitle || 'default'}' not found. Falling back to a default Gemini model.`,
    );
    // TODO: Define a more robust fallback or error handling strategy
    modelConfig = {
      title: 'gemini-fallback',
      provider: ProviderType.GEMINI,
      model: DEFAULT_GEMINI_MODEL,
      // Ensure other necessary fields are present for this fallback
    };
    // Attempt to use Gemini API key by default for this fallback
    authType = authType || AuthType.USE_GEMINI;
  }

  const determinedAuthType = authType || determineAuthTypeForProvider(modelConfig.provider);

  // Special handling for Gemini/Vertex API key resolution if not directly in modelConfig
  if (
    (modelConfig.provider === ProviderType.GEMINI && determinedAuthType === AuthType.USE_GEMINI) ||
    (modelConfig.provider === ProviderType.GEMINI && determinedAuthType === AuthType.USE_VERTEX_AI)
  ) {
    if (!modelConfig.apiKey) {
      modelConfig.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    }
    if (determinedAuthType === AuthType.USE_VERTEX_AI && !modelConfig.apiBase) {
      // Potentially set Vertex AI specific defaults if not in config
      // e.g., project, location from env vars if not in modelConfig
    }
    // Ensure effective model is resolved for Gemini
    if (modelConfig.apiKey) {
      modelConfig.model = await getEffectiveModel(
        modelConfig.apiKey,
        modelConfig.model,
      );
    }
  }


  return {
    modelConfig,
    authType: determinedAuthType,
  };
}

function determineAuthTypeForProvider(providerType: ProviderType): AuthType {
  switch (providerType) {
    case ProviderType.GEMINI:
      // Default to personal login for Gemini if not specified otherwise
      // or if API key is available, could default to USE_GEMINI
      return AuthType.LOGIN_WITH_GOOGLE_PERSONAL;
    case ProviderType.OPENAI:
    case ProviderType.ANTHROPIC:
      return AuthType.API_KEY;
    case ProviderType.OLLAMA:
    case ProviderType.LMSTUDIO:
      return AuthType.NONE; // Typically no auth needed, or handled via apiBase
    default:
      console.warn(`Unknown provider type: ${providerType}. Defaulting to no auth.`);
      return AuthType.NONE;
  }
}


export async function createContentGenerator(
  config: ContentGeneratorConfig,
  // We might need LlmConfigManager here too, or pass all necessary info via ContentGeneratorConfig
): Promise<ContentGenerator> {
  const version = process.env.CLI_VERSION || process.version;
  const httpOptions = {
    headers: {
      'User-Agent': `GeminiCLI/${version} (${process.platform}; ${process.arch})`,
    },
  };

  const { modelConfig, authType } = config;

  switch (modelConfig.provider) {
    case ProviderType.GEMINI:
      if (authType === AuthType.LOGIN_WITH_GOOGLE_PERSONAL) {
        return createCodeAssistContentGenerator(httpOptions, authType);
      } else if (authType === AuthType.USE_GEMINI || authType === AuthType.USE_VERTEX_AI) {
        const googleGenAI = new GoogleGenAI({
          apiKey: modelConfig.apiKey === '' ? undefined : modelConfig.apiKey,
          vertexai: authType === AuthType.USE_VERTEX_AI, // TODO: Get this from modelConfig more directly
          httpOptions,
        });
        // TODO: This returns a GenerativeModel, not a ContentGenerator.
        // We need to wrap it or use a different approach for Gemini API key/Vertex.
        // For now, this will cause a type error.
        // return googleGenAI.getGenerativeModel({ model: modelConfig.model });
        // This is a temporary fix, assuming googleGenAI.models is compatible.
        // This likely needs a dedicated Gemini client similar to OpenAiClient etc.
        // that implements ContentGenerator.
        console.warn(
          'Using googleGenAI.models directly for Gemini API key/Vertex. This may need a dedicated client.',
        );
        // @ts-expect-error - googleGenAI.models is not a ContentGenerator
        return googleGenAI.models;
      }
      throw new Error(
        `Unsupported authType '${authType}' for Gemini provider.`,
      );

    case ProviderType.OPENAI:
      if (!modelConfig.apiKey) {
        throw new Error(
          `API key is required for OpenAI provider (model: ${modelConfig.title})`,
        );
      }
      return new OpenAiClient({
        apiKey: modelConfig.apiKey,
        model: modelConfig.model,
        apiBase: modelConfig.apiBase,
      });

    case ProviderType.ANTHROPIC:
      if (!modelConfig.apiKey) {
        throw new Error(
          `API key is required for Anthropic provider (model: ${modelConfig.title})`,
        );
      }
      return new AnthropicClient({
        apiKey: modelConfig.apiKey,
        model: modelConfig.model,
      });

    case ProviderType.OLLAMA:
      return new OllamaClient({
        model: modelConfig.model,
        host: modelConfig.apiBase, // Assuming apiBase is used for host URL
      });

    // TODO: Add cases for LMSTUDIO and other providers

    default:
      throw new Error(
        `Unsupported provider: ${modelConfig.provider} in model ${modelConfig.title}`,
      );
  }
}

// Import provider clients - these will need to be created
import { OpenAiClient } from '../providers/openai_client.js';
import { AnthropicClient } from '../providers/anthropic_client.js';
import { OllamaClient } from '../providers/ollama_client.js';
import { ModelConfig, ProviderType } from '../config/llmConfig.js';
import { LlmConfigManager } from '../config/llmConfigManager.js';
