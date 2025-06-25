/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ProviderConfig {
  /** Provider identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Provider type for routing logic */
  type: 'openrouter' | 'deepseek' | 'openai-compatible' | 'gemini';
  /** Base API URL */
  baseUrl: string;
  /** Authentication configuration */
  auth: {
    /** API key for the provider */
    apiKey: string;
    /** Optional: HTTP headers for authentication */
    headers?: Record<string, string>;
  };
  /** Model configurations for different use cases */
  models: {
    /** Primary chat model */
    chat: string;
    /** Fast/lightweight model for simple tasks */
    fast?: string;
    /** Embedding model for vector operations */
    embedding?: string;
    /** Code-specific model if available */
    code?: string;
  };
  /** Provider-specific settings */
  settings?: {
    /** Request timeout in milliseconds */
    timeout?: number;
    /** Maximum retries for failed requests */
    maxRetries?: number;
    /** Rate limiting configuration */
    rateLimit?: {
      requestsPerMinute?: number;
      tokensPerMinute?: number;
    };
    /** Provider-specific parameters */
    parameters?: Record<string, unknown>;
  };
}

export interface ProvidersConfiguration {
  /** Default provider ID to use */
  defaultProvider: string;
  /** List of configured providers */
  providers: ProviderConfig[];
  /** Model routing rules */
  modelRouting?: {
    /** Which provider to use for chat */
    chat?: string;
    /** Which provider to use for fast/simple tasks */
    fast?: string;
    /** Which provider to use for embeddings */
    embedding?: string;
    /** Which provider to use for code tasks */
    code?: string;
  };
}

export class ProviderConfigManager {
  private config: ProvidersConfiguration;

  constructor(config: ProvidersConfiguration) {
    this.config = config;
    this.validateConfig();
  }

  private validateConfig(): void {
    if (!this.config.defaultProvider) {
      throw new Error('Default provider must be specified');
    }

    if (!this.config.providers || this.config.providers.length === 0) {
      throw new Error('At least one provider must be configured');
    }

    const providerIds = this.config.providers.map(p => p.id);
    const defaultExists = providerIds.includes(this.config.defaultProvider);
    if (!defaultExists) {
      throw new Error(`Default provider '${this.config.defaultProvider}' not found in providers list`);
    }

    // Validate each provider
    for (const provider of this.config.providers) {
      if (!provider.id || !provider.name || !provider.type || !provider.baseUrl) {
        throw new Error(`Provider ${provider.id || 'unknown'} is missing required fields`);
      }

      if (!provider.auth?.apiKey) {
        throw new Error(`Provider ${provider.id} is missing API key`);
      }

      if (!provider.models?.chat) {
        throw new Error(`Provider ${provider.id} is missing chat model configuration`);
      }
    }
  }

  getDefaultProvider(): ProviderConfig {
    return this.getProvider(this.config.defaultProvider);
  }

  getProvider(providerId: string): ProviderConfig {
    const provider = this.config.providers.find(p => p.id === providerId);
    if (!provider) {
      throw new Error(`Provider '${providerId}' not found`);
    }
    return provider;
  }

  getProviderForTask(task: 'chat' | 'fast' | 'embedding' | 'code'): ProviderConfig {
    const routingProviderId = this.config.modelRouting?.[task];
    if (routingProviderId) {
      return this.getProvider(routingProviderId);
    }
    return this.getDefaultProvider();
  }

  getModelForTask(task: 'chat' | 'fast' | 'embedding' | 'code'): string {
    const provider = this.getProviderForTask(task);
    
    switch (task) {
      case 'chat':
        return provider.models.chat;
      case 'fast':
        return provider.models.fast || provider.models.chat;
      case 'embedding':
        return provider.models.embedding || provider.models.chat;
      case 'code':
        return provider.models.code || provider.models.chat;
      default:
        return provider.models.chat;
    }
  }

  getAllProviders(): ProviderConfig[] {
    return [...this.config.providers];
  }

  static fromJson(json: string): ProviderConfigManager {
    try {
      const config = JSON.parse(json) as ProvidersConfiguration;
      return new ProviderConfigManager(config);
    } catch (error) {
      throw new Error(`Failed to parse provider configuration: ${error}`);
    }
  }

  static async fromFile(filePath: string): Promise<ProviderConfigManager> {
    try {
      const fs = await import('node:fs/promises');
      const content = await fs.readFile(filePath, 'utf-8');
      return ProviderConfigManager.fromJson(content);
    } catch (error) {
      throw new Error(`Failed to load provider configuration from ${filePath}: ${error}`);
    }
  }
}