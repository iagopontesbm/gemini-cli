/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  createContentGeneratorConfig,
  createContentGenerator,
  AuthType,
} from './contentGenerator.js';
import { LlmConfigManager } from '../config/llmConfigManager.js';
import { ProviderType, ModelConfig } from '../config/llmConfig.js';
import { OpenAiClient } from '../providers/openai_client.js';
import { AnthropicClient } from '../providers/anthropic_client.js';
import { OllamaClient } from '../providers/ollama_client.js';
// Import CodeAssistServer or a mock for Gemini testing if needed
// import { CodeAssistServer } from '../code_assist/server.js';
import { promises as fs } from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const TEST_CONFIG_PATH = path.join(
  process.cwd(),
  'packages/core/src/config/test_models.yaml',
);
const TEMP_TEST_CONFIG_PATH = path.join(
  process.cwd(),
  'packages/core/src/config/temp_content_generator_test_models.yaml',
);

describe('ContentGenerator Creation', () => {
  let llmConfigManager: LlmConfigManager;

  beforeEach(async () => {
    const originalContent = await fs.readFile(TEST_CONFIG_PATH, 'utf8');
    await fs.writeFile(TEMP_TEST_CONFIG_PATH, originalContent, 'utf8');
    llmConfigManager = new LlmConfigManager(TEMP_TEST_CONFIG_PATH);
    await llmConfigManager.loadConfig(); // Pre-load config for tests

    // Mock environment variables if they affect config creation
    vi.stubEnv('GEMINI_API_KEY', 'env-gemini-key');
    vi.stubEnv('GOOGLE_API_KEY', 'env-google-key'); // For Vertex
  });

  afterEach(async () => {
    try {
      await fs.unlink(TEMP_TEST_CONFIG_PATH);
    } catch (e) {
      // ignore
    }
    vi.unstubAllEnvs();
  });

  it('should create ContentGeneratorConfig for a specified OpenAI model', async () => {
    const config = await createContentGeneratorConfig(
      llmConfigManager,
      'test-openai',
    );
    expect(config).toBeDefined();
    expect(config.modelConfig.title).toBe('test-openai');
    expect(config.modelConfig.provider).toBe(ProviderType.OPENAI);
    expect(config.authType).toBe(AuthType.API_KEY);
  });

  it('should create ContentGeneratorConfig for the default Gemini model', async () => {
    const config = await createContentGeneratorConfig(llmConfigManager); // No title, should use default
    expect(config).toBeDefined();
    expect(config.modelConfig.title).toBe('test-gemini');
    expect(config.modelConfig.provider).toBe(ProviderType.GEMINI);
    // Default for Gemini is LOGIN_WITH_GOOGLE_PERSONAL from determineAuthTypeForProvider
    expect(config.authType).toBe(AuthType.LOGIN_WITH_GOOGLE_PERSONAL);
  });

  it('should create an OpenAiClient for an OpenAI model', async () => {
    const cgConfig = await createContentGeneratorConfig(
      llmConfigManager,
      'test-openai',
    );
    const generator = await createContentGenerator(cgConfig);
    expect(generator).toBeInstanceOf(OpenAiClient);
  });

  it('should create an AnthropicClient for an Anthropic model', async () => {
    const cgConfig = await createContentGeneratorConfig(
      llmConfigManager,
      'test-anthropic',
    );
    const generator = await createContentGenerator(cgConfig);
    expect(generator).toBeInstanceOf(AnthropicClient);
  });

  it('should create an OllamaClient for an Ollama model', async () => {
    const cgConfig = await createContentGeneratorConfig(
      llmConfigManager,
      'test-ollama',
    );
    const generator = await createContentGenerator(cgConfig);
    expect(generator).toBeInstanceOf(OllamaClient);
    // @ts-expect-error - private property access for test
    expect(generator.host).toBe('http://localhost:11434');
  });

  it('should use apiBase for OllamaClient host if provided in config', async () => {
    // This test relies on the 'test-ollama' entry in test_models.yaml having an apiBase
    const modelConfigFromYaml = llmConfigManager.getModel('test-ollama');
    expect(modelConfigFromYaml?.apiBase).toBe('http://localhost:11434'); // Verify assumption

    const cgConfig = await createContentGeneratorConfig(
      llmConfigManager,
      'test-ollama',
    );
    const generator = await createContentGenerator(cgConfig);
    expect(generator).toBeInstanceOf(OllamaClient);
    // @ts-expect-error - private property access for test
    expect(generator.host).toBe(modelConfigFromYaml?.apiBase);
  });

  it('should use apiBase for OpenAiClient if provided', async () => {
    const modelConfigFromYaml = llmConfigManager.getModel('custom-openai-clone');
    expect(modelConfigFromYaml?.apiBase).toBe('http://my-custom-openai:8080/v1');

    const cgConfig = await createContentGeneratorConfig(
      llmConfigManager,
      'custom-openai-clone',
    );
    const generator = await createContentGenerator(cgConfig);
    expect(generator).toBeInstanceOf(OpenAiClient);
    // @ts-expect-error - private property access for test
    expect(generator.apiBase).toBe(modelConfigFromYaml?.apiBase);
  });


  it('should throw an error for an unsupported provider', async () => {
    const cgConfig = {
      modelConfig: {
        title: 'unsupported-model',
        provider: 'unsupported-provider' as ProviderType, // Cast for test
        model: 'test',
      },
      authType: AuthType.NONE,
    };
    await expect(createContentGenerator(cgConfig)).rejects.toThrow(
      /Unsupported provider: unsupported-provider/,
    );
  });

  it('should throw an error if API key is missing for OpenAI', async () => {
    // Create a temporary config file without API key for this specific test case
    const noApiKeyYamlPath = path.join(TEMP_TEST_CONFIG_PATH + '_no_api_key.yaml');
    const configContent: { models: ModelConfig[] } = {
        models: [{
            title: 'openai-no-key',
            provider: ProviderType.OPENAI,
            model: 'gpt-4',
            // apiKey is explicitly missing
        }]
    };
    await fs.writeFile(noApiKeyYamlPath, yaml.dump(configContent), 'utf8');
    const specificManager = new LlmConfigManager(noApiKeyYamlPath);
    await specificManager.loadConfig();

    const cgConfig = await createContentGeneratorConfig(specificManager, 'openai-no-key');

    await expect(createContentGenerator(cgConfig)).rejects.toThrow(
      /API key is required for OpenAI provider \(model: openai-no-key\)/,
    );
    await fs.unlink(noApiKeyYamlPath);
  });

  it('should correctly fallback when a model title is not found', async () => {
    // Stub console.warn to check if it's called
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const cgConfig = await createContentGeneratorConfig(llmConfigManager, 'non-existent-model-title');

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Model with title 'non-existent-model-title' not found. Falling back to a default Gemini model."
    );
    expect(cgConfig.modelConfig.title).toBe('gemini-fallback');
    expect(cgConfig.modelConfig.provider).toBe(ProviderType.GEMINI);
    expect(cgConfig.modelConfig.model).toBe(process.env.DEFAULT_GEMINI_MODEL || 'gemini-1.0-pro'); // Check against models.ts
    expect(cgConfig.authType).toBe(AuthType.USE_GEMINI); // As per fallback logic

    consoleWarnSpy.mockRestore();
  });

  // TODO: Test for Gemini with LOGIN_WITH_GOOGLE_PERSONAL (requires mocking createCodeAssistContentGenerator)
  // TODO: Test for Gemini with USE_GEMINI API key (requires mocking GoogleGenAI and its models property, or preferably a dedicated Gemini client)
  // TODO: Test for Gemini with USE_VERTEX_AI (similarly requires mocking or a dedicated client)
  // TODO: Test explicit authType override in createContentGeneratorConfig
});
