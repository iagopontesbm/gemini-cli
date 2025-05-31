/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest'; // Added Mock, afterEach
import { render } from 'ink-testing-library';
import { App } from './App.js';
import { Config as ServerConfig, MCPServerConfig } from '@gemini-code/server'; // Import the (to be) mocked Config
import type { ToolRegistry } from '@gemini-code/server'; // Import type
import { LoadedSettings, SettingsFile, Settings } from '../config/settings.js';

// Define a more complete mock server config based on actual Config
interface MockServerConfig {
  apiKey: string;
  model: string;
  sandbox: boolean | string;
  targetDir: string;
  debugMode: boolean;
  question?: string;
  fullContext: boolean;
  coreTools?: string[];
  toolDiscoveryCommand?: string;
  toolCallCommand?: string;
  mcpServerCommand?: string;
  mcpServers?: Record<string, MCPServerConfig>; // Use imported MCPServerConfig
  userAgent: string;
  userMemory: string;
  geminiMdFileCount: number;
  alwaysSkipModificationConfirmation: boolean;
  vertexai?: boolean;

  getApiKey: Mock<() => string>;
  getModel: Mock<() => string>;
  getSandbox: Mock<() => boolean | string>;
  getTargetDir: Mock<() => string>;
  getToolRegistry: Mock<() => ToolRegistry>; // Use imported ToolRegistry type
  getDebugMode: Mock<() => boolean>;
  getQuestion: Mock<() => string | undefined>;
  getFullContext: Mock<() => boolean>;
  getCoreTools: Mock<() => string[] | undefined>;
  getToolDiscoveryCommand: Mock<() => string | undefined>;
  getToolCallCommand: Mock<() => string | undefined>;
  getMcpServerCommand: Mock<() => string | undefined>;
  getMcpServers: Mock<() => Record<string, MCPServerConfig> | undefined>;
  getUserAgent: Mock<() => string>;
  getUserMemory: Mock<() => string>;
  setUserMemory: Mock<(newUserMemory: string) => void>;
  getGeminiMdFileCount: Mock<() => number>;
  setGeminiMdFileCount: Mock<(count: number) => void>;
  getAlwaysSkipModificationConfirmation: Mock<() => boolean>;
  setAlwaysSkipModificationConfirmation: Mock<(skip: boolean) => void>;
  getVertexAI: Mock<() => boolean | undefined>;
}

// Mock @gemini-code/server and its Config class
vi.mock('@gemini-code/server', async (importOriginal) => {
  const actualServer =
    await importOriginal<typeof import('@gemini-code/server')>();
  const ConfigClassMock = vi
    .fn()
    .mockImplementation((optionsPassedToConstructor) => {
      const opts = { ...optionsPassedToConstructor }; // Clone
      // Basic mock structure, will be extended by the instance in tests
      return {
        apiKey: opts.apiKey || 'test-key',
        model: opts.model || 'test-model-in-mock-factory',
        sandbox: typeof opts.sandbox === 'boolean' ? opts.sandbox : false,
        targetDir: opts.targetDir || '/test/dir',
        debugMode: opts.debugMode || false,
        question: opts.question,
        fullContext: opts.fullContext ?? false,
        coreTools: opts.coreTools,
        toolDiscoveryCommand: opts.toolDiscoveryCommand,
        toolCallCommand: opts.toolCallCommand,
        mcpServerCommand: opts.mcpServerCommand,
        mcpServers: opts.mcpServers,
        userAgent: opts.userAgent || 'test-agent',
        userMemory: opts.userMemory || '',
        geminiMdFileCount: opts.geminiMdFileCount || 0,
        alwaysSkipModificationConfirmation:
          opts.alwaysSkipModificationConfirmation ?? false,
        vertexai: opts.vertexai,

        getApiKey: vi.fn(() => opts.apiKey || 'test-key'),
        getModel: vi.fn(() => opts.model || 'test-model-in-mock-factory'),
        getSandbox: vi.fn(() =>
          typeof opts.sandbox === 'boolean' ? opts.sandbox : false,
        ),
        getTargetDir: vi.fn(() => opts.targetDir || '/test/dir'),
        getToolRegistry: vi.fn(() => ({}) as ToolRegistry), // Simple mock
        getDebugMode: vi.fn(() => opts.debugMode || false),
        getQuestion: vi.fn(() => opts.question),
        getFullContext: vi.fn(() => opts.fullContext ?? false),
        getCoreTools: vi.fn(() => opts.coreTools),
        getToolDiscoveryCommand: vi.fn(() => opts.toolDiscoveryCommand),
        getToolCallCommand: vi.fn(() => opts.toolCallCommand),
        getMcpServerCommand: vi.fn(() => opts.mcpServerCommand),
        getMcpServers: vi.fn(() => opts.mcpServers),
        getUserAgent: vi.fn(() => opts.userAgent || 'test-agent'),
        getUserMemory: vi.fn(() => opts.userMemory || ''),
        setUserMemory: vi.fn(),
        getGeminiMdFileCount: vi.fn(() => opts.geminiMdFileCount || 0),
        setGeminiMdFileCount: vi.fn(),
        getAlwaysSkipModificationConfirmation: vi.fn(
          () => opts.alwaysSkipModificationConfirmation ?? false,
        ),
        setAlwaysSkipModificationConfirmation: vi.fn(),
        getVertexAI: vi.fn(() => opts.vertexai),
      };
    });
  return {
    ...actualServer,
    Config: ConfigClassMock,
    // Export MCPServerConfig if it's used by the mock, or ensure it's available
  };
});

