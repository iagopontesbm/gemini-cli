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
import { UseHistoryManagerReturn } from './useHistoryManager.js'; // Import the type

// Remove local addHistoryItem helper

interface HandleAtCommandParams {
  query: string;
  config: Config;
  // Use functions from useHistoryManager
  addItemToHistory: UseHistoryManagerReturn['addItemToHistory'];
  updateHistoryItem: UseHistoryManagerReturn['updateHistoryItem']; // Add update function
  setDebugMessage: React.Dispatch<React.SetStateAction<string>>;
  getNextMessageId: (baseTimestamp: number) => number; // Keep if needed for specific ID logic
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
    // Find the first '@' that is not preceded by a '\'
    if (query[i] === '@' && (i === 0 || query[i - 1] !== '\\')) {
      atIndex = i;
      break;
    }
  }

  if (atIndex === -1) {
    return null; // No '@' command found
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
  // Destructure history manager functions
  addItemToHistory,
  // updateHistoryItem, // Not currently used here, but available
  setDebugMessage,
  getNextMessageId,
  userMessageTimestamp,
}: HandleAtCommandParams): Promise<HandleAtCommandResult> {
  const trimmedQuery = query.trim();
  const parsedCommand = parseAtCommand(trimmedQuery);

  if (!parsedCommand) {
    // No @ command found, add user query and proceed
    addItemToHistory({ type: 'user', text: query }, userMessageTimestamp);
    return { processedQuery: [{ text: query }], shouldProceed: true };
  }

  const { textBefore, atPath, textAfter } = parsedCommand;

  // Add the original user query to history *before* processing
  addItemToHistory({ type: 'user', text: query }, userMessageTimestamp);

  const pathPart = atPath.substring(1); // Remove the leading '@'

  if (!pathPart) {
    const errorTimestamp = getNextMessageId(userMessageTimestamp);
    addItemToHistory(
      { type: 'error', text: 'Error: No path specified after @.' },
      errorTimestamp,
    );
    return { processedQuery: null, shouldProceed: false };
  }

  const toolRegistry = config.getToolRegistry();
  const readManyFilesTool = toolRegistry.getTool('read_many_files');

  if (!readManyFilesTool) {
    const errorTimestamp = getNextMessageId(userMessageTimestamp);
    addItemToHistory(
      { type: 'error', text: 'Error: read_many_files tool not found.' },
      errorTimestamp,
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
  const toolGroupId = getNextMessageId(userMessageTimestamp);

  // Add the tool group placeholder immediately
  addItemToHistory(
    { type: 'tool_group', tools: [] } as Omit<HistoryItem, 'id'>,
    toolGroupId,
  );

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

    // Update the tool group with the successful result
    // Assuming updateHistoryItem can handle this update correctly
    // (May need refinement in useHistoryManager if it only replaces)
    // updateHistoryItem(toolGroupId, { tools: [toolCallDisplay] });
    // Safer: Use functional update form if available in useHistoryManager
    // updateHistoryItem(toolGroupId, (prevItem) => ({ ...prevItem, tools: [toolCallDisplay] }));
    // Simplest if updateHistoryItem replaces: Just set the tools array
    // This requires updateHistoryItem to be passed in HandleAtCommandParams
    // Let's assume updateHistoryItem is available and works by replacement for now:
    // *** Correction: updateHistoryItem *was* added to params, let's use it ***
    // updateHistoryItem(toolGroupId, { tools: [toolCallDisplay] });
    // *** Reconsidering: It's better to add the item directly with the tool ***
    // Remove the placeholder addHistoryItem above and add it here with the tool.
    // *** Revised Plan: Remove placeholder, add group with tool here. ***

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

    // *** Add the tool group with the successful tool result ***
    addItemToHistory(
      { type: 'tool_group', tools: [toolCallDisplay] } as Omit<
        HistoryItem,
        'id'
      >,
      toolGroupId, // Use the pre-calculated ID
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

    // *** Add the tool group with the error tool result ***
    addItemToHistory(
      { type: 'tool_group', tools: [toolCallDisplay] } as Omit<
        HistoryItem,
        'id'
      >,
      toolGroupId, // Use the pre-calculated ID
    );

    return { processedQuery: null, shouldProceed: false };
  }
}
