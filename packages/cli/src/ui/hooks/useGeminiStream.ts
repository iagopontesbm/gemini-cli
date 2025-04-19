/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useCallback } from 'react';
import { useInput } from 'ink';
// Remove axios imports
// import axios, { CancelTokenSource, isCancel } from 'axios';
import EventSource from 'eventsource'; // Import EventSource

import { getErrorMessage } from '@gemini-code/server';
import type { HistoryItem } from '../types.js';
import { StreamingState } from '../../core/gemini-stream.js';
// Import the history updater
import {
  addErrorMessageToHistory,
  handleToolCallChunk,
  handleToolCallResult,
} from '../../core/history-updater.js';
// Import ToolCallStatus enum for use in history updater call
import { ToolCallStatus } from '../types.js';

// Define the expected structure of events from the server
interface ServerSseEvent {
  type: 'content' | 'tool_call_request' | 'tool_call_result' | 'error' | 'done';
  payload: any;
}

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
  serverBaseUrl: string,
) => {
  const [streamingState, setStreamingState] = useState<StreamingState>(
    StreamingState.Idle,
  );
  const [initError, setInitError] = useState<string | null>(null);
  // Use EventSource ref for abortion/closing
  const eventSourceRef = useRef<EventSource | null>(null);
  const messageIdCounterRef = useRef(0);
  const currentGeminiMessageIdRef = useRef<number | null>(null);
  const currentToolGroupIdRef = useRef<number | null>(null); // Ref for grouping tool calls

  const getNextMessageId = useCallback((baseTimestamp: number): number => {
    messageIdCounterRef.current += 1;
    return baseTimestamp + messageIdCounterRef.current;
  }, []);

  // Helper function to update Gemini message content (needed for streaming)
  const updateGeminiMessage = useCallback(
    (messageId: number, newContent: string) => {
      setHistory((prevHistory) =>
        prevHistory.map((item) =>
          item.id === messageId && item.type === 'gemini'
            ? { ...item, text: newContent }
            : item,
        ),
      );
    },
    [setHistory],
  );

  // Cleanup function to close EventSource
  const cleanupEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStreamingState(StreamingState.Idle);
    currentGeminiMessageIdRef.current = null;
    currentToolGroupIdRef.current = null;
  }, []);

  // Input Handling Effect for Abort
  useInput((input, key) => {
    // Close SSE connection on escape during response
    if (streamingState === StreamingState.Responding && key.escape) {
      cleanupEventSource();
      addErrorMessageToHistory(
        new Error('Request cancelled by user'), // Use standard Error
        setHistory,
        () => getNextMessageId(Date.now()),
      );
    }
  });

  const submitQuery = useCallback(
    async (query: string) => {
      if (streamingState === StreamingState.Responding) return;
      if (query.trim().length === 0) return;

      const userMessageTimestamp = Date.now();
      // Use the passed-in serverUrl
      const eventSourceUrl = `${serverBaseUrl}/api/generate?prompt=${encodeURIComponent(query)}`;

      // Close any existing connection
      cleanupEventSource();

      setStreamingState(StreamingState.Responding);
      setInitError(null);
      messageIdCounterRef.current = 0;
      let currentGeminiText = '';
      let hasInitialGeminiResponse = false;

      addHistoryItem(
        setHistory,
        { type: 'user', text: query },
        userMessageTimestamp,
      );

      try {
        // Use the dynamic eventSourceUrl
        const es = new EventSource(eventSourceUrl);
        eventSourceRef.current = es;

        es.onmessage = (event: MessageEvent) => {
          try {
            const serverEvent: ServerSseEvent = JSON.parse(event.data);

            if (serverEvent.type === 'content') {
              currentGeminiText += serverEvent.payload;
              if (!hasInitialGeminiResponse) {
                hasInitialGeminiResponse = true;
                const eventTimestamp = getNextMessageId(userMessageTimestamp);
                currentGeminiMessageIdRef.current = eventTimestamp;
                addHistoryItem(
                  setHistory,
                  { type: 'gemini', text: currentGeminiText },
                  eventTimestamp,
                );
              } else if (currentGeminiMessageIdRef.current !== null) {
                updateGeminiMessage(
                  currentGeminiMessageIdRef.current,
                  currentGeminiText,
                );
              }
            } else if (serverEvent.type === 'tool_call_request') {
              // Reset gemini message tracking for next response
              currentGeminiText = '';
              hasInitialGeminiResponse = false;
              currentGeminiMessageIdRef.current = null;

              // Call the adapted history updater function
              handleToolCallChunk(
                serverEvent.payload, // Pass the payload directly
                setHistory,
                () => getNextMessageId(userMessageTimestamp),
                currentToolGroupIdRef,
              );
              // console.log('[CLI] Received tool call request:', serverEvent.payload); // Removed placeholder
            } else if (serverEvent.type === 'tool_call_result') {
              // Call the new history update function for results
              handleToolCallResult(
                serverEvent.payload, // Pass the result payload
                setHistory,
                currentToolGroupIdRef,
              );
            } else if (serverEvent.type === 'done') {
              cleanupEventSource();
            } else if (serverEvent.type === 'error') {
              console.error('[CLI] Received error from server:', serverEvent.payload);
              addErrorMessageToHistory(
                new Error(serverEvent.payload),
                setHistory,
                () => getNextMessageId(userMessageTimestamp),
              );
              cleanupEventSource();
            }
          } catch (parseError) {
            console.error('[CLI] Failed to parse SSE data:', event.data, parseError);
            addErrorMessageToHistory(
              new Error('Failed to parse server event.'),
              setHistory,
              () => getNextMessageId(userMessageTimestamp),
            );
            cleanupEventSource();
          }
        };

        es.onerror = (errorEvent: Event) => {
          console.error('[CLI] EventSource error:', errorEvent);
          // Log error message regardless of exact streaming state during error event
          addErrorMessageToHistory(
              // Attempt to get a more specific message if possible, fallback
              new Error(`Connection error: ${getErrorMessage(errorEvent)}`),
              setHistory,
              () => getNextMessageId(userMessageTimestamp),
          );
          cleanupEventSource();
          setInitError('Connection to server failed.'); // Set initError for display
        };

      } catch (error: unknown) {
        console.error('[CLI] Failed to establish SSE connection:', error);
        addErrorMessageToHistory(
          new Error(`Connection failed: ${getErrorMessage(error)}`),
          setHistory,
          () => getNextMessageId(userMessageTimestamp),
        );
        cleanupEventSource();
        setInitError('Failed to connect to server.');
      }
    },
    // Add serverBaseUrl to dependencies
    [streamingState, setHistory, getNextMessageId, updateGeminiMessage, cleanupEventSource, serverBaseUrl],
  );

  return { streamingState, submitQuery, initError };
};
