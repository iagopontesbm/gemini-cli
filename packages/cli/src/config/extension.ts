/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */


import { MCPServerConfig } from '@gemini-cli/core';
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

export const EXTENSIONS_CONFIG_FILENAME = 'gemini-extension.json';

export const EXTENSIONS_DIRECTORY_NAME = '.gemini/extensions';
export const EXTENSIONS_DIR = path.join(homedir(), EXTENSIONS_DIRECTORY_NAME);

export interface ExtensionConfig {
  name: string;
  version: string;
  mcpServers?: Record<string, MCPServerConfig>;
  contextFileName?: string;
}

export function loadExtensions(): ExtensionConfig[] {
  if (!fs.existsSync(EXTENSIONS_DIR)) {
    return [];
  }

  const extensions: ExtensionConfig[] = [];

  for (const subdir of fs.readdirSync(EXTENSIONS_DIR)) {
    const extensionDir = path.join(EXTENSIONS_DIR, subdir);
    if (!fs.statSync(extensionDir).isDirectory()) {
      console.error(`Warning: unexpected file ${extensionDir} in extensions directory.`);
      continue;
    }

    const extensionPath = path.join(extensionDir, EXTENSIONS_CONFIG_FILENAME);
    if (!fs.existsSync(extensionPath)) {
      console.error(`Warning: extension directory ${extensionDir} does not contain a config file ${extensionPath}.`);
      continue;
    }
    try {
      const fileContent = fs.readFileSync(extensionPath, 'utf-8');
      const extensionConfig = JSON.parse(fileContent) as ExtensionConfig;
      extensions.push(extensionConfig);
    } catch (e) {
      console.error(`Failed to load extension config from ${extensionPath}:`, e);
    }
  }

  return extensions;
}
