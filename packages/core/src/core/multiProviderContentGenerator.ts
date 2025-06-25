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
import { createCodeAssistContentGenerator } from '../code_assist/codeAssist.js';
import { DEFAULT_GEMINI_MODEL } from '../config/models.js';
import { getEffectiveModel } from './modelCheck.js';
import { ProviderConfig, ProviderConfigManager } from '../config/providerConfig.js';
import { OpenAICompatibleClient, GenericApiClient } from '../providers/genericApiClient.js';
import { ContentGenerator, AuthType } from './contentGenerator.js';

export type MultiProviderContentGeneratorConfig = {
  model: string;
  apiKey?: string;
  vertexai?: boolean;
  authType?: AuthType | undefined;
  // New multi-provider options
  providerConfigManager?: ProviderConfigManager;
  useMultiProvider?: boolean;
  taskType?: 'chat' | 'fast' | 'embedding' | 'code';
};

export class MultiProviderContentGenerator implements ContentGenerator {
  private geminiGenerator?: ContentGenerator;
  private genericClient?: GenericApiClient;
  private config: MultiProviderContentGeneratorConfig;
  private providerConfigManager?: ProviderConfigManager;

  constructor(
    config: MultiProviderContentGeneratorConfig,
    geminiGenerator?: ContentGenerator,
    providerConfigManager?: ProviderConfigManager,
  ) {
    this.config = config;
    this.geminiGenerator = geminiGenerator;
    this.providerConfigManager = providerConfigManager;

    // If using multi-provider mode, set up the generic client
    if (config.useMultiProvider && providerConfigManager) {
      this.setupGenericClient(config.taskType || 'chat');
    }
  }

  private setupGenericClient(taskType: 'chat' | 'fast' | 'embedding' | 'code'): void {
    if (!this.providerConfigManager) {
      throw new Error('Provider config manager is required for multi-provider mode');
    }

    const provider = this.providerConfigManager.getProviderForTask(taskType);
    
    // Only OpenAI-compatible providers are supported for now
    if (provider.type === 'openrouter' || provider.type === 'deepseek' || provider.type === 'openai-compatible') {
      const version = process.env.CLI_VERSION || process.version;
      const httpOptions = {
        headers: {
          'User-Agent': `GeminiCLI/${version} (${process.platform}; ${process.arch})`,
        },
      };
      
      this.genericClient = new OpenAICompatibleClient(provider, httpOptions);
    } else if (provider.type === 'gemini') {
      // For Gemini providers, we'll still use the original Gemini client
      // but we could enhance this to use provider-specific configurations
      this.config.useMultiProvider = false;
    } else {
      throw new Error(`Unsupported provider type: ${provider.type}`);
    }
  }

  async generateContent(request: GenerateContentParameters): Promise<GenerateContentResponse> {
    if (this.config.useMultiProvider && this.genericClient) {
      return await this.genericClient.generateContent(request);
    }

    if (!this.geminiGenerator) {
      throw new Error('No content generator available');
    }

    return await this.geminiGenerator.generateContent(request);
  }

  async generateContentStream(
    request: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    if (this.config.useMultiProvider && this.genericClient) {
      return await this.genericClient.generateContentStream(request);
    }

    if (!this.geminiGenerator) {
      throw new Error('No content generator available');
    }

    return await this.geminiGenerator.generateContentStream(request);
  }

  async countTokens(request: CountTokensParameters): Promise<CountTokensResponse> {
    if (this.config.useMultiProvider && this.genericClient) {
      return await this.genericClient.countTokens(request);
    }

    if (!this.geminiGenerator) {
      throw new Error('No content generator available');
    }

    return await this.geminiGenerator.countTokens(request);
  }

  async embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse> {
    if (this.config.useMultiProvider && this.genericClient) {
      return await this.genericClient.embedContent(request);
    }

    if (!this.geminiGenerator) {
      throw new Error('No content generator available');
    }

    return await this.geminiGenerator.embedContent(request);
  }

  // Method to switch providers during runtime
  async switchProvider(providerId: string, taskType: 'chat' | 'fast' | 'embedding' | 'code' = 'chat'): Promise<void> {
    if (!this.providerConfigManager) {
      throw new Error('Provider config manager is required to switch providers');
    }

    const provider = this.providerConfigManager.getProvider(providerId);
    
    if (provider.type === 'gemini') {
      // Switch back to Gemini mode
      this.config.useMultiProvider = false;
      this.genericClient = undefined;
    } else {
      // Switch to generic provider
      this.config.useMultiProvider = true;
      this.config.taskType = taskType;
      this.setupGenericClient(taskType);
    }
  }

