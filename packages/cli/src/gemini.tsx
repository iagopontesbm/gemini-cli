/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { render } from 'ink';
import { AppWrapper } from './ui/App.js';
import { loadCliConfig } from './config/config.js';
import { readStdin } from './utils/readStdin.js';
import { basename } from 'node:path';
import v8 from 'node:v8';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { start_sandbox } from './utils/sandbox.js';
import {
  LoadedSettings,
  loadSettings,
  SettingScope,
} from './config/settings.js';
import { themeManager } from './ui/themes/theme-manager.js';
import { getStartupWarnings } from './utils/startupWarnings.js';
import { runNonInteractive } from './nonInteractiveCli.js';
import { loadExtensions, Extension } from './config/extension.js';
import { cleanupCheckpoints } from './utils/cleanup.js';
import {
  ApprovalMode,
  Config,
  EditTool,
  ShellTool,
  WriteFileTool,
  sessionId,
  logUserPrompt,
  AuthType,
  recordStartupPerformance,
  isPerformanceMonitoringActive,
  startGlobalMemoryMonitoring,
  recordCurrentMemoryUsage,
} from '@google/gemini-cli-core';
import { validateAuthMethod } from './config/auth.js';
import { setMaxSizedBoxDebugging } from './ui/components/shared/MaxSizedBox.js';

function getNodeMemoryArgs(config: Config): string[] {
  const totalMemoryMB = os.totalmem() / (1024 * 1024);
  const heapStats = v8.getHeapStatistics();
  const currentMaxOldSpaceSizeMb = Math.floor(
    heapStats.heap_size_limit / 1024 / 1024,
  );

  // Set target to 50% of total memory
  const targetMaxOldSpaceSizeInMB = Math.floor(totalMemoryMB * 0.5);
  if (config.getDebugMode()) {
    console.debug(
      `Current heap size ${currentMaxOldSpaceSizeMb.toFixed(2)} MB`,
    );
  }

  if (process.env.GEMINI_CLI_NO_RELAUNCH) {
    return [];
  }

  if (targetMaxOldSpaceSizeInMB > currentMaxOldSpaceSizeMb) {
    if (config.getDebugMode()) {
      console.debug(
        `Need to relaunch with more memory: ${targetMaxOldSpaceSizeInMB.toFixed(2)} MB`,
      );
    }
    return [`--max-old-space-size=${targetMaxOldSpaceSizeInMB}`];
  }

  return [];
}

async function relaunchWithAdditionalArgs(additionalArgs: string[]) {
  const nodeArgs = [...additionalArgs, ...process.argv.slice(1)];
  const newEnv = { ...process.env, GEMINI_CLI_NO_RELAUNCH: 'true' };

  const child = spawn(process.execPath, nodeArgs, {
    stdio: 'inherit',
    env: newEnv,
  });

  await new Promise((resolve) => child.on('close', resolve));
  process.exit(0);
}

