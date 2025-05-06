/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { PartListUnion } from '@google/genai';
import {
  Config,
  getErrorMessage,
  isNodeError,
  unescapePath,
} from '@gemini-code/server';
import {
  HistoryItem,
  IndividualToolCallDisplay,
  ToolCallStatus,
} from '../types.js';
import { UseHistoryManagerReturn } from './useHistoryManager.js';

interface HandleAtCommandParams {
  query: string;
  config: Config;
  addItemToHistory: UseHistoryManagerReturn['addItemToHistory'];
  updateHistoryItem: UseHistoryManagerReturn['updateHistoryItem'];
  setDebugMessage: React.Dispatch<React.SetStateAction<string>>;
  // Removed getNextMessageId
  userMessageTimestamp: number;
}

interface HandleAtCommandResult {
  processedQuery: PartListUnion | null;
  shouldProceed: boolean;
}

/**
 * Parses a query string to find the first '@<path>' command,
 * handling \ escaped spaces within the path.
 */
function parseAtCommand(
  query: string,
): { textBefore: string; atPath: string; textAfter: string } | null {
  let atIndex = -1;
  for (let i = 0; i < query.length; i++) {
    if (query[i] === '@' && (i === 0 || query[i - 1] !== '\\')) {
      atIndex = i;
      break;
    }
  }

  if (atIndex === -1) {
    return null;
  }

  const textBefore = query.substring(0, atIndex).trim();
  let pathEndIndex = atIndex + 1;
  let inEscape = false;

  while (pathEndIndex < query.length) {
    const char = query[pathEndIndex];
    if (inEscape) {
      inEscape = false;
    } else if (char === '\\') {
      inEscape = true;
    } else if (/\s/.test(char)) {
      break;
    }
    pathEndIndex++;
  }

  const rawAtPath = query.substring(atIndex, pathEndIndex);
  const textAfter = query.substring(pathEndIndex).trim();
  const atPath = unescapePath(rawAtPath);

  return { textBefore, atPath, textAfter };
}

/**
 * Processes user input potentially containing an '@<path>' command.
 */
export async function handleAtCommand({
  query,
  config,
  addItemToHistory,
  // updateHistoryItem, // Not currently used here
  setDebugMessage,
  userMessageTimestamp,
}: HandleAtCommandParams): Promise<HandleAtCommandResult> {
  const trimmedQuery = query.trim();
  const parsedCommand = parseAtCommand(trimmedQuery);

  if (!parsedCommand) {
    addItemToHistory({ type: 'user', text: query }, userMessageTimestamp);
    return { processedQuery: [{ text: query }], shouldProceed: true };
  }

  const { textBefore, atPath, textAfter } = parsedCommand;

  addItemToHistory({ type: 'user', text: query }, userMessageTimestamp);

  const pathPart = atPath.substring(1);

  if (!pathPart) {
    // Use addItemToHistory for error
    addItemToHistory(
      { type: 'error', text: 'Error: No path specified after @.' },
      userMessageTimestamp, // Use same base timestamp
    );
    return { processedQuery: null, shouldProceed: false };
  }

  const toolRegistry = config.getToolRegistry();
  const readManyFilesTool = toolRegistry.getTool('read_many_files');

  if (!readManyFilesTool) {
    // Use addItemToHistory for error
    addItemToHistory(
      { type: 'error', text: 'Error: read_many_files tool not found.' },
      userMessageTimestamp, // Use same base timestamp
    );
    return { processedQuery: null, shouldProceed: false };
  }

  // --- Path Handling ---
  let pathSpec = pathPart;
  const contentLabel = pathPart;

  try {
    const absolutePath = path.resolve(config.getTargetDir(), pathPart);
    const stats = await fs.stat(absolutePath);
    if (stats.isDirectory()) {
      pathSpec = pathPart.endsWith('/') ? `${pathPart}**` : `${pathPart}/**`;
      setDebugMessage(`Path resolved to directory, using glob: ${pathSpec}`);
    } else {
      setDebugMessage(`Path resolved to file: ${pathSpec}`);
    }
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      setDebugMessage(`Path not found, proceeding with original: ${pathSpec}`);
    } else {
      console.error(`Error stating path ${pathPart}:`, error);
      setDebugMessage(
        `Error stating path, proceeding with original: ${pathSpec}`,
      );
    }
  }

  const toolArgs = { paths: [pathSpec] };
  // --- End Path Handling ---

  let toolCallDisplay: IndividualToolCallDisplay;

  try {
    const result = await readManyFilesTool.execute(toolArgs);
    const fileContent = result.llmContent || '';

    toolCallDisplay = {
      callId: `client-read-${userMessageTimestamp}`,
      name: readManyFilesTool.displayName,
      description: readManyFilesTool.getDescription(toolArgs),
      status: ToolCallStatus.Success,
      resultDisplay: result.returnDisplay,
      confirmationDetails: undefined,
    };

    const processedQueryParts = [];
    if (textBefore) {
      processedQueryParts.push({ text: textBefore });
    }
    processedQueryParts.push({
      text: `\n--- Content from: ${contentLabel} ---\n${fileContent}\n--- End Content ---`,
    });
    if (textAfter) {
      processedQueryParts.push({ text: textAfter });
    }

    const processedQuery: PartListUnion = processedQueryParts;

    // Add the tool group with the successful tool result using addItemToHistory
    addItemToHistory(
      { type: 'tool_group', tools: [toolCallDisplay] } as Omit<
        HistoryItem,
        'id'
      >,
      userMessageTimestamp, // Use same base timestamp
    );

    return { processedQuery, shouldProceed: true };
  } catch (error) {
    toolCallDisplay = {
      callId: `client-read-${userMessageTimestamp}`,
      name: readManyFilesTool.displayName,
      description: readManyFilesTool.getDescription(toolArgs),
      status: ToolCallStatus.Error,
      resultDisplay: `Error reading ${contentLabel}: ${getErrorMessage(error)}`,
      confirmationDetails: undefined,
    };

    // Add the tool group with the error tool result using addItemToHistory
    addItemToHistory(
      { type: 'tool_group', tools: [toolCallDisplay] } as Omit<
        HistoryItem,
        'id'
      >,
      userMessageTimestamp, // Use same base timestamp
    );

    return { processedQuery: null, shouldProceed: false };
  }
}