// Mock heavy dependencies or those with side effects
vi.mock('./hooks/useGeminiStream', () => ({
  useGeminiStream: vi.fn(() => ({
    streamingState: 'Idle',
    submitQuery: vi.fn(),
    initError: null,
    pendingHistoryItems: [],
  })),
}));

vi.mock('./hooks/useLogger', () => ({
  useLogger: vi.fn(() => ({
    getPreviousUserMessages: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('../config/config.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    // @ts-expect-error - this is fine
    ...actual,
    loadHierarchicalGeminiMemory: vi
      .fn()
      .mockResolvedValue({ memoryContent: '', fileCount: 0 }),
  };
});

describe('App UI', () => {
  let mockConfig: MockServerConfig;
  let mockSettings: LoadedSettings;
  let currentUnmount: (() => void) | undefined;

  const createMockSettings = (
    settings: Partial<Settings> = {},
  ): LoadedSettings => {
    const userSettingsFile: SettingsFile = {
      path: '/user/settings.json',
      settings: {},
    };
    const workspaceSettingsFile: SettingsFile = {
      path: '/workspace/.gemini/settings.json',
      settings,
    };
    return new LoadedSettings(userSettingsFile, workspaceSettingsFile);
  };

  beforeEach(() => {
    const ServerConfigMocked = vi.mocked(ServerConfig, true);
    mockConfig = new ServerConfigMocked({
      apiKey: 'test-key',
      model: 'test-model-in-options',
      sandbox: false,
      targetDir: '/test/dir',
      debugMode: false,
      userAgent: 'test-agent',
      userMemory: '',
      geminiMdFileCount: 0,
      // Provide other required fields for ConfigParameters if necessary
    }) as unknown as MockServerConfig;

    mockSettings = createMockSettings();
  });

  afterEach(() => {
    if (currentUnmount) {
      currentUnmount();
      currentUnmount = undefined;
    }
  });

  it('should display default "GEMINI.md" in footer when contextFileName is not set and count is 1', async () => {
    mockConfig.getGeminiMdFileCount.mockReturnValue(1);
    const { lastFrame, unmount } = render(
      <App
        config={mockConfig as unknown as ServerConfig}
        settings={mockSettings}
        cliVersion="1.0.0"
      />,
    );
    currentUnmount = unmount;
    await Promise.resolve(); // Wait for any async updates
    expect(lastFrame()).toContain('Using 1 GEMINI.md file');
  });

  it('should display default "GEMINI.md" with plural when contextFileName is not set and count is > 1', async () => {
    mockConfig.getGeminiMdFileCount.mockReturnValue(2);
    const { lastFrame, unmount } = render(
      <App
        config={mockConfig as unknown as ServerConfig}
        settings={mockSettings}
        cliVersion="1.0.0"
      />,
    );
    currentUnmount = unmount;
    await Promise.resolve();
    expect(lastFrame()).toContain('Using 2 GEMINI.md files');
  });

  it('should display custom contextFileName in footer when set and count is 1', async () => {
    mockSettings = createMockSettings({ contextFileName: 'AGENTS.MD' });
    mockConfig.getGeminiMdFileCount.mockReturnValue(1);

    const { lastFrame, unmount } = render(
      <App
        config={mockConfig as unknown as ServerConfig}
        settings={mockSettings}
        cliVersion="1.0.0"
      />,
    );
    currentUnmount = unmount;
    await Promise.resolve();
    expect(lastFrame()).toContain('Using 1 AGENTS.MD file');
  });

  it('should display custom contextFileName with plural when set and count is > 1', async () => {
    mockSettings = createMockSettings({ contextFileName: 'MY_NOTES.TXT' });
    mockConfig.getGeminiMdFileCount.mockReturnValue(3);
    const { lastFrame, unmount } = render(
      <App
        config={mockConfig as unknown as ServerConfig}
        settings={mockSettings}
        cliVersion="1.0.0"
      />,
    );
    currentUnmount = unmount;
    await Promise.resolve();
    expect(lastFrame()).toContain('Using 3 MY_NOTES.TXT files');
  });

  it('should not display context file message if count is 0, even if contextFileName is set', async () => {
    mockSettings = createMockSettings({ contextFileName: 'ANY_FILE.MD' });
    mockConfig.getGeminiMdFileCount.mockReturnValue(0);

    const { lastFrame, unmount } = render(
      <App
        config={mockConfig as unknown as ServerConfig}
        settings={mockSettings}
        cliVersion="1.0.0"
      />,
    );
    currentUnmount = unmount;
    await Promise.resolve();
    expect(lastFrame()).not.toContain('ANY_FILE.MD');
  });
});
