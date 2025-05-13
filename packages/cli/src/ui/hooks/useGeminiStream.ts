/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useInput } from 'ink';
import {
  GeminiClient,
  GeminiEventType as ServerGeminiEventType,
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
  IndividualToolCallDisplay,
  ToolCallStatus,
  HistoryItemWithoutId,
  MessageType,
} from '../types.js';
import { isAtCommand } from '../utils/commandUtils.js';
import { useSlashCommandProcessor } from './slashCommandProcessor.js';
import { useShellCommandProcessor } from './shellCommandProcessor.js';
import { handleAtCommand } from './atCommandProcessor.js';
import { findLastSafeSplitPoint } from '../utils/markdownUtilities.js';
import { useStateAndRef } from './useStateAndRef.js';
import { UseHistoryManagerReturn } from './useHistoryManager.js';
import { loadHierarchicalGeminiMemory } from '../../config/config.js';
import process from 'node:process';

export const useGeminiStream = (
  addItem: UseHistoryManagerReturn['addItem'],
  clearItems: UseHistoryManagerReturn['clearItems'],
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
  const [pendingHistoryItemRef, setPendingHistoryItem] =
    useStateAndRef<HistoryItemWithoutId | null>(null);

  const performMemoryRefresh = useCallback(async () => {
    addItem(
      {
        type: MessageType.INFO,
        text: 'Refreshing hierarchical memory (GEMINI.md files)...',
      },
      Date.now(),
    );
    try {
      const newMemory = await loadHierarchicalGeminiMemory(
        process.cwd(),
        config.getDebugMode(),
      );
      config.setUserMemory(newMemory);
      chatSessionRef.current = null;
      addItem(
        {
          type: MessageType.INFO,
          text: `Memory refreshed successfully. ${newMemory.length > 0 ? `Loaded ${newMemory.length} characters.` : 'No memory content found.'}`,
        },
        Date.now(),
      );
      if (config.getDebugMode()) {
        console.log(
          `[DEBUG] Refreshed memory content in config: ${newMemory.substring(0, 200)}...`,
        );
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      addItem(
        {
          type: MessageType.ERROR,
          text: `Error refreshing memory: ${errorMessage}`,
        },
        Date.now(),
      );
      console.error('Error refreshing memory:', error);
    }
  }, [config, addItem]);

  const { handleSlashCommand, slashCommands } = useSlashCommandProcessor(
    config,
    addItem,
    clearItems,
    refreshStatic,
    setShowHelp,
    setDebugMessage,
    openThemeDialog,
    performMemoryRefresh,
  );

  const { handleShellCommand } = useShellCommandProcessor(
    addItem,
    setStreamingState,
    setDebugMessage,
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
        addItem({ type: MessageType.ERROR, text: errorMsg }, Date.now());
      }
    }
  }, [config, addItem]);

  useInput((_input, key) => {
    if (streamingState !== StreamingState.Idle && key.escape) {
      abortControllerRef.current?.abort();
    }
  });

  const submitQuery = useCallback(
    async (query: PartListUnion) => {
      if (streamingState === StreamingState.Responding) return;
      if (typeof query === 'string' && query.trim().length === 0) return;

      const userMessageTimestamp = Date.now();
      let queryToSendToGemini: PartListUnion | null = null;

      setShowHelp(false);

      abortControllerRef.current ??= new AbortController();
      const signal = abortControllerRef.current.signal;

      if (typeof query === 'string') {
        const trimmedQuery = query.trim();
        setDebugMessage(`User query: '${trimmedQuery}'`);

        if (handleSlashCommand(trimmedQuery)) return;
        if (handleShellCommand(trimmedQuery)) return;

        if (isAtCommand(trimmedQuery)) {
          const atCommandResult = await handleAtCommand({
            query: trimmedQuery,
            config,
            addItem,
            setDebugMessage,
            messageId: userMessageTimestamp,
            signal,
          });
          if (!atCommandResult.shouldProceed) return;
          queryToSendToGemini = atCommandResult.processedQuery;
        } else {
          addItem(
            { type: MessageType.USER, text: trimmedQuery },
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
        addItem({ type: MessageType.ERROR, text: errorMsg }, Date.now());
        return;
      }

      if (!chatSessionRef.current) {
        try {
          chatSessionRef.current = await client.startChat();
        } catch (err: unknown) {
          const errorMsg = `Failed to start chat: ${getErrorMessage(err)}`;
          setInitError(errorMsg);
          addItem({ type: MessageType.ERROR, text: errorMsg }, Date.now());
          setStreamingState(StreamingState.Idle);
          return;
        }
      }

      setStreamingState(StreamingState.Responding);
      setInitError(null);
      const chat = chatSessionRef.current;

      try {
        const stream = client.sendMessageStream(
          chat,
          queryToSendToGemini,
          signal,
        );

        let geminiMessageBuffer = '';

        for await (const event of stream) {
          if (event.type === ServerGeminiEventType.Content) {
            if (
              pendingHistoryItemRef.current?.type !== 'gemini' &&
              pendingHistoryItemRef.current?.type !== 'gemini_content'
            ) {
              if (pendingHistoryItemRef.current) {
                addItem(pendingHistoryItemRef.current, userMessageTimestamp);
              }
              setPendingHistoryItem({
                type: 'gemini',
                text: '',
              });
              geminiMessageBuffer = '';
            }

            geminiMessageBuffer += event.value;

            const splitPoint = findLastSafeSplitPoint(geminiMessageBuffer);
            if (splitPoint === geminiMessageBuffer.length) {
              setPendingHistoryItem((item) => ({
                type: item?.type as 'gemini' | 'gemini_content',
                text: geminiMessageBuffer,
              }));
            } else {
              const beforeText = geminiMessageBuffer.substring(0, splitPoint);
              const afterText = geminiMessageBuffer.substring(splitPoint);
              geminiMessageBuffer = afterText;
              addItem(
                {
                  type: pendingHistoryItemRef.current?.type as
                    | 'gemini'
                    | 'gemini_content',
                  text: beforeText,
                },
                userMessageTimestamp,
              );
              setPendingHistoryItem({
                type: 'gemini_content',
                text: afterText,
              });
            }
          } else if (event.type === ServerGeminiEventType.ToolCallRequest) {
            const { callId, name, args } = event.value;
            const cliTool = toolRegistry.getTool(name);
            if (!cliTool) {
              console.error(`CLI Tool "${name}" not found!`);
              continue;
            }

            if (pendingHistoryItemRef.current?.type !== 'tool_group') {
              if (pendingHistoryItemRef.current) {
                addItem(pendingHistoryItemRef.current, userMessageTimestamp);
              }
              setPendingHistoryItem({
                type: 'tool_group',
                tools: [],
              });
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

            setPendingHistoryItem((pending) =>
              pending?.type === 'tool_group'
                ? {
                    ...pending,
                    tools: [...pending.tools, toolCallDisplay],
                  }
                : null,
            );
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
          } else if (event.type === ServerGeminiEventType.UserCancelled) {
            if (pendingHistoryItemRef.current) {
              if (pendingHistoryItemRef.current.type === 'tool_group') {
                const updatedTools = pendingHistoryItemRef.current.tools.map(
                  (tool) => {
                    if (
                      tool.status === ToolCallStatus.Pending ||
                      tool.status === ToolCallStatus.Confirming ||
                      tool.status === ToolCallStatus.Executing
                    ) {
                      return { ...tool, status: ToolCallStatus.Canceled };
                    }
                    return tool;
                  },
                );
                const pendingHistoryItem = pendingHistoryItemRef.current; // Create a mutable copy
                pendingHistoryItem.tools = updatedTools;
                addItem(pendingHistoryItem, userMessageTimestamp);
              } else {
                addItem(pendingHistoryItemRef.current, userMessageTimestamp);
              }
              setPendingHistoryItem(null);
            }
            addItem(
              { type: MessageType.INFO, text: 'User cancelled the request.' },
              userMessageTimestamp,
            );
            setStreamingState(StreamingState.Idle);
            return;
          } else if (event.type === ServerGeminiEventType.Error) {
            if (pendingHistoryItemRef.current) {
              addItem(pendingHistoryItemRef.current, userMessageTimestamp);
              setPendingHistoryItem(null);
            }
            addItem(
              {
                type: MessageType.ERROR,
                text: `[API Error: ${event.value.message}]`,
              },
              userMessageTimestamp,
            );
          }
        }

        if (pendingHistoryItemRef.current) {
          addItem(pendingHistoryItemRef.current, userMessageTimestamp);
          setPendingHistoryItem(null);
        }

        setStreamingState(StreamingState.Idle);
      } catch (error: unknown) {
        if (!isNodeError(error) || error.name !== 'AbortError') {
          addItem(
            {
              type: MessageType.ERROR,
              text: `[Stream Error: ${getErrorMessage(error)}]`,
            },
            userMessageTimestamp,
          );
        }
        setStreamingState(StreamingState.Idle);
      } finally {
        abortControllerRef.current = null;
      }

      function updateConfirmingFunctionStatusUI(
        callId: string,
        confirmationDetails: ToolCallConfirmationDetails | undefined,
      ) {
        if (pendingHistoryItemRef.current?.type !== 'tool_group') return;
        setPendingHistoryItem((item) =>
          item?.type === 'tool_group'
            ? {
                ...item,
                tools: item.tools.map((tool) =>
                  tool.callId === callId
                    ? {
                        ...tool,
                        status: ToolCallStatus.Confirming,
                        confirmationDetails,
                      }
                    : tool,
                ),
              }
            : null,
        );
      }

      function updateFunctionResponseUI(
        toolResponse: ToolCallResponseInfo,
        status: ToolCallStatus,
      ) {
        setPendingHistoryItem((item) =>
          item?.type === 'tool_group'
            ? {
                ...item,
                tools: item.tools.map((tool) => {
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
              }
            : null,
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

          if (pendingHistoryItemRef?.current?.type === 'tool_group') {
            setPendingHistoryItem((item) =>
              item?.type === 'tool_group'
                ? {
                    ...item,
                    tools: item.tools.map((tool) =>
                      tool.callId === request.callId
                        ? {
                            ...tool,
                            confirmationDetails: undefined,
                            status: ToolCallStatus.Executing,
                          }
                        : tool,
                    ),
                  }
                : item,
            );
            refreshStatic();
          }

          if (outcome === ToolConfirmationOutcome.Cancel) {
            declineToolExecution(
              'User rejected function call.',
              ToolCallStatus.Error,
            );
          } else {
            const tool = toolRegistry.getTool(request.name);
            if (!tool) {
              throw new Error(
                `Tool "${request.name}" not found or is not registered.`,
              );
            }

            try {
              abortControllerRef.current = new AbortController();
              const result = await tool.execute(
                request.args,
                abortControllerRef.current.signal,
              );

              if (abortControllerRef.current.signal.aborted) {
                declineToolExecution(
                  result.llmContent,
                  ToolCallStatus.Canceled,
                );
                return;
              }

              const functionResponse: Part = {
                functionResponse: {
                  name: request.name,
                  id: request.callId,
                  response: { output: result.llmContent },
                },
              };

              const responseInfo: ToolCallResponseInfo = {
                callId: request.callId,
                responsePart: functionResponse,
                resultDisplay: result.returnDisplay,
                error: undefined,
              };
              updateFunctionResponseUI(responseInfo, ToolCallStatus.Success);
              setStreamingState(StreamingState.Idle);
              await submitQuery(functionResponse);
            } finally {
              abortControllerRef.current = null;
            }
          }

          function declineToolExecution(
            declineMessage: string,
            status: ToolCallStatus,
          ) {
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
                response: { error: declineMessage },
              },
            };
            const responseInfo: ToolCallResponseInfo = {
              callId: request.callId,
              responsePart: functionResponse,
              resultDisplay,
              error: new Error(declineMessage),
            };

            const history = chatSessionRef.current?.getHistory();
            if (history) {
              history.push({
                role: 'model',
                parts: [functionResponse],
              });
            }

            updateFunctionResponseUI(responseInfo, status);
            setStreamingState(StreamingState.Idle);
          }
        };

        return {
          ...originalConfirmationDetails,
          onConfirm: resubmittingConfirm,
        };
      }
    },
    [
      streamingState,
      setShowHelp,
      handleSlashCommand,
      handleShellCommand,
      config,
      addItem,
      pendingHistoryItemRef,
      setPendingHistoryItem,
      toolRegistry,
      refreshStatic,
    ],
  );

  return {
    streamingState,
    submitQuery,
    initError,
    debugMessage,
    slashCommands,
    pendingHistoryItem: pendingHistoryItemRef.current,
  };
};