  // Get current provider information
  getCurrentProvider(): { id: string; name: string; type: string } | null {
    if (this.config.useMultiProvider && this.providerConfigManager) {
      const provider = this.providerConfigManager.getProviderForTask(this.config.taskType || 'chat');
      return {
        id: provider.id,
        name: provider.name,
        type: provider.type,
      };
    }

    // Return Gemini info for legacy mode
    return {
      id: 'gemini',
      name: 'Google Gemini',
      type: 'gemini',
    };
  }

  // Get available models for current provider
  getAvailableModels(): string[] {
    if (this.config.useMultiProvider && this.providerConfigManager) {
      const provider = this.providerConfigManager.getProviderForTask(this.config.taskType || 'chat');
      return Object.values(provider.models).filter(Boolean) as string[];
    }

    return [this.config.model];
  }
}

export async function createMultiProviderContentGeneratorConfig(
  model: string | undefined,
  authType: AuthType | undefined,
  config?: { getModel?: () => string },
  providerConfigManager?: ProviderConfigManager,
  useMultiProvider: boolean = false,
  taskType: 'chat' | 'fast' | 'embedding' | 'code' = 'chat',
): Promise<MultiProviderContentGeneratorConfig> {
  // If multi-provider is requested and we have a config manager, use it
  if (useMultiProvider && providerConfigManager) {
    const provider = providerConfigManager.getProviderForTask(taskType);
    const providerModel = providerConfigManager.getModelForTask(taskType);
    
    return {
      model: providerModel,
      authType: undefined, // Not used for generic providers
      providerConfigManager,
      useMultiProvider: true,
      taskType,
    };
  }

  // Fall back to original Gemini configuration
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const googleApiKey = process.env.GOOGLE_API_KEY;
  const googleCloudProject = process.env.GOOGLE_CLOUD_PROJECT;
  const googleCloudLocation = process.env.GOOGLE_CLOUD_LOCATION;

  const effectiveModel = config?.getModel?.() || model || DEFAULT_GEMINI_MODEL;

  const contentGeneratorConfig: MultiProviderContentGeneratorConfig = {
    model: effectiveModel,
    authType,
    providerConfigManager,
    useMultiProvider: false,
    taskType,
  };

  // Original Gemini auth logic
  if (authType === AuthType.LOGIN_WITH_GOOGLE_PERSONAL) {
    return contentGeneratorConfig;
  }

  if (authType === AuthType.LOGIN_WITH_GOOGLE_ENTERPRISE && !!googleCloudProject) {
    return contentGeneratorConfig;
  }

  if (authType === AuthType.USE_GEMINI && geminiApiKey) {
    contentGeneratorConfig.apiKey = geminiApiKey;
    contentGeneratorConfig.model = await getEffectiveModel(
      contentGeneratorConfig.apiKey,
      contentGeneratorConfig.model,
    );
    return contentGeneratorConfig;
  }

  if (
    authType === AuthType.USE_VERTEX_AI &&
    !!googleApiKey &&
    googleCloudProject &&
    googleCloudLocation
  ) {
    contentGeneratorConfig.apiKey = googleApiKey;
    contentGeneratorConfig.vertexai = true;
    contentGeneratorConfig.model = await getEffectiveModel(
      contentGeneratorConfig.apiKey,
      contentGeneratorConfig.model,
    );
    return contentGeneratorConfig;
  }

  return contentGeneratorConfig;
}

export async function createMultiProviderContentGenerator(
  config: MultiProviderContentGeneratorConfig,
): Promise<MultiProviderContentGenerator> {
  let geminiGenerator: ContentGenerator | undefined;

  // Create Gemini generator if needed (for fallback or primary use)
  if (!config.useMultiProvider || config.authType) {
    const version = process.env.CLI_VERSION || process.version;
    const httpOptions = {
      headers: {
        'User-Agent': `GeminiCLI/${version} (${process.platform}; ${process.arch})`,
      },
    };

    if (
      config.authType === AuthType.LOGIN_WITH_GOOGLE_PERSONAL ||
      config.authType === AuthType.LOGIN_WITH_GOOGLE_ENTERPRISE
    ) {
      geminiGenerator = await createCodeAssistContentGenerator(httpOptions, config.authType);
    } else if (
      config.authType === AuthType.USE_GEMINI ||
      config.authType === AuthType.USE_VERTEX_AI
    ) {
      const googleGenAI = new GoogleGenAI({
        apiKey: config.apiKey === '' ? undefined : config.apiKey,
        vertexai: config.vertexai,
        httpOptions,
      });
      geminiGenerator = googleGenAI.models;
    }
  }

  return new MultiProviderContentGenerator(
    config,
    geminiGenerator,
    config.providerConfigManager,
  );
}