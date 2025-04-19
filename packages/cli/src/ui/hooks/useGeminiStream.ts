/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useCallback } from 'react';
import { useInput } from 'ink';
import axios from 'axios';
import EventSource from 'eventsource';

import { getErrorMessage } from '@gemini-code/server';
import type { HistoryItem } from '../types.js';
import { StreamingState } from '../../core/gemini-stream.js';
import { addErrorMessageToHistory, handleToolCallChunk, handleToolCallResult } from '../../core/history-updater.js';
import { ToolCallStatus, ToolConfirmationPayload } from '../types.js';

// Define the expected structure of events from the server
interface ServerSseEvent {
  type: 'content' | 'tool_call_request' | 'tool_call_result' | 'error' | 'done' | 'tool_confirmation_request';
  payload: any & { requiresConfirmation?: boolean; details?: any };
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
    if (streamingState !== StreamingState.WaitingForConfirmation) {
      setStreamingState(StreamingState.Idle);
    }
    currentGeminiMessageIdRef.current = null;
    currentToolGroupIdRef.current = null;
  }, [streamingState]);

  // Input Handling Effect for Abort
  useInput((input, key) => {
    if (
      (streamingState === StreamingState.Responding ||
       streamingState === StreamingState.WaitingForConfirmation) &&
      key.escape
    ) {
      cleanupEventSource();
      addErrorMessageToHistory(
        new Error('Request cancelled by user'),
        setHistory,
        () => getNextMessageId(Date.now()),
      );
    }
  });

  // Function to send confirmation decision to the server
  const sendToolConfirmation = useCallback(
    async (callId: string, confirmed: boolean) => {
      const confirmUrl = `${serverBaseUrl}/api/confirmTool`; // Define endpoint URL
      try {
        console.log(`[CLI] Sending confirmation for ${callId}: ${confirmed}`);
        await axios.post(confirmUrl, { callId, confirmed });
        // Assuming server handles resuming the stream via the original SSE connection
        // Optionally, reset state here or wait for server events?
        // For now, let's reset to idle after sending confirmation
        setStreamingState(StreamingState.Idle);
      } catch (error) {
        console.error('[CLI] Failed to send tool confirmation:', error);
        addErrorMessageToHistory(
          new Error(`Failed to send confirmation: ${getErrorMessage(error)}`),
          setHistory,
          () => getNextMessageId(Date.now()),
        );
        // Reset state even on error to allow user to try again?
        setStreamingState(StreamingState.Idle);
      }
    },
    [serverBaseUrl, setHistory, getNextMessageId], // Add dependencies
  );

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
              handleToolCallChunk(
                serverEvent.payload,
                setHistory,
                () => getNextMessageId(userMessageTimestamp),
                currentToolGroupIdRef,
              );
            } else if (serverEvent.type === 'tool_confirmation_request') {
              handleToolCallChunk(
                serverEvent.payload,
                setHistory,
                () => getNextMessageId(userMessageTimestamp),
                currentToolGroupIdRef,
              );
              setStreamingState(StreamingState.WaitingForConfirmation);
            } else if (serverEvent.type === 'tool_call_result') {
              handleToolCallResult(
                serverEvent.payload,
                setHistory,
                currentToolGroupIdRef,
              );
            } else if (serverEvent.type === 'done') {
              if (streamingState !== StreamingState.WaitingForConfirmation) {
                cleanupEventSource();
              }
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
            addErrorMessageToHistory(
              new Error('Failed to parse server event.'),
              setHistory,
              () => getNextMessageId(userMessageTimestamp),
            );
            cleanupEventSource();
          }
        };

        es.onerror = (errorEvent: Event) => {
          addErrorMessageToHistory(
              new Error(`Connection error: ${getErrorMessage(errorEvent)}`),
              setHistory,
              () => getNextMessageId(userMessageTimestamp),
          );
          cleanupEventSource();
          setInitError('Connection to server failed.');
        };

      } catch (error: unknown) {
        addErrorMessageToHistory(
          new Error(`Connection failed: ${getErrorMessage(error)}`),
          setHistory,
          () => getNextMessageId(userMessageTimestamp),
        );
        cleanupEventSource();
        setInitError('Failed to connect to server.');
      }
    },
    [streamingState, setHistory, getNextMessageId, updateGeminiMessage, cleanupEventSource, serverBaseUrl],
  );

  return { streamingState, submitQuery, initError, sendToolConfirmation };
};
