/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import { loadCliConfig } from './config.js';
import { Settings } from './settings.js';
import { Extension } from './extension.js';
import * as ServerConfig from '@google/gemini-cli-core';

vi.mock('os', async (importOriginal) => {
  const actualOs = await importOriginal<typeof os>();
  return {
    ...actualOs,
    homedir: vi.fn(() => '/mock/home/user'),
  };
});

vi.mock('open', () => ({
  default: vi.fn(),
}));

vi.mock('read-package-up', () => ({
  readPackageUp: vi.fn(() =>
    Promise.resolve({ packageJson: { version: 'test-version' } }),
  ),
}));

vi.mock('@google/gemini-cli-core', async () => {
  const actualServer = await vi.importActual<typeof ServerConfig>(
    '@google/gemini-cli-core',
  );
  return {
    ...actualServer,
    loadEnvironment: vi.fn(),
    loadServerHierarchicalMemory: vi.fn(
      (cwd, debug, fileService, extensionPaths) =>
        Promise.resolve({
          memoryContent: extensionPaths?.join(',') || '',
          fileCount: extensionPaths?.length || 0,
        }),
    ),
  };
});

describe('loadCliConfig', () => {
  const originalArgv = process.argv;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(os.homedir).mockReturnValue('/mock/home/user');
    process.env.GEMINI_API_KEY = 'test-api-key'; // Ensure API key is set for tests
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should set showMemoryUsage to true when --memory flag is present', async () => {
    process.argv = ['node', 'script.js', '--show_memory_usage'];
    const settings: Settings = {};
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getShowMemoryUsage()).toBe(true);
  });

  it('should set showMemoryUsage to false when --memory flag is not present', async () => {
    process.argv = ['node', 'script.js'];
    const settings: Settings = {};
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getShowMemoryUsage()).toBe(false);
  });

  it('should set showMemoryUsage to false by default from settings if CLI flag is not present', async () => {
    process.argv = ['node', 'script.js'];
    const settings: Settings = { showMemoryUsage: false };
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getShowMemoryUsage()).toBe(false);
  });

  it('should prioritize CLI flag over settings for showMemoryUsage (CLI true, settings false)', async () => {
    process.argv = ['node', 'script.js', '--show_memory_usage'];
    const settings: Settings = { showMemoryUsage: false };
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getShowMemoryUsage()).toBe(true);
  });
});

