/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { loadCliConfig } from './config.js';
import { LoadedSettings, Settings } from './settings.js';
import * as fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';

// Mock dependencies
vi.mock('@gemini-code/core', async () => {
  const actual = await vi.importActual('@gemini-code/core');
  return {
    ...actual,
    loadEnvironment: vi.fn(),
    createServerConfig: vi.fn((params) => ({
      getFileFilteringRespectGitIgnore: () => params.fileFilteringRespectGitIgnore ?? true,
      getFileFilteringCustomIgnorePatterns: () => params.fileFilteringCustomIgnorePatterns ?? [],
      getFileFilteringAllowBuildArtifacts: () => params.fileFilteringAllowBuildArtifacts ?? false,
      getSandboxCleanupAutoCleanOnExit: () => params.sandboxCleanupAutoCleanOnExit ?? false,
      getSandboxCleanupPreservePatterns: () => params.sandboxCleanupPreservePatterns ?? [],
      getSandboxCleanupAggressiveMode: () => params.sandboxCleanupAggressiveMode ?? false,
      getSandboxCleanupConfirmBeforeCleanup: () => params.sandboxCleanupConfirmBeforeCleanup ?? true,
      getTargetDir: () => '/test/project',
      getApiKey: () => 'test-api-key',
      getModel: () => 'test-model',
      getSandbox: () => false,
      getDebugMode: () => false,
      getQuestion: () => '',
      getFullContext: () => false,
      getCoreTools: () => undefined,
      getToolDiscoveryCommand: () => undefined,
      getToolCallCommand: () => undefined,
      getMcpServerCommand: () => undefined,
      getMcpServers: () => undefined,
      getUserAgent: () => 'test-agent',
      getUserMemory: () => '',
      getGeminiMdFileCount: () => 0,
      getAlwaysSkipModificationConfirmation: () => false,
      getVertexAI: () => false,
      getShowMemoryUsage: () => false,
    })),
    loadServerHierarchicalMemory: vi.fn().mockResolvedValue(['', 0]),
  };
});

