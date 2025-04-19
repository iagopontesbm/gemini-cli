/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// --- Config ---
export type { Config } from './config/config.js';
export { loadEnvironment, createServerConfig } from './config/config.js';

// --- Core Logic ---
export { GeminiClient } from './core/gemini-client.js';
export { GeminiEventType } from './core/turn.js'; // Specific export
// Export the ServerTool interface used by GeminiClient
export type { ServerTool } from './core/turn.js';

// --- Utilities ---
// Primarily error handling needed by CLI
export { getErrorMessage, isNodeError } from './utils/errors.js';
// Export specific path utilities needed by CLI tools
export { makeRelative, shortenPath } from './utils/paths.js';
// Export SchemaValidator as it is needed by TerminalTool
export { SchemaValidator } from './utils/schemaValidator.js';

// --- Base Tool Types ---
// Export only the necessary base types used across tools
export type { ToolResult, ToolResultDisplay, FileDiff } from './tools/tools.js';

// --- Specific Tool Logic & Parameter Types ---
export { ReadFileLogic } from './tools/read-file.js';
export type { ReadFileToolParams } from './tools/read-file.js';

export { LSLogic } from './tools/ls.js';
export type { LSToolParams } from './tools/ls.js';

export { GrepLogic } from './tools/grep.js';
export type { GrepToolParams } from './tools/grep.js';

export { GlobLogic } from './tools/glob.js';
export type { GlobToolParams } from './tools/glob.js';

export { EditLogic } from './tools/edit.js';
export type { EditToolParams } from './tools/edit.js';

export { TerminalLogic } from './tools/terminal.js';
export type { TerminalToolParams } from './tools/terminal.js';

export { WriteFileLogic } from './tools/write-file.js';
export type { WriteFileToolParams } from './tools/write-file.js';

export { WebFetchLogic } from './tools/web-fetch.js';
export type { WebFetchToolParams } from './tools/web-fetch.js';

// Note: Removed exports for prompts.js, paths.js, getFolderStructure.js
// and changed wildcard exports to named exports.