export async function main() {
  const startupStart = performance.now();
  const workspaceRoot = process.cwd();

  // Settings loading phase
  const settingsStart = performance.now();
  const settings = loadSettings(workspaceRoot);
  const settingsEnd = performance.now();
  const settingsDuration = settingsEnd - settingsStart;

  // Cleanup phase
  const cleanupStart = performance.now();
  await cleanupCheckpoints();
  const cleanupEnd = performance.now();
  const cleanupDuration = cleanupEnd - cleanupStart;

  if (settings.errors.length > 0) {
    for (const error of settings.errors) {
      let errorMessage = `Error in ${error.path}: ${error.message}`;
      if (!process.env.NO_COLOR) {
        errorMessage = `\x1b[31m${errorMessage}\x1b[0m`;
      }
      console.error(errorMessage);
      console.error(`Please fix ${error.path} and try again.`);
    }
    process.exit(1);
  }

  // Extensions loading phase
  const extensionsStart = performance.now();
  const extensions = loadExtensions(workspaceRoot);
  const extensionsEnd = performance.now();
  const extensionsDuration = extensionsEnd - extensionsStart;

  // CLI config loading phase
  const configStart = performance.now();
  const config = await loadCliConfig(settings.merged, extensions, sessionId);
  const configEnd = performance.now();
  const configDuration = configEnd - configStart;

  // Initialize memory monitoring if performance monitoring is enabled
  if (isPerformanceMonitoringActive()) {
    startGlobalMemoryMonitoring(config, 10000); // Monitor every 10 seconds
    recordCurrentMemoryUsage(config, 'startup_post_config');
  }

  // set default fallback to gemini api key
  // this has to go after load cli because thats where the env is set
  if (!settings.merged.selectedAuthType && process.env.GEMINI_API_KEY) {
    settings.setValue(
      SettingScope.User,
      'selectedAuthType',
      AuthType.USE_GEMINI,
    );
  }

  setMaxSizedBoxDebugging(config.getDebugMode());

  // File service initialization phase
  const fileServiceStart = performance.now();
  config.getFileService();
  const fileServiceEnd = performance.now();
  const fileServiceDuration = fileServiceEnd - fileServiceStart;

  // Git service initialization phase
  let gitServiceDuration = 0;
  if (config.getCheckpointingEnabled()) {
    const gitServiceStart = performance.now();
    try {
      await config.getGitService();
    } catch (err) {
      // Log a warning if the git service fails to initialize, so the user knows checkpointing may not work.
      console.warn(
        `Warning: Could not initialize git service. Checkpointing may not be available. Error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const gitServiceEnd = performance.now();
    gitServiceDuration = gitServiceEnd - gitServiceStart;
  }

  // Theme loading phase
  const themeStart = performance.now();
  if (settings.merged.theme) {
    if (!themeManager.setActiveTheme(settings.merged.theme)) {
      // If the theme is not found during initial load, log a warning and continue.
      // The useThemeCommand hook in App.tsx will handle opening the dialog.
      console.warn(`Warning: Theme "${settings.merged.theme}" not found.`);
    }
  }
  const themeEnd = performance.now();
  const themeDuration = themeEnd - themeStart;

  const memoryArgs = settings.merged.autoConfigureMaxOldSpaceSize
    ? getNodeMemoryArgs(config)
    : [];

  // hop into sandbox if we are outside and sandboxing is enabled
  if (!process.env.SANDBOX) {
    const sandboxConfig = config.getSandbox();
    if (sandboxConfig) {
      if (settings.merged.selectedAuthType) {
        // Validate authentication here because the sandbox will interfere with the Oauth2 web redirect.
        try {
          const authStart = performance.now();
          const err = validateAuthMethod(settings.merged.selectedAuthType);
          if (err) {
            throw new Error(err);
          }
          await config.refreshAuth(settings.merged.selectedAuthType);
          const authEnd = performance.now();
          const authDuration = authEnd - authStart;

          // Record authentication performance if monitoring is active
          if (isPerformanceMonitoringActive()) {
            recordStartupPerformance(config, 'authentication', authDuration, {
              auth_type: settings.merged.selectedAuthType,
            });
          }
        } catch (err) {
          console.error('Error authenticating:', err);
          process.exit(1);
        }
      }
      const sandboxStart = performance.now();
      await start_sandbox(sandboxConfig, memoryArgs);
      const sandboxEnd = performance.now();
      const sandboxDuration = sandboxEnd - sandboxStart;

      // Record sandbox performance if monitoring is active
      if (isPerformanceMonitoringActive()) {
        recordStartupPerformance(config, 'sandbox_setup', sandboxDuration, {
          sandbox_command: sandboxConfig.command,
        });
      }

      process.exit(0);
    } else {
      // Not in a sandbox and not entering one, so relaunch with additional
      // arguments to control memory usage if needed.
      if (memoryArgs.length > 0) {
        await relaunchWithAdditionalArgs(memoryArgs);
        process.exit(0);
      }
    }
  }
  let input = config.getQuestion();
  const startupWarnings = await getStartupWarnings();

  // Record all startup performance metrics if monitoring is active
  if (isPerformanceMonitoringActive()) {
    recordStartupPerformance(config, 'settings_loading', settingsDuration, {
      settings_sources: 2, // user + workspace
      errors_count: settings.errors.length,
    });

    recordStartupPerformance(config, 'cleanup', cleanupDuration);

    recordStartupPerformance(config, 'extensions_loading', extensionsDuration, {
      extensions_count: extensions.length,
    });

    recordStartupPerformance(config, 'config_loading', configDuration, {
      auth_type: settings.merged.selectedAuthType ?? 'none',
      telemetry_enabled: config.getTelemetryEnabled(),
    });

    recordStartupPerformance(config, 'file_service_init', fileServiceDuration);

    if (gitServiceDuration > 0) {
      recordStartupPerformance(config, 'git_service_init', gitServiceDuration);
    }

    recordStartupPerformance(config, 'theme_loading', themeDuration, {
      theme_name: settings.merged.theme ?? 'default',
    });

    const totalStartupDuration = performance.now() - startupStart;
    recordStartupPerformance(config, 'total_startup', totalStartupDuration, {
      is_tty: process.stdin.isTTY,
      has_question: (input?.length ?? 0) > 0,
    });
  }

  // Render UI, passing necessary config values. Check that there is no command line question.
  if (process.stdin.isTTY && input?.length === 0) {
    setWindowTitle(basename(workspaceRoot), settings);
    render(
      <React.StrictMode>
        <AppWrapper
          config={config}
          settings={settings}
          startupWarnings={startupWarnings}
        />
      </React.StrictMode>,
      { exitOnCtrlC: false },
    );
    return;
  }
  // If not a TTY, read from stdin
  // This is for cases where the user pipes input directly into the command
  if (!process.stdin.isTTY) {
    input += await readStdin();
  }
  if (!input) {
    console.error('No input provided via stdin.');
    process.exit(1);
  }

  logUserPrompt(config, {
    'event.name': 'user_prompt',
    'event.timestamp': new Date().toISOString(),
    prompt: input,
    prompt_length: input.length,
  });

  // Non-interactive mode handled by runNonInteractive
  const nonInteractiveConfig = await loadNonInteractiveConfig(
    config,
    extensions,
    settings,
  );

  await runNonInteractive(nonInteractiveConfig, input);
  process.exit(0);
}

function setWindowTitle(title: string, settings: LoadedSettings) {
  if (!settings.merged.hideWindowTitle) {
    process.stdout.write(`\x1b]2; Gemini - ${title} \x07`);

    process.on('exit', () => {
      process.stdout.write(`\x1b]2;\x07`);
    });
  }
}

// --- Global Unhandled Rejection Handler ---
process.on('unhandledRejection', (reason, _promise) => {
  // Log other unexpected unhandled rejections as critical errors
  console.error('=========================================');
  console.error('CRITICAL: Unhandled Promise Rejection!');
  console.error('=========================================');
  console.error('Reason:', reason);
  console.error('Stack trace may follow:');
  if (!(reason instanceof Error)) {
    console.error(reason);
  }
  // Exit for genuinely unhandled errors
  process.exit(1);
});

async function loadNonInteractiveConfig(
  config: Config,
  extensions: Extension[],
  settings: LoadedSettings,
) {
  let finalConfig = config;
  if (config.getApprovalMode() !== ApprovalMode.YOLO) {
    // Everything is not allowed, ensure that only read-only tools are configured.
    const existingExcludeTools = settings.merged.excludeTools || [];
    const interactiveTools = [
      ShellTool.Name,
      EditTool.Name,
      WriteFileTool.Name,
    ];

    const newExcludeTools = [
      ...new Set([...existingExcludeTools, ...interactiveTools]),
    ];

    const nonInteractiveSettings = {
      ...settings.merged,
      excludeTools: newExcludeTools,
    };
    finalConfig = await loadCliConfig(
      nonInteractiveSettings,
      extensions,
      config.getSessionId(),
    );
  }

  return await validateNonInterActiveAuth(
    settings.merged.selectedAuthType,
    finalConfig,
  );
}

async function validateNonInterActiveAuth(
  selectedAuthType: AuthType | undefined,
  nonInteractiveConfig: Config,
) {
  // making a special case for the cli. many headless environments might not have a settings.json set
  // so if GEMINI_API_KEY is set, we'll use that. However since the oauth things are interactive anyway, we'll
  // still expect that exists
  if (!selectedAuthType && !process.env.GEMINI_API_KEY) {
    console.error(
      'Please set an Auth method in your .gemini/settings.json OR specify GEMINI_API_KEY env variable file before running',
    );
    process.exit(1);
  }

  selectedAuthType = selectedAuthType || AuthType.USE_GEMINI;
  const err = validateAuthMethod(selectedAuthType);
  if (err != null) {
    console.error(err);
    process.exit(1);
  }

  await nonInteractiveConfig.refreshAuth(selectedAuthType);
  return nonInteractiveConfig;
}
