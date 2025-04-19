/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import process from 'node:process';
// Only import loadEnvironment from server config
import { loadEnvironment } from '@gemini-code/server';

const DEFAULT_GEMINI_MODEL = 'gemini-pro'; // Update default model maybe?
const DEFAULT_SERVER_URL = 'http://localhost:3000';

// Define a specific configuration class for the CLI
export class CliConfig {
  private apiKey: string;
  private model: string;
  private targetDir: string;
  private serverUrl: string;

  constructor(
    apiKey: string,
    model: string,
    targetDir: string,
    serverUrl: string,
  ) {
    this.apiKey = apiKey;
    this.model = model;
    this.targetDir = targetDir;
    this.serverUrl = serverUrl;
  }

  getApiKey(): string {
    return this.apiKey;
  }

  getModel(): string {
    return this.model;
  }

  getTargetDir(): string {
    return this.targetDir;
  }

  getServerUrl(): string {
    return this.serverUrl;
  }
}

interface CliArgs {
  target_dir: string | undefined;
  model: string | undefined;
}

function parseArguments(): CliArgs {
  const argv = yargs(hideBin(process.argv))
    .option('target_dir', {
      alias: 'd',
      type: 'string',
      description:
        'The target directory for Gemini operations. Defaults to the current working directory.',
    })
    .option('model', {
      alias: 'm',
      type: 'string',
      description: `The Gemini model to use. Defaults to ${DEFAULT_GEMINI_MODEL}.`,
      default: DEFAULT_GEMINI_MODEL,
    })
    .help()
    .alias('h', 'help')
    .strict().argv;
  return argv as unknown as CliArgs;
}

export function loadCliConfig(): CliConfig { // Return type is now CliConfig
  loadEnvironment();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log(
      'GEMINI_API_KEY is not set. See https://ai.google.dev/gemini-api/docs/api-key to obtain one. ' +
        'Please set it in your .env file or as an environment variable.',
    );
    process.exit(1);
  }

  const argv = parseArguments();

  // Get server URL from environment or use default
  const serverUrl = process.env.GEMINI_CODE_SERVER_URL || DEFAULT_SERVER_URL;

  // Instantiate the new CliConfig class
  return new CliConfig(
    apiKey,
    argv.model || DEFAULT_GEMINI_MODEL,
    argv.target_dir || process.cwd(),
    serverUrl,
  );
}

// Removed globalConfig export
