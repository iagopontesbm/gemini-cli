/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Part } from '@google/genai';
// import { toolRegistry } from '../tools/tool-registry.js'; // Removed
import {
  HistoryItem,
  IndividualToolCallDisplay,
  // ToolCallEvent, // Removed
  ToolCallStatus,
  // ToolConfirmationOutcome, // Removed
  // ToolEditConfirmationDetails, // Removed
  // ToolExecuteConfirmationDetails, // Removed
  ToolConfirmationPayload, // Keep this import
} from '../ui/types.js';
import type { ToolResultDisplay } from '@gemini-code/server';

// Update payload interface to match server event, including details
interface ServerToolCallRequestPayload {
  callId: string;
  name: string;
  args: Record<string, unknown>;
  requiresConfirmation?: boolean;
  details?: any; // Add details field
}

// Define the structure of the payload for tool call results
interface ServerToolCallResultPayload {
  callId: string;
  name: string; // Keep name for potential context
  status: 'success' | 'error';
  resultDisplay?: ToolResultDisplay;
  errorMessage?: string;
}

/**
 * Processes a tool call request event received from the server via SSE
 * and updates the CLI history state to display the request.
 */
// Uncomment and adapt the function
export const handleToolCallChunk = (
  // chunk: ToolCallEvent, // Change parameter type
  serverPayload: ServerToolCallRequestPayload,
  setHistory: React.Dispatch<React.SetStateAction<HistoryItem[]>>,
  // submitQuery: (query: Part) => Promise<void>, // No longer needed
  getNextMessageId: () => number,
  currentToolGroupIdRef: React.MutableRefObject<number | null>,
): void => {
  const requiresConfirmation = serverPayload.requiresConfirmation ?? false;
  const status = requiresConfirmation
    ? ToolCallStatus.Confirming
    : ToolCallStatus.Pending;
  const confirmationPayload: ToolConfirmationPayload | undefined = requiresConfirmation
    ? { // Store details if confirming
        callId: serverPayload.callId,
        name: serverPayload.name,
        args: serverPayload.args,
        details: serverPayload.details, // Store the details
      }
    : undefined;

  // Simplified description - enhance later if needed
  const description = `${serverPayload.name} requested with args: ${JSON.stringify(serverPayload.args)}`;
  const toolDisplayName = serverPayload.name;

  const toolDetail: IndividualToolCallDisplay = {
    callId: serverPayload.callId,
    name: toolDisplayName,
    description,
    // resultDisplay: serverPayload.resultDisplay, // Server doesn't send result in request event
    resultDisplay: undefined,
    status: status, // Use determined status
    confirmationPayload: confirmationPayload, // Add confirmation payload
    // confirmationDetails: undefined, // Confirmation handled server-side
  };

  const activeGroupId = currentToolGroupIdRef.current;
  setHistory((prev) => {
    // Logic for adding/updating tool group remains largely the same,
    // but only deals with adding the pending tool display.
      if (activeGroupId === null) {
        // Start a new tool group
        const newGroupId = getNextMessageId();
        currentToolGroupIdRef.current = newGroupId;
        return [
          ...prev,
          {
            id: newGroupId,
            type: 'tool_group',
            tools: [toolDetail],
          } as HistoryItem,
        ];
      }

    // Add to existing tool group if not already present
    return prev.map((item) =>
      item.id === activeGroupId && item.type === 'tool_group'
        ? item.tools.some((t) => t.callId === toolDetail.callId)
          ? item // Tool already listed
          : { ...item, tools: [...item.tools, toolDetail] }
        : item,
    );

    // Removed logic for updating status beyond Pending, as results/errors
    // are not handled by this specific event anymore.
  });
};

/**
 * Processes a tool call result event received from the server via SSE
 * and updates the status and result display of the corresponding tool call in history.
 */
export const handleToolCallResult = (
  serverPayload: ServerToolCallResultPayload,
  setHistory: React.Dispatch<React.SetStateAction<HistoryItem[]>>,
  currentToolGroupIdRef: React.MutableRefObject<number | null>,
): void => {
  const activeGroupId = currentToolGroupIdRef.current;
  if (activeGroupId === null) {
    console.warn(
      '[handleToolCallResult] Received tool result without an active tool group ID:',
      serverPayload,
    );
    return; // Cannot update if we don't know which group it belongs to
  }

  setHistory((prev) =>
    prev.map((item) => {
      if (item.id === activeGroupId && item.type === 'tool_group') {
        return {
          ...item,
          tools: item.tools.map((tool) => {
            if (tool.callId === serverPayload.callId) {
              // Update the status and resultDisplay
              return {
                ...tool,
                status:
                  serverPayload.status === 'success'
                    ? ToolCallStatus.Success
                    : ToolCallStatus.Error,
                resultDisplay:
                  serverPayload.status === 'error'
                    ? serverPayload.errorMessage || 'Unknown error' // Display error message on failure
                    : serverPayload.resultDisplay, // Display ToolResultDisplay on success
              };
            }
            return tool; // Return other tools unchanged
          }),
        };
      }
      return item; // Return other history items unchanged
    }),
  );
};

/**
 * Appends an error or informational message to the history, attempting to attach
 * it to the last non-user message or creating a new entry.
 */
export const addErrorMessageToHistory = (
  error: Error, // Changed type from DOMException | Error
  setHistory: React.Dispatch<React.SetStateAction<HistoryItem[]>>,
  getNextMessageId: () => number,
): void => {
  // Simplified error check - DOMException not typically relevant here
  const isAbort = error.name === 'AbortError';
  const errorType = isAbort ? 'info' : 'error';
  const errorText = isAbort
    ? '[Request cancelled by user]'
    : `[Error: ${error.message || 'Unknown error'}]`;

  setHistory((prev) => {
    const reversedHistory = [...prev].reverse();
    // Find the last message that isn't from the user to append the error/info to
    const lastNonToolMessageIndex = reversedHistory.findIndex(
      (item) => item.type !== 'user' && item.type !== 'tool_group',
    );
    const originalIndex =
      lastNonToolMessageIndex !== -1
        ? prev.length - 1 - lastNonToolMessageIndex
        : -1;

    if (originalIndex !== -1) {
      // Append error to the last relevant message
      return prev.map((item, index) => {
        if (index === originalIndex) {
          let baseText = '';
          // Determine base text based on item type
          // Removed tool_group case
          if (item.type === 'gemini') baseText = item.text ?? '';
          else if (item.type === 'error' || item.type === 'info')
            baseText = item.text ?? '';

          const updatedText = (
            baseText +
            (baseText && !baseText.endsWith('\n') ? '\n' : '') +
            errorText
          ).trim();
          // Reuse existing ID, update type and text
          return { ...item, type: errorType, text: updatedText };
        }
        return item;
      });
    } else {
      // No previous message to append to, add a new error item
      return [
        ...prev,
        {
          id: getNextMessageId(),
          type: errorType,
          text: errorText,
        } as HistoryItem,
      ];
    }
  });
};
