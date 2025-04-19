/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useCallback } from 'react';
import { useInput } from 'ink';
import axios, { CancelTokenSource, isCancel } from 'axios';

// Import server-side error utilities only
import { getErrorMessage } from '@gemini-code/server';

// Import CLI types
import type { HistoryItem } from '../types.js'; // Keep HistoryItem
import { StreamingState } from '../../core/gemini-stream.js';

// Removed imports: GeminiClient, ServerGeminiEventType, ToolResult, ServerTool
// Removed imports: Chat, PartListUnion, FunctionDeclaration
// Removed imports: Tool, toolRegistry
// Removed imports: IndividualToolCallDisplay, ToolCallStatus

const addHistoryItem = (
  setHistory: React.Dispatch<React.SetStateAction<HistoryItem[]>>,
  itemData: Omit<HistoryItem, 'id'>,
  id: number,
) => {
  setHistory((prevHistory) => [
    ...prevHistory,
    { ...itemData, id } as HistoryItem,
  ]);
};

export const useGeminiStream = (
  setHistory: React.Dispatch<React.SetStateAction<HistoryItem[]>>,
  // Removed apiKey and model from hook params as they are handled server-side
) => {
  const [streamingState, setStreamingState] = useState<StreamingState>(
    StreamingState.Idle,
  );
  const [initError, setInitError] = useState<string | null>(null); // Keep for general errors
  const abortControllerRef = useRef<CancelTokenSource | null>(null); // Use axios cancel token
  const messageIdCounterRef = useRef(0);

  // Removed GeminiClient/Chat initialization effects and refs

  // Input Handling Effect for Abort
  useInput((input, key) => {
    if (streamingState === StreamingState.Responding && key.escape) {
      abortControllerRef.current?.cancel('User aborted request.');
    }
  });

  const getNextMessageId = useCallback((baseTimestamp: number): number => {
    messageIdCounterRef.current += 1;
    return baseTimestamp + messageIdCounterRef.current;
  }, []);

  const submitQuery = useCallback(
    async (query: string) => {
      // Simplified to only accept string query
      if (streamingState === StreamingState.Responding) return;
      if (query.trim().length === 0) return;

      const userMessageTimestamp = Date.now();
      const serverUrl = 'http://localhost:3000/api/generate'; // Hardcoded for now

      setStreamingState(StreamingState.Responding);
      setInitError(null);
      messageIdCounterRef.current = 0; // Reset counter for new submission

      // Add user message to history
      addHistoryItem(
        setHistory,
        { type: 'user', text: query },
        userMessageTimestamp,
      );

      try {
        // Use default axios import for CancelToken.source()
        // eslint-disable-next-line import/no-named-as-default-member
        abortControllerRef.current = axios.CancelToken.source();
        // Check if controller was created before accessing token
        if (!abortControllerRef.current) {
          throw new Error('Failed to create cancellation token source.');
        }
        const cancelToken = abortControllerRef.current.token;

        const response = await axios.post<{ response: string }>( // Expected response type
          serverUrl,
          { prompt: query }, // Request body
          { cancelToken }, // Pass cancel token
        );

        const geminiResponseText = response.data.response;

        if (geminiResponseText) {
          const geminiMessageId = getNextMessageId(userMessageTimestamp);
          addHistoryItem(
            setHistory,
            { type: 'gemini', text: geminiResponseText },
            geminiMessageId,
          );
        } else {
          // Handle cases where the server might return an empty response
          addHistoryItem(
            setHistory,
            {
              type: 'error',
              text: '[Server returned an empty response]',
            },
            getNextMessageId(userMessageTimestamp),
          );
        }
      } catch (error: unknown) {
        if (isCancel(error)) {
          addHistoryItem(
            setHistory,
            { type: 'error', text: '[Request cancelled by user]' },
            getNextMessageId(userMessageTimestamp),
          );
          console.log('Request cancelled:', error.message);
        } else {
          const errorMessage = getErrorMessage(error);
          console.error('Error sending request to server:', error);
          addHistoryItem(
            setHistory,
            {
              type: 'error',
              text: `[Error communicating with server: ${errorMessage}]`,
            },
            getNextMessageId(userMessageTimestamp),
          );
          // Optionally set initError for persistent display
          setInitError(`Failed to communicate with server: ${errorMessage}`);
        }
      } finally {
        abortControllerRef.current = null;
        setStreamingState(StreamingState.Idle);
      }
    },
    [streamingState, setHistory, getNextMessageId],
  );

  // The hook now only returns state, the submit function, and potential initError
  return { streamingState, submitQuery, initError };
};