describe('Configuration Integration Tests', () => {
  let tempDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(tmpdir(), 'gemini-cli-test-'));
    originalEnv = { ...process.env };
    process.env.GEMINI_API_KEY = 'test-api-key';
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('File Filtering Configuration', () => {
    it('should load default file filtering settings', async () => {
      const settings: Settings = {};
      const loadedSettings = new LoadedSettings(
        { path: '', settings },
        { path: '', settings }
      );

      const config = await loadCliConfig(loadedSettings.merged);

      expect(config.getFileFilteringRespectGitIgnore()).toBe(true);
      expect(config.getFileFilteringCustomIgnorePatterns()).toEqual([]);
      expect(config.getFileFilteringAllowBuildArtifacts()).toBe(false);
    });

    it('should load custom file filtering settings from configuration', async () => {
      const settings: Settings = {
        fileFiltering: {
          respectGitIgnore: false,
          customIgnorePatterns: ['temp/', '*.log'],
          allowBuildArtifacts: true,
        },
      };
      const loadedSettings = new LoadedSettings(
        { path: '', settings },
        { path: '', settings }
      );

      const config = await loadCliConfig(loadedSettings.merged);

      expect(config.getFileFilteringRespectGitIgnore()).toBe(false);
      expect(config.getFileFilteringCustomIgnorePatterns()).toEqual(['temp/', '*.log']);
      expect(config.getFileFilteringAllowBuildArtifacts()).toBe(true);
    });

    it('should merge user and workspace file filtering settings', async () => {
      const userSettings: Settings = {
        fileFiltering: {
          respectGitIgnore: true,
          customIgnorePatterns: ['user-pattern'],
        },
      };
      const workspaceSettings: Settings = {
        fileFiltering: {
          customIgnorePatterns: ['workspace-pattern'],
          allowBuildArtifacts: true,
        },
      };
      const loadedSettings = new LoadedSettings(
        { path: '', settings: userSettings },
        { path: '', settings: workspaceSettings }
      );

      const config = await loadCliConfig(loadedSettings.merged);

      // Workspace settings should override user settings completely (object spread behavior)
      expect(config.getFileFilteringCustomIgnorePatterns()).toEqual(['workspace-pattern']);
      expect(config.getFileFilteringAllowBuildArtifacts()).toBe(true);
      // User setting is lost because workspace completely overrides the fileFiltering object
      expect(config.getFileFilteringRespectGitIgnore()).toBe(true); // Default value since not specified in workspace
    });
  });

  describe('Sandbox Cleanup Configuration', () => {
    it('should load default sandbox cleanup settings', async () => {
      const settings: Settings = {};
      const loadedSettings = new LoadedSettings(
        { path: '', settings },
        { path: '', settings }
      );

      const config = await loadCliConfig(loadedSettings.merged);

      expect(config.getSandboxCleanupAutoCleanOnExit()).toBe(false);
      expect(config.getSandboxCleanupPreservePatterns()).toEqual([]);
      expect(config.getSandboxCleanupAggressiveMode()).toBe(false);
      expect(config.getSandboxCleanupConfirmBeforeCleanup()).toBe(true);
    });

    it('should load custom sandbox cleanup settings from configuration', async () => {
      const settings: Settings = {
        sandboxCleanup: {
          autoCleanOnExit: true,
          preservePatterns: ['*.example', 'important.*'],
          aggressiveMode: true,
          confirmBeforeCleanup: false,
        },
      };
      const loadedSettings = new LoadedSettings(
        { path: '', settings },
        { path: '', settings }
      );

      const config = await loadCliConfig(loadedSettings.merged);

      expect(config.getSandboxCleanupAutoCleanOnExit()).toBe(true);
      expect(config.getSandboxCleanupPreservePatterns()).toEqual(['*.example', 'important.*']);
      expect(config.getSandboxCleanupAggressiveMode()).toBe(true);
      expect(config.getSandboxCleanupConfirmBeforeCleanup()).toBe(false);
    });

    it('should merge user and workspace sandbox cleanup settings', async () => {
      const userSettings: Settings = {
        sandboxCleanup: {
          autoCleanOnExit: true,
          preservePatterns: ['user-preserve'],
        },
      };
      const workspaceSettings: Settings = {
        sandboxCleanup: {
          preservePatterns: ['workspace-preserve'],
          aggressiveMode: true,
        },
      };
      const loadedSettings = new LoadedSettings(
        { path: '', settings: userSettings },
        { path: '', settings: workspaceSettings }
      );

      const config = await loadCliConfig(loadedSettings.merged);

      // Workspace settings should override user settings completely (object spread behavior)
      expect(config.getSandboxCleanupPreservePatterns()).toEqual(['workspace-preserve']);
      expect(config.getSandboxCleanupAggressiveMode()).toBe(true);
      // User setting is lost because workspace completely overrides the sandboxCleanup object
      expect(config.getSandboxCleanupAutoCleanOnExit()).toBe(false);
      // Default should be used when neither user nor workspace specifies
      expect(config.getSandboxCleanupConfirmBeforeCleanup()).toBe(true);
    });
  });

  describe('Configuration Integration', () => {
    it('should handle partial configuration objects gracefully', async () => {
      const settings: Settings = {
        fileFiltering: {
          respectGitIgnore: false,
          // Missing customIgnorePatterns and allowBuildArtifacts
        },
        sandboxCleanup: {
          aggressiveMode: true,
          // Missing other sandbox cleanup settings
        },
      };
      const loadedSettings = new LoadedSettings(
        { path: '', settings },
        { path: '', settings }
      );

      const config = await loadCliConfig(loadedSettings.merged);

      // Specified settings should be applied
      expect(config.getFileFilteringRespectGitIgnore()).toBe(false);
      expect(config.getSandboxCleanupAggressiveMode()).toBe(true);

      // Missing settings should use defaults
      expect(config.getFileFilteringCustomIgnorePatterns()).toEqual([]);
      expect(config.getFileFilteringAllowBuildArtifacts()).toBe(false);
      expect(config.getSandboxCleanupAutoCleanOnExit()).toBe(false);
      expect(config.getSandboxCleanupPreservePatterns()).toEqual([]);
      expect(config.getSandboxCleanupConfirmBeforeCleanup()).toBe(true);
    });

    it('should handle empty configuration objects gracefully', async () => {
      const settings: Settings = {
        fileFiltering: {},
        sandboxCleanup: {},
      };
      const loadedSettings = new LoadedSettings(
        { path: '', settings },
        { path: '', settings }
      );

      const config = await loadCliConfig(loadedSettings.merged);

      // All settings should use defaults
      expect(config.getFileFilteringRespectGitIgnore()).toBe(true);
      expect(config.getFileFilteringCustomIgnorePatterns()).toEqual([]);
      expect(config.getFileFilteringAllowBuildArtifacts()).toBe(false);
      expect(config.getSandboxCleanupAutoCleanOnExit()).toBe(false);
      expect(config.getSandboxCleanupPreservePatterns()).toEqual([]);
      expect(config.getSandboxCleanupAggressiveMode()).toBe(false);
      expect(config.getSandboxCleanupConfirmBeforeCleanup()).toBe(true);
    });

    it('should handle missing configuration sections gracefully', async () => {
      const settings: Settings = {
        theme: 'VS2015',
        // Missing fileFiltering and sandboxCleanup sections
      };
      const loadedSettings = new LoadedSettings(
        { path: '', settings },
        { path: '', settings }
      );

      const config = await loadCliConfig(loadedSettings.merged);

      // All git-aware settings should use defaults
      expect(config.getFileFilteringRespectGitIgnore()).toBe(true);
      expect(config.getFileFilteringCustomIgnorePatterns()).toEqual([]);
      expect(config.getFileFilteringAllowBuildArtifacts()).toBe(false);
      expect(config.getSandboxCleanupAutoCleanOnExit()).toBe(false);
      expect(config.getSandboxCleanupPreservePatterns()).toEqual([]);
      expect(config.getSandboxCleanupAggressiveMode()).toBe(false);
      expect(config.getSandboxCleanupConfirmBeforeCleanup()).toBe(true);
    });
  });

  describe('Real-world Configuration Scenarios', () => {
    it('should handle a security-focused configuration', async () => {
      const settings: Settings = {
        fileFiltering: {
          respectGitIgnore: true,
          customIgnorePatterns: ['secrets/', '*.key', '*.pem'],
          allowBuildArtifacts: false,
        },
        sandboxCleanup: {
          autoCleanOnExit: false,
          preservePatterns: ['*.example', '*.template'],
          aggressiveMode: false,
          confirmBeforeCleanup: true,
        },
      };
      const loadedSettings = new LoadedSettings(
        { path: '', settings },
        { path: '', settings }
      );

      const config = await loadCliConfig(loadedSettings.merged);

      expect(config.getFileFilteringRespectGitIgnore()).toBe(true);
      expect(config.getFileFilteringCustomIgnorePatterns()).toEqual(['secrets/', '*.key', '*.pem']);
      expect(config.getFileFilteringAllowBuildArtifacts()).toBe(false);
      expect(config.getSandboxCleanupConfirmBeforeCleanup()).toBe(true);
      expect(config.getSandboxCleanupAggressiveMode()).toBe(false);
    });

    it('should handle a development-focused configuration', async () => {
      const settings: Settings = {
        fileFiltering: {
          respectGitIgnore: true,
          customIgnorePatterns: ['logs/', 'tmp/'],
          allowBuildArtifacts: true,
        },
        sandboxCleanup: {
          autoCleanOnExit: true,
          preservePatterns: ['config.*.example'],
          aggressiveMode: false,
          confirmBeforeCleanup: false,
        },
      };
      const loadedSettings = new LoadedSettings(
        { path: '', settings },
        { path: '', settings }
      );

      const config = await loadCliConfig(loadedSettings.merged);

      expect(config.getFileFilteringAllowBuildArtifacts()).toBe(true);
      expect(config.getSandboxCleanupAutoCleanOnExit()).toBe(true);
      expect(config.getSandboxCleanupConfirmBeforeCleanup()).toBe(false);
    });

    it('should handle a CI/CD environment configuration', async () => {
      const settings: Settings = {
        fileFiltering: {
          respectGitIgnore: false, // CI might need to see all files
          customIgnorePatterns: [],
          allowBuildArtifacts: true,
        },
        sandboxCleanup: {
          autoCleanOnExit: true,
          preservePatterns: [],
          aggressiveMode: true, // Clean everything in CI
          confirmBeforeCleanup: false,
        },
      };
      const loadedSettings = new LoadedSettings(
        { path: '', settings },
        { path: '', settings }
      );

      const config = await loadCliConfig(loadedSettings.merged);

      expect(config.getFileFilteringRespectGitIgnore()).toBe(false);
      expect(config.getFileFilteringAllowBuildArtifacts()).toBe(true);
      expect(config.getSandboxCleanupAutoCleanOnExit()).toBe(true);
      expect(config.getSandboxCleanupAggressiveMode()).toBe(true);
      expect(config.getSandboxCleanupConfirmBeforeCleanup()).toBe(false);
    });
  });
});