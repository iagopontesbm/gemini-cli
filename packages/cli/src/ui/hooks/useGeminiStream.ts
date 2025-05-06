/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useInput } from 'ink';
import {
  GeminiClient,
  GeminiEventType as ServerGeminiEventType, // Rename to avoid conflict
  getErrorMessage,
  isNodeError,
  Config,
  ToolCallConfirmationDetails,
  ToolCallResponseInfo,
  ServerToolCallConfirmationDetails,
  ToolConfirmationOutcome,
  ToolResultDisplay,
  ToolEditConfirmationDetails,
  ToolExecuteConfirmationDetails,
} from '@gemini-code/server';
import { type Chat, type PartListUnion, type Part } from '@google/genai';
import {
  StreamingState,
  HistoryItem,
  IndividualToolCallDisplay,
  ToolCallStatus,
} from '../types.js';
import { isAtCommand } from '../utils/commandUtils.js';
import { useSlashCommandProcessor } from './slashCommandProcessor.js';
import { useShellCommandProcessor } from './shellCommandProcessor.js';
import { handleAtCommand } from './atCommandProcessor.js';
import { findSafeSplitPoint } from '../utils/markdownUtilities.js';
import { UseHistoryManagerReturn } from './useHistoryManager.js';

// Hook now accepts history management functions
export const useGeminiStream = (
  addItemToHistory: UseHistoryManagerReturn['addItemToHistory'],
  updateHistoryItem: UseHistoryManagerReturn['updateHistoryItem'],
  clearHistory: UseHistoryManagerReturn['clearHistory'],
  refreshStatic: () => void,
  setShowHelp: React.Dispatch<React.SetStateAction<boolean>>,
  config: Config,
  openThemeDialog: () => void,
) => {
  const toolRegistry = config.getToolRegistry();
  const [streamingState, setStreamingState] = useState<StreamingState>(
    StreamingState.Idle,
  );
  const [debugMessage, setDebugMessage] = useState<string>('');
  const [initError, setInitError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const chatSessionRef = useRef<Chat | null>(null);
  const geminiClientRef = useRef<GeminiClient | null>(null);
  const messageIdCounterRef = useRef(0);
  const currentGeminiMessageIdRef = useRef<number | null>(null);

  const getNextMessageId = useCallback((baseTimestamp: number): number => {
    messageIdCounterRef.current += 1;
    return baseTimestamp + messageIdCounterRef.current;
  }, []);

  const { handleSlashCommand, slashCommands } = useSlashCommandProcessor(
    addItemToHistory,
    updateHistoryItem,
    clearHistory,
    refreshStatic,
    setShowHelp,
    setDebugMessage,
    getNextMessageId,
    openThemeDialog,
  );

  const { handleShellCommand } = useShellCommandProcessor(
    addItemToHistory,
    updateHistoryItem,
    setStreamingState,
    setDebugMessage,
    getNextMessageId,
    config,
  );

  useEffect(() => {
    setInitError(null);
    if (!geminiClientRef.current) {
      try {
        geminiClientRef.current = new GeminiClient(config);
      } catch (error: unknown) {
        const errorMsg = `Failed to initialize client: ${getErrorMessage(error) || 'Unknown error'}`;
        setInitError(errorMsg);
        addItemToHistory({ type: 'error', text: errorMsg }, Date.now());
      }
    }
  }, [config, addItemToHistory]);

  useInput((input, key) => {
    if (streamingState === StreamingState.Responding && key.escape) {
      abortControllerRef.current?.abort();
    }
  });

  const updateGeminiMessage = useCallback(
    (messageId: number, newContent: string) => {
      updateHistoryItem(messageId, { text: newContent });
    },
    [updateHistoryItem],
  );

  const submitQuery = useCallback(
    async (query: PartListUnion) => {
      if (streamingState === StreamingState.Responding) return;
      if (typeof query === 'string' && query.trim().length === 0) return;

      const userMessageTimestamp = Date.now();
      messageIdCounterRef.current = 0;
      let queryToSendToGemini: PartListUnion | null = null;

      setShowHelp(false);

      if (typeof query === 'string') {
        const trimmedQuery = query.trim();
        setDebugMessage(`User query: '${trimmedQuery}'`);

        if (handleSlashCommand(trimmedQuery)) return;
        if (handleShellCommand(trimmedQuery)) return;

        if (isAtCommand(trimmedQuery)) {
          const atCommandResult = await handleAtCommand({
            query: trimmedQuery,
            config,
            addItemToHistory,
            updateHistoryItem,
            setDebugMessage,
            getNextMessageId,
            userMessageTimestamp,
          });
          if (!atCommandResult.shouldProceed) return;
          queryToSendToGemini = atCommandResult.processedQuery;
        } else {
          addItemToHistory(
            { type: 'user', text: trimmedQuery },
            userMessageTimestamp,
          );
          queryToSendToGemini = trimmedQuery;
        }
      } else {
        queryToSendToGemini = query;
      }

      if (queryToSendToGemini === null) {
        setDebugMessage(
          'Query processing resulted in null, not sending to Gemini.',
        );
        return;
      }

      const client = geminiClientRef.current;
      if (!client) {
        const errorMsg = 'Gemini client is not available.';
        setInitError(errorMsg);
        addItemToHistory({ type: 'error', text: errorMsg }, Date.now());
        return;
      }

      if (!chatSessionRef.current) {
        try {
          chatSessionRef.current = await client.startChat();
        } catch (err: unknown) {
          const errorMsg = `Failed to start chat: ${getErrorMessage(err)}`;
          setInitError(errorMsg);
          addItemToHistory({ type: 'error', text: errorMsg }, Date.now());
          setStreamingState(StreamingState.Idle);
          return;
        }
      }

      setStreamingState(StreamingState.Responding);
      setInitError(null);
      const chat = chatSessionRef.current;
      let currentToolGroupId: number | null = null;

      try {
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        const stream = client.sendMessageStream(
          chat,
          queryToSendToGemini,
          signal,
        );

        let currentGeminiText = '';
        let hasInitialGeminiResponse = false;

        for await (const event of stream) {
          if (signal.aborted) break;

          if (event.type === ServerGeminiEventType.Content) {
            currentGeminiText += event.value;
            currentToolGroupId = null;

            if (!hasInitialGeminiResponse) {
              hasInitialGeminiResponse = true;
              const eventId = addItemToHistory(
                { type: 'gemini', text: currentGeminiText },
                userMessageTimestamp,
              );
              currentGeminiMessageIdRef.current = eventId;
            } else if (currentGeminiMessageIdRef.current !== null) {
              const splitPoint = findSafeSplitPoint(currentGeminiText);
              if (splitPoint === currentGeminiText.length) {
                updateGeminiMessage(
                  currentGeminiMessageIdRef.current,
                  currentGeminiText,
                );
              } else {
                const originalMessageRef = currentGeminiMessageIdRef.current;
                const beforeText = currentGeminiText.substring(0, splitPoint);
                const afterText = currentGeminiText.substring(splitPoint);
                currentGeminiText = afterText;
                updateHistoryItem(originalMessageRef, { text: beforeText });
                const nextId = addItemToHistory(
                  { type: 'gemini_content', text: afterText },
                  userMessageTimestamp,
                );
                currentGeminiMessageIdRef.current = nextId;
              }
            }
          } else if (event.type === ServerGeminiEventType.ToolCallRequest) {
            currentGeminiText = '';
            hasInitialGeminiResponse = false;
            currentGeminiMessageIdRef.current = null;

            const { callId, name, args } = event.value;
            const cliTool = toolRegistry.getTool(name);
            if (!cliTool) {
              console.error(`CLI Tool "${name}" not found!`);
              continue;
            }

            if (currentToolGroupId === null) {
              currentToolGroupId = addItemToHistory(
                { type: 'tool_group', tools: [] } as Omit<HistoryItem, 'id'>,
                userMessageTimestamp,
              );
            }

            let description: string;
            try {
              description = cliTool.getDescription(args);
            } catch (e) {
              description = `Error: Unable to get description: ${getErrorMessage(e)}`;
            }

            const toolCallDisplay: IndividualToolCallDisplay = {
              callId,
              name: cliTool.displayName,
              description,
              status: ToolCallStatus.Pending,
              resultDisplay: undefined,
              confirmationDetails: undefined,
            };

            // Use functional update, returning the *entire* updated item
            if (currentToolGroupId !== null) {
              updateHistoryItem(
                currentToolGroupId,
                (
                  currentItem: HistoryItem,
                ): Partial<Omit<HistoryItem, 'id'>> => {
                  if (currentItem?.type !== 'tool_group') {
                    console.error(
                      `Attempted to update non-tool-group item ${currentItem?.id} as tool group.`,
                    );
                    // Return the original item if type doesn't match
                    // Cast to Partial to satisfy the return type signature
                    return currentItem as Partial<Omit<HistoryItem, 'id'>>;
                  }
                  const currentTools = currentItem.tools || [];
                  // Return the full updated item, cast to Partial
                  return {
                    ...currentItem,
                    tools: [...currentTools, toolCallDisplay],
                  } as Partial<Omit<HistoryItem, 'id'>>;
                },
              );
            }
          } else if (event.type === ServerGeminiEventType.ToolCallResponse) {
            const status = event.value.error
              ? ToolCallStatus.Error
              : ToolCallStatus.Success;
            updateFunctionResponseUI(event.value, status);
          } else if (
            event.type === ServerGeminiEventType.ToolCallConfirmation
          ) {
            const confirmationDetails = wireConfirmationSubmission(event.value);
            updateConfirmingFunctionStatusUI(
              event.value.request.callId,
              confirmationDetails,
            );
            setStreamingState(StreamingState.WaitingForConfirmation);
            return;
          }
        } // End stream loop

        setStreamingState(StreamingState.Idle);
      } catch (error: unknown) {
        if (!isNodeError(error) || error.name !== 'AbortError') {
          console.error('Error processing stream or executing tool:', error);
          addItemToHistory(
            {
              type: 'error',
              text: `[Stream Error: ${getErrorMessage(error)}]`,
            },
            userMessageTimestamp,
          );
        }
        setStreamingState(StreamingState.Idle);
      } finally {
        abortControllerRef.current = null;
      }

      // --- Helper functions using functional update returning full item ---

      function updateConfirmingFunctionStatusUI(
        callId: string,
        confirmationDetails: ToolCallConfirmationDetails | undefined,
      ) {
        if (currentToolGroupId === null) return;
        updateHistoryItem(
          currentToolGroupId,
          (currentItem: HistoryItem): Partial<Omit<HistoryItem, 'id'>> => {
            if (currentItem?.type !== 'tool_group') {
              console.error(
                `Attempted to update non-tool-group item ${currentItem?.id} status.`,
              );
              return currentItem as Partial<Omit<HistoryItem, 'id'>>;
            }
            // Return the full updated item, cast to Partial
            return {
              ...currentItem,
              tools: (currentItem.tools || []).map((tool) =>
                tool.callId === callId
                  ? {
                      ...tool,
                      status: ToolCallStatus.Confirming,
                      confirmationDetails,
                    }
                  : tool,
              ),
            } as Partial<Omit<HistoryItem, 'id'>>;
          },
        );
      }

      function updateFunctionResponseUI(
        toolResponse: ToolCallResponseInfo,
        status: ToolCallStatus,
      ) {
        if (currentToolGroupId === null) return;
        updateHistoryItem(
          currentToolGroupId,
          (currentItem: HistoryItem): Partial<Omit<HistoryItem, 'id'>> => {
            if (currentItem?.type !== 'tool_group') {
              console.error(
                `Attempted to update non-tool-group item ${currentItem?.id} response.`,
              );
              return currentItem as Partial<Omit<HistoryItem, 'id'>>;
            }
            // Return the full updated item, cast to Partial
            return {
              ...currentItem,
              tools: (currentItem.tools || []).map((tool) => {
                if (tool.callId === toolResponse.callId) {
                  return {
                    ...tool,
                    status,
                    resultDisplay: toolResponse.resultDisplay,
                  };
                } else {
                  return tool;
                }
              }),
            } as Partial<Omit<HistoryItem, 'id'>>;
          },
        );
      }

      function wireConfirmationSubmission(
        confirmationDetails: ServerToolCallConfirmationDetails,
      ): ToolCallConfirmationDetails {
        const originalConfirmationDetails = confirmationDetails.details;
        const request = confirmationDetails.request;
        const resubmittingConfirm = async (
          outcome: ToolConfirmationOutcome,
        ) => {
          originalConfirmationDetails.onConfirm(outcome);

          if (outcome === ToolConfirmationOutcome.Cancel) {
            let resultDisplay: ToolResultDisplay | undefined;
            if ('fileDiff' in originalConfirmationDetails) {
              resultDisplay = {
                fileDiff: (
                  originalConfirmationDetails as ToolEditConfirmationDetails
                ).fileDiff,
              };
            } else {
              resultDisplay = `~~${(originalConfirmationDetails as ToolExecuteConfirmationDetails).command}~~`;
            }
            const functionResponse: Part = {
              functionResponse: {
                id: request.callId,
                name: request.name,
                response: { error: 'User rejected function call.' },
              },
            };
            const responseInfo: ToolCallResponseInfo = {
              callId: request.callId,
              responsePart: functionResponse,
              resultDisplay,
              error: new Error('User rejected function call.'),
            };
            updateFunctionResponseUI(responseInfo, ToolCallStatus.Error);
            setStreamingState(StreamingState.Idle);
          } else {
            setStreamingState(StreamingState.Responding);
          }
        };

        return {
          ...originalConfirmationDetails,
          onConfirm: resubmittingConfirm,
        };
      }
    },
    // Dependencies updated
    [
      streamingState,
      config,
      getNextMessageId,
      updateGeminiMessage,
      handleSlashCommand,
      handleShellCommand,
      setDebugMessage,
      setStreamingState,
      addItemToHistory,
      updateHistoryItem,
      setShowHelp,
      toolRegistry,
      openThemeDialog,
      refreshStatic,
      setInitError,
      clearHistory,
    ],
  );

  return {
    streamingState,
    submitQuery,
    initError,
    debugMessage,
    slashCommands,
  };
};
