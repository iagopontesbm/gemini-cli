/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LlmConfigManager } from './llmConfigManager.js';
import { ModelConfig, ProviderType } from './llmConfig.js';
import { promises as fs } from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Path to the test configuration file
const TEST_CONFIG_PATH = path.join(
  process.cwd(), // Assuming tests run from project root
  'packages/core/src/config/test_models.yaml',
);
const TEMP_TEST_CONFIG_PATH = path.join(
  process.cwd(),
  'packages/core/src/config/temp_test_models.yaml',
);

describe('LlmConfigManager', () => {
  let configManager: LlmConfigManager;

  beforeEach(async () => {
    // Create a temporary copy of the test config for each test
    // to avoid interference if tests modify it (though these tests don't)
    const originalContent = await fs.readFile(TEST_CONFIG_PATH, 'utf8');
    await fs.writeFile(TEMP_TEST_CONFIG_PATH, originalContent, 'utf8');
    configManager = new LlmConfigManager(TEMP_TEST_CONFIG_PATH);
  });

  afterEach(async () => {
    // Clean up the temporary config file
    try {
      await fs.unlink(TEMP_TEST_CONFIG_PATH);
    } catch (e) {
      // Ignore if file doesn't exist
    }
  });

  it('should load configuration from a YAML file', async () => {
    const config = await configManager.loadConfig();
    expect(config).toBeDefined();
    expect(config.models).toBeInstanceOf(Array);
    expect(config.models.length).toBeGreaterThan(0);
  });

  it('should get a model by title', async () => {
    await configManager.loadConfig();
    const model = configManager.getModel('test-openai');
    expect(model).toBeDefined();
    expect(model?.title).toBe('test-openai');
    expect(model?.provider).toBe(ProviderType.OPENAI);
    expect(model?.model).toBe('gpt-3.5-turbo');
    expect(model?.apiKey).toBe('sk-testkeyopenai');
  });

  it('should return undefined for a non-existent model title', async () => {
    await configManager.loadConfig();
    const model = configManager.getModel('non-existent-model');
    expect(model).toBeUndefined();
  });

  it('should get the default model', async () => {
    await configManager.loadConfig();
    const defaultModel = configManager.getDefaultModel();
    expect(defaultModel).toBeDefined();
    expect(defaultModel?.title).toBe('test-gemini');
    expect(defaultModel?.default).toBe(true);
  });

  it('should get all models', async () => {
    await configManager.loadConfig();
    const allModels = configManager.getAllModels();
    expect(allModels).toBeInstanceOf(Array);
    // Check based on the test_models.yaml content
    const expectedNumberOfModels = (
      yaml.load(await fs.readFile(TEST_CONFIG_PATH, 'utf8')) as {
        models: ModelConfig[];
      }
    ).models.length;
    expect(allModels.length).toBe(expectedNumberOfModels);
  });

  it('should handle a missing configuration file gracefully', async () => {
    const managerWithMissingFile = new LlmConfigManager('non-existent-path.yaml');
    await expect(managerWithMissingFile.loadConfig()).rejects.toThrow();
  });

  it('should handle an invalid YAML configuration file', async () => {
    const invalidYamlPath = path.join(
      process.cwd(),
      'packages/core/src/config/invalid_test_models.yaml',
    );
    await fs.writeFile(invalidYamlPath, 'models: - title: invalid\nprovider: [not, a, string]', 'utf8');
    const managerWithInvalidFile = new LlmConfigManager(invalidYamlPath);
    await expect(managerWithInvalidFile.loadConfig()).rejects.toThrow(/Invalid configuration file structure|yaml/i);
    await fs.unlink(invalidYamlPath);
  });

   it('should get the first model as default if no model is marked default', async () => {
    const noDefaultYamlPath = path.join(
      process.cwd(),
      'packages/core/src/config/no_default_test_models.yaml',
    );
    const content = {
      models: [
        { title: 'first-model', provider: 'openai', model: 'gpt-1' },
        { title: 'second-model', provider: 'ollama', model: 'llama1' },
      ],
    };
    await fs.writeFile(noDefaultYamlPath, yaml.dump(content), 'utf8');
    const manager = new LlmConfigManager(noDefaultYamlPath);
    await manager.loadConfig();
    const defaultModel = manager.getDefaultModel();
    expect(defaultModel).toBeDefined();
    expect(defaultModel?.title).toBe('first-model');
    await fs.unlink(noDefaultYamlPath);
  });

  it('should return undefined as default if config is empty or has no models', async () => {
    const emptyYamlPath = path.join(
      process.cwd(),
      'packages/core/src/config/empty_test_models.yaml',
    );
    await fs.writeFile(emptyYamlPath, yaml.dump({ models: [] }), 'utf8');
    const manager = new LlmConfigManager(emptyYamlPath);
    await manager.loadConfig();
    const defaultModel = manager.getDefaultModel();
    expect(defaultModel).toBeUndefined();
    await fs.unlink(emptyYamlPath);
  });

});
