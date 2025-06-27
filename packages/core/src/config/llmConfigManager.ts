/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { LlmConfig, ModelConfig, ProviderType } from './llmConfig.js';

const DEFAULT_CONFIG_PATH = '.gemini/models.yaml'; // Or models.json, or another path

export class LlmConfigManager {
  private config: LlmConfig | null = null;
  private configPath: string;

  constructor(configPath: string = DEFAULT_CONFIG_PATH) {
    this.configPath = configPath;
  }

  public async loadConfig(): Promise<LlmConfig> {
    try {
      const fileContents = await fs.promises.readFile(this.configPath, 'utf8');
      this.config = yaml.load(fileContents) as LlmConfig;
      // TODO: Add validation for the loaded configuration
      if (!this.config || !this.config.models) {
        throw new Error('Invalid configuration file structure.');
      }
      return this.config;
    } catch (error) {
      // TODO: Handle errors more gracefully, e.g., by providing a default config
      console.error(`Error loading LLM configuration from ${this.configPath}:`, error);
      throw error;
    }
  }

  public getModel(title: string): ModelConfig | undefined {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }
    return this.config.models.find((model) => model.title === title);
  }

  public getDefaultModel(): ModelConfig | undefined {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }
    const defaultConfig = this.config.models.find((model) => model.default);
    return defaultConfig || (this.config.models.length > 0 ? this.config.models[0] : undefined);
  }

  public getAllModels(): ModelConfig[] {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }
    return this.config.models;
  }

  // TODO: Add methods to get models by provider, etc.
}

// Example usage (optional, for testing or direct use)
// async function main() {
//   const configManager = new LlmConfigManager();
//   try {
//     const config = await configManager.loadConfig();
//     console.log('LLM Configuration loaded:', JSON.stringify(config, null, 2));
//     const defaultModel = configManager.getDefaultModel();
//     console.log('Default model:', defaultModel);
//   } catch (error) {
//     console.error('Failed to load or process LLM configuration.');
//   }
// }

// if (process.argv[1] === new URL(import.meta.url).pathname) {
//   main();
// }