describe('loadCliConfig telemetry', () => {
  const originalArgv = process.argv;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(os.homedir).mockReturnValue('/mock/home/user');
    process.env.GEMINI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should set telemetry to false by default when no flag or setting is present', async () => {
    process.argv = ['node', 'script.js'];
    const settings: Settings = {};
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getTelemetryEnabled()).toBe(false);
  });

  it('should set telemetry to true when --telemetry flag is present', async () => {
    process.argv = ['node', 'script.js', '--telemetry'];
    const settings: Settings = {};
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getTelemetryEnabled()).toBe(true);
  });

  it('should set telemetry to false when --no-telemetry flag is present', async () => {
    process.argv = ['node', 'script.js', '--no-telemetry'];
    const settings: Settings = {};
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getTelemetryEnabled()).toBe(false);
  });

  it('should use telemetry value from settings if CLI flag is not present (settings true)', async () => {
    process.argv = ['node', 'script.js'];
    const settings: Settings = { telemetry: { enabled: true } };
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getTelemetryEnabled()).toBe(true);
  });

  it('should use telemetry value from settings if CLI flag is not present (settings false)', async () => {
    process.argv = ['node', 'script.js'];
    const settings: Settings = { telemetry: { enabled: false } };
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getTelemetryEnabled()).toBe(false);
  });

  it('should prioritize --telemetry CLI flag (true) over settings (false)', async () => {
    process.argv = ['node', 'script.js', '--telemetry'];
    const settings: Settings = { telemetry: { enabled: false } };
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getTelemetryEnabled()).toBe(true);
  });

  it('should prioritize --no-telemetry CLI flag (false) over settings (true)', async () => {
    process.argv = ['node', 'script.js', '--no-telemetry'];
    const settings: Settings = { telemetry: { enabled: true } };
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getTelemetryEnabled()).toBe(false);
  });

  it('should use telemetry OTLP endpoint from settings if CLI flag is not present', async () => {
    process.argv = ['node', 'script.js'];
    const settings: Settings = {
      telemetry: { otlpEndpoint: 'http://settings.example.com' },
    };
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getTelemetryOtlpEndpoint()).toBe(
      'http://settings.example.com',
    );
  });

  it('should prioritize --telemetry-otlp-endpoint CLI flag over settings', async () => {
    process.argv = [
      'node',
      'script.js',
      '--telemetry-otlp-endpoint',
      'http://cli.example.com',
    ];
    const settings: Settings = {
      telemetry: { otlpEndpoint: 'http://settings.example.com' },
    };
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getTelemetryOtlpEndpoint()).toBe('http://cli.example.com');
  });

  it('should use default endpoint if no OTLP endpoint is provided via CLI or settings', async () => {
    process.argv = ['node', 'script.js'];
    const settings: Settings = { telemetry: { enabled: true } };
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getTelemetryOtlpEndpoint()).toBe('http://localhost:4317');
  });

  it('should use telemetry target from settings if CLI flag is not present', async () => {
    process.argv = ['node', 'script.js'];
    const settings: Settings = {
      telemetry: { target: ServerConfig.DEFAULT_TELEMETRY_TARGET },
    };
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getTelemetryTarget()).toBe(
      ServerConfig.DEFAULT_TELEMETRY_TARGET,
    );
  });

  it('should prioritize --telemetry-target CLI flag over settings', async () => {
    process.argv = ['node', 'script.js', '--telemetry-target', 'gcp'];
    const settings: Settings = {
      telemetry: { target: ServerConfig.DEFAULT_TELEMETRY_TARGET },
    };
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getTelemetryTarget()).toBe('gcp');
  });

  it('should use default target if no target is provided via CLI or settings', async () => {
    process.argv = ['node', 'script.js'];
    const settings: Settings = { telemetry: { enabled: true } };
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getTelemetryTarget()).toBe(
      ServerConfig.DEFAULT_TELEMETRY_TARGET,
    );
  });

  it('should use telemetry log prompts from settings if CLI flag is not present', async () => {
    process.argv = ['node', 'script.js'];
    const settings: Settings = { telemetry: { logPrompts: false } };
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getTelemetryLogPromptsEnabled()).toBe(false);
  });

  it('should prioritize --telemetry-log-prompts CLI flag (true) over settings (false)', async () => {
    process.argv = ['node', 'script.js', '--telemetry-log-prompts'];
    const settings: Settings = { telemetry: { logPrompts: false } };
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getTelemetryLogPromptsEnabled()).toBe(true);
  });

  it('should prioritize --no-telemetry-log-prompts CLI flag (false) over settings (true)', async () => {
    process.argv = ['node', 'script.js', '--no-telemetry-log-prompts'];
    const settings: Settings = { telemetry: { logPrompts: true } };
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getTelemetryLogPromptsEnabled()).toBe(false);
  });

  it('should use default log prompts (true) if no value is provided via CLI or settings', async () => {
    process.argv = ['node', 'script.js'];
    const settings: Settings = { telemetry: { enabled: true } };
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getTelemetryLogPromptsEnabled()).toBe(true);
  });
});

describe('loadCliConfig proxy', () => {
  const originalArgv = process.argv;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(os.homedir).mockReturnValue('/mock/home/user');
    vi.stubEnv('GEMINI_API_KEY', 'test-api-key');
    vi.stubEnv('HTTPS_PROXY', '');
    vi.stubEnv('https_proxy', '');
    vi.stubEnv('HTTP_PROXY', '');
    vi.stubEnv('http_proxy', '');
    vi.stubEnv('ALL_PROXY', '');
    vi.stubEnv('all_proxy', '');
  });

  afterEach(() => {
    process.argv = originalArgv;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('should use proxy from settings', async () => {
    process.argv = ['node', 'script.js'];
    const settings: Settings = { proxy: 'http://settings.example.com' };
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getProxy()).toBe('http://settings.example.com');
  });

  it('should use proxy from HTTPS_PROXY env var', async () => {
    process.argv = ['node', 'script.js'];
    vi.stubEnv('HTTPS_PROXY', 'http://https.example.com');
    const settings: Settings = {};
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getProxy()).toBe('http://https.example.com');
  });

  it('should use proxy from https_proxy env var', async () => {
    process.argv = ['node', 'script.js'];
    vi.stubEnv('https_proxy', 'http://https_lower.example.com');
    const settings: Settings = {};
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getProxy()).toBe('http://https_lower.example.com');
  });

  it('should use proxy from HTTP_PROXY env var', async () => {
    process.argv = ['node', 'script.js'];
    vi.stubEnv('HTTP_PROXY', 'http://http.example.com');
    const settings: Settings = {};
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getProxy()).toBe('http://http.example.com');
  });

  it('should use proxy from http_proxy env var', async () => {
    process.argv = ['node', 'script.js'];
    vi.stubEnv('http_proxy', 'http://http_lower.example.com');
    const settings: Settings = {};
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getProxy()).toBe('http://http_lower.example.com');
  });

  it('should use proxy from ALL_PROXY env var', async () => {
    process.argv = ['node', 'script.js'];
    vi.stubEnv('ALL_PROXY', 'http://all.example.com');
    const settings: Settings = {};
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getProxy()).toBe('http://all.example.com');
  });

  it('should use proxy from all_proxy env var', async () => {
    process.argv = ['node', 'script.js'];
    vi.stubEnv('all_proxy', 'http://all_lower.example.com');
    const settings: Settings = {};
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getProxy()).toBe('http://all_lower.example.com');
  });

  it('should prioritize settings over env vars', async () => {
    process.argv = ['node', 'script.js'];
    vi.stubEnv('HTTPS_PROXY', 'http://https.example.com');
    const settings: Settings = { proxy: 'http://settings.example.com' };
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getProxy()).toBe('http://settings.example.com');
  });

  it('should prioritize CLI flag over settings and env vars', async () => {
    process.argv = ['node', 'script.js', '--proxy', 'http://cli.example.com'];
    vi.stubEnv('HTTPS_PROXY', 'http://https.example.com');
    const settings: Settings = { proxy: 'http://settings.example.com' };
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getProxy()).toBe('http://cli.example.com');
  });

  it('should allow overriding with an empty string from CLI', async () => {
    process.argv = ['node', 'script.js', '--proxy', ''];
    const settings: Settings = { proxy: 'http://settings.example.com' };
    const config = await loadCliConfig(settings, [], 'test-session');
    expect(config.getProxy()).toBe('');
  });
});

