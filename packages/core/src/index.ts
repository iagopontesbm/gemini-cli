/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Export config
export {
  AccessibilitySettings,
  ApprovalMode,
  Config,
  ConfigParameters,
  createToolRegistry,
  loadEnvironment,
  MCPServerConfig,
  createServerConfig,
} from './config/config.js';

// Export Core Logic
export { GeminiClient } from './core/client.js';
export { ChatSession, ChatEvent } from './core/chatSession.js';
export { GeminiChat } from './core/geminiChat.js';
export { GeminiCodeRequest, partListUnionToString } from './core/geminiRequest.js';
export {
  AllToolCallsCompleteHandler,
  CancelledToolCall,
  CompletedToolCall,
  ConfirmHandler,
  convertToFunctionResponse,
  CoreToolScheduler,
  ErroredToolCall,
  ExecutingToolCall,
  OutputUpdateHandler,
  ScheduledToolCall,
  Status,
  SuccessfulToolCall,
  ToolCall,
  ToolCallsUpdateHandler,
  ValidatingToolCall,
  WaitingToolCall,
} from './core/coreToolScheduler.js';
export { executeToolCall } from './core/nonInteractiveToolExecutor.js';
export { Logger, LogEntry, MessageSenderType } from './core/logger.js';
export { getCoreSystemPrompt } from './core/prompts.js';
export {
  ServerGeminiChatCompressedEvent,
  ServerGeminiContentEvent,
  ServerGeminiErrorEvent,
  ServerGeminiStreamEvent,
  ServerGeminiToolCallConfirmationEvent,
  ServerGeminiToolCallRequestEvent,
  ServerGeminiToolCallResponseEvent,
  ServerGeminiUserCancelledEvent,
  ServerTool,
  ServerToolCallConfirmationDetails,
  ToolCallRequestInfo,
  ToolCallResponseInfo,
  Turn,
  GeminiErrorEventValue,
  GeminiEventType,
} from './core/turn.js';

// Export services
export {
  FileDiscoveryOptions,
  FileDiscoveryService,
} from './services/fileDiscoveryService.js';

// Export base tool definitions
export {
  Tool,
  BaseTool,
  ToolResult,
  ToolResultDisplay,
  FileDiff,
  ToolEditConfirmationDetails,
  ToolExecuteConfirmationDetails,
  ToolMcpConfirmationDetails,
  ToolCallConfirmationDetails,
  ToolConfirmationOutcome,
} from './tools/tools.js';
export { DiscoveredTool, ToolRegistry } from './tools/tool-registry.js';

// Export specific tool logic
export { EditTool, EditToolParams } from './tools/edit.js';
export { GlobTool, GlobToolParams } from './tools/glob.js';
export { GrepTool, GrepToolParams } from './tools/grep.js';
export { LSTool, LSToolParams, FileEntry } from './tools/ls.js';
export {
  ReadManyFilesTool,
  ReadManyFilesParams,
} from './tools/read-many-files.js';
export { ReadFileTool, ReadFileToolParams } from './tools/read-file.js';
export {
  DEFAULT_CONTEXT_FILENAME,
  GEMINI_CONFIG_DIR,
  getCurrentGeminiMdFilename,
  MEMORY_SECTION_HEADER,
  MemoryTool,
  setGeminiMdFilename,
} from './tools/memoryTool.js';
export { ShellTool, ShellToolParams } from './tools/shell.js';
export { WebFetchTool, WebFetchToolParams } from './tools/web-fetch.js';
export {
  WebSearchTool,
  WebSearchToolParams,
  WebSearchToolResult,
} from './tools/web-search.js';
export { WriteFileTool, WriteFileToolParams } from './tools/write-file.js';

// Export telemetry functions
export {
  ApiErrorEvent,
  ApiRequestEvent,
  ApiResponseEvent,
  CliConfigEvent,
  initializeTelemetry,
  isTelemetrySdkInitialized,
  logApiError,
  logApiRequest,
  logApiResponse,
  logCliConfiguration,
  logToolCall,
  logUserPrompt,
  SemanticAttributes,
  sessionId,
  shutdownTelemetry,
  SpanStatusCode,
  TelemetryEvent,
  ToolCallEvent,
  UserPromptEvent,
  ValueType,
} from './telemetry/index.js';

// Export utilities
export { getErrorMessage, isNodeError } from './utils/errors.js';
export { getFolderStructure } from './utils/getFolderStructure.js';
export { GitIgnoreParser, GitIgnoreFilter } from './utils/gitIgnoreParser.js';
export { loadServerHierarchicalMemory } from './utils/memoryDiscovery.js';
export {
  escapePath,
  makeRelative,
  shortenPath,
  tildeifyPath,
  unescapePath,
} from './utils/paths.js';
export { SchemaValidator } from './utils/schemaValidator.js';