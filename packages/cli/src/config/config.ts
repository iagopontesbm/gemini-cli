/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import process from 'node:process';
import {
  Config,
  loadEnvironment,
  createServerConfig,
  loadServerHierarchicalMemory,
  ConfigParameters,
} from '@gemini-code/server';
import { Settings } from './settings.js';
import { readPackageUp } from 'read-package-up';

// Simple console logger for now - replace with actual logger if available
const logger = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug: (...args: any[]) => console.debug('[DEBUG]', ...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (...args: any[]) => console.error('[ERROR]', ...args),
};

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-pro-preview-05-06';
const API_KEY_VALIDATION_ENDPOINT_BASE =
  'https://generativelanguage.googleapis.com/v1beta/models/';

interface CliArgs {
  model: string | undefined;
  sandbox: boolean | string | undefined;
  debug: boolean | undefined;
  prompt: string | undefined;
  all_files: boolean | undefined;
}

async function parseArguments(): Promise<CliArgs> {
  const argv = await yargs(hideBin(process.argv))
    .option('model', {
      alias: 'm',
      type: 'string',
      description: `Model`,
      default: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    })
    .option('prompt', {
      alias: 'p',
      type: 'string',
      description: 'Prompt. Appended to input on stdin (if any).',
    })
    .option('sandbox', {
      alias: 's',
      type: 'boolean',
      description: 'Run in sandbox?',
    })
    .option('debug', {
      alias: 'd',
      type: 'boolean',
      description: 'Run in debug mode?',
      default: false,
    })
    .option('all_files', {
      alias: 'a',
      type: 'boolean',
      description: 'Include ALL files in context?',
      default: false,
    })
    .help()
    .alias('h', 'help')
    .strict().argv;

  const finalArgv: CliArgs = {
    ...argv,
    sandbox: argv.sandbox,
  };

  return finalArgv;
}

// This function is now a thin wrapper around the server's implementation.
// It's kept in the CLI for now as App.tsx directly calls it for memory refresh.
// TODO: Consider if App.tsx should get memory via a server call or if Config should refresh itself.
export async function loadHierarchicalGeminiMemory(
  currentWorkingDirectory: string,
  debugMode: boolean,
): Promise<{ memoryContent: string; fileCount: number }> {
  if (debugMode) {
    logger.debug(
      `CLI: Delegating hierarchical memory load to server for CWD: ${currentWorkingDirectory}`,
    );
  }
  // Directly call the server function.
  // The server function will use its own homedir() for the global path.
  return loadServerHierarchicalMemory(currentWorkingDirectory, debugMode);
}

async function checkApiKeyValidity(
  apiKey: string,
  model: string,
): Promise<void> {
  if (!apiKey) {
    // No key, no check. The main config load will error out.
    return;
  }
  const validationUrl = `${API_KEY_VALIDATION_ENDPOINT_BASE}${model}:generateContent?key=${apiKey}`;
  try {
    // We don't want to wait too long, 2 seconds should be enough for a quick check.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(validationUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'test' }] }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.status === 429) {
      logger.warn(
        `Warning: The API key is currently rate-limited (HTTP 429) for the model ${model}. You may experience issues making requests.`,
      );
    } else {
      // For any other status (including 200 or other errors that aren't 429),
      // we assume the key is usable for now to avoid blocking startup.
      // More detailed errors will be caught during actual API calls.
      logger.debug(
        `API key pre-check for model ${model} returned status ${response.status}. Assuming usable for startup. Full validation occurs on first actual API call.`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof Error && error.name === 'AbortError') {
      logger.debug(
        `API key validation request for model ${model} timed out. Assuming usable for startup. Full validation occurs on first actual API call.`,
      );
    } else {
      logger.warn(
        `Warning: An error occurred while trying to validate the API key with ${validationUrl}: ${message}. Full validation occurs on first actual API call.`,
      );
    }
  }
}

export async function loadCliConfig(settings: Settings): Promise<Config> {
  loadEnvironment();

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const googleApiKey = process.env.GOOGLE_API_KEY;
  const googleCloudProject = process.env.GOOGLE_CLOUD_PROJECT;
  const googleCloudLocation = process.env.GOOGLE_CLOUD_LOCATION;

  const hasGeminiApiKey = !!geminiApiKey;
  const hasGoogleApiKey = !!googleApiKey;
  const hasVertexProjectLocationConfig =
    !!googleCloudProject && !!googleCloudLocation;

  if (!hasGeminiApiKey && !hasGoogleApiKey && !hasVertexProjectLocationConfig) {
    logger.error(
      'No valid API authentication configuration found. Please set ONE of the following combinations in your environment variables or .env file:\n' +
        '1. GEMINI_API_KEY (for Gemini API access).\n' +
        '2. GOOGLE_API_KEY (for Gemini API or Vertex AI Express Mode access).\n' +
        '3. GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION (for Vertex AI access).\n\n' +
        'For Gemini API keys, visit: https://ai.google.dev/gemini-api/docs/api-key\n' +
        'For Vertex AI authentication, visit: https://cloud.google.com/vertex-ai/docs/start/authentication\n' +
        'The GOOGLE_GENAI_USE_VERTEXAI environment variable can also be set to true/false to influence service selection when ambiguity exists.',
    );
    process.exit(1);
  }

  const apiKeyForServer = geminiApiKey || googleApiKey || '';
  const modelForValidation = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  // Perform the API key check early.
  // We don't want to block config loading entirely if it fails, just warn.
  await checkApiKeyValidity(apiKeyForServer, modelForValidation);

  const argv = await parseArguments();

  const debugMode = argv.debug || false;

  // Call the (now wrapper) loadHierarchicalGeminiMemory which calls the server's version
  const { memoryContent, fileCount } = await loadHierarchicalGeminiMemory(
    process.cwd(),
    debugMode,
  );

  const userAgent = await createUserAgent();
  const useVertexAI = hasGeminiApiKey ? false : undefined;

  const configParams: ConfigParameters = {
    apiKey: apiKeyForServer,
    model: argv.model || DEFAULT_GEMINI_MODEL,
    sandbox: argv.sandbox ?? settings.sandbox ?? false,
    targetDir: process.cwd(),
    debugMode,
    question: argv.prompt || '',
    fullContext: argv.all_files || false,
    coreTools: settings.coreTools || undefined,
    toolDiscoveryCommand: settings.toolDiscoveryCommand,
    toolCallCommand: settings.toolCallCommand,
    mcpServerCommand: settings.mcpServerCommand,
    mcpServers: settings.mcpServers,
    userAgent,
    userMemory: memoryContent,
    geminiMdFileCount: fileCount,
    vertexai: useVertexAI,
  };

  return createServerConfig(configParams);
}

async function createUserAgent(): Promise<string> {
  try {
    const packageJsonInfo = await readPackageUp({ cwd: import.meta.url });
    const cliVersion = packageJsonInfo?.packageJson.version || 'unknown';
    return `GeminiCLI/${cliVersion} Node.js/${process.version} (${process.platform}; ${process.arch})`;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(
      `Could not determine package version for User-Agent: ${message}`,
    );
    return `GeminiCLI/unknown Node.js/${process.version} (${process.platform}; ${process.arch})`;
  }
}