describe('Hierarchical Memory Loading (config.ts) - Placeholder Suite', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(os.homedir).mockReturnValue('/mock/home/user');
    // Other common mocks would be reset here.
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should pass extension context file paths to loadServerHierarchicalMemory', async () => {
    process.argv = ['node', 'script.js'];
    const settings: Settings = {};
    const extensions: Extension[] = [
      {
        config: {
          name: 'ext1',
          version: '1.0.0',
        },
        contextFiles: ['/path/to/ext1/GEMINI.md'],
      },
      {
        config: {
          name: 'ext2',
          version: '1.0.0',
        },
        contextFiles: [],
      },
      {
        config: {
          name: 'ext3',
          version: '1.0.0',
        },
        contextFiles: [
          '/path/to/ext3/context1.md',
          '/path/to/ext3/context2.md',
        ],
      },
    ];
    await loadCliConfig(settings, extensions, 'session-id');
    expect(ServerConfig.loadServerHierarchicalMemory).toHaveBeenCalledWith(
      expect.any(String),
      false,
      expect.any(Object),
      [
        '/path/to/ext1/GEMINI.md',
        '/path/to/ext3/context1.md',
        '/path/to/ext3/context2.md',
      ],
    );
  });

  // NOTE TO FUTURE DEVELOPERS:
  // To re-enable tests for loadHierarchicalGeminiMemory, ensure that:
  // 1. os.homedir() is reliably mocked *before* the config.ts module is loaded
  //    and its functions (which use os.homedir()) are called.
  // 2. fs/promises and fs mocks correctly simulate file/directory existence,
  //    readability, and content based on paths derived from the mocked os.homedir().
  // 3. Spies on console functions (for logger output) are correctly set up if needed.
  // Example of a previously failing test structure:
  /*
  it('should correctly use mocked homedir for global path', async () => {
    const MOCK_GEMINI_DIR_LOCAL = path.join('/mock/home/user', '.gemini');
    const MOCK_GLOBAL_PATH_LOCAL = path.join(MOCK_GEMINI_DIR_LOCAL, 'GEMINI.md');
    mockFs({
      [MOCK_GLOBAL_PATH_LOCAL]: { type: 'file', content: 'GlobalContentOnly' }
    });
    const memory = await loadHierarchicalGeminiMemory("/some/other/cwd", false);
    expect(memory).toBe('GlobalContentOnly');
    expect(vi.mocked(os.homedir)).toHaveBeenCalled();
    expect(fsPromises.readFile).toHaveBeenCalledWith(MOCK_GLOBAL_PATH_LOCAL, 'utf-8');
  });
  */
});

describe('mergeMcpServers', () => {
  it('should not modify the original settings object', async () => {
    const settings: Settings = {
      mcpServers: {
        'test-server': {
          url: 'http://localhost:8080',
        },
      },
    };
    const extensions: Extension[] = [
      {
        config: {
          name: 'ext1',
          version: '1.0.0',
          mcpServers: {
            'ext1-server': {
              url: 'http://localhost:8081',
            },
          },
        },
        contextFiles: [],
      },
    ];
    const originalSettings = JSON.parse(JSON.stringify(settings));
    await loadCliConfig(settings, extensions, 'test-session');
    expect(settings).toEqual(originalSettings);
  });
});
