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
import { UseHistoryManagerReturn } from './useHistoryManager.js'; // Import the return type

// Define the props type for clarity, including refreshStatic
interface UseGeminiStreamProps {
  // @ts-expect-error - Temporarily passing setHistory until Phase 2
  setHistory: React.Dispatch<React.SetStateAction<HistoryItem[]>>; // Keep for Phase 1
  refreshStatic: () => void; // Added from HEAD/main
  config: Config;
  openThemeDialog: () => void;
  addItemToHistory: UseHistoryManagerReturn['addItemToHistory'];
  updateHistoryItem: UseHistoryManagerReturn['updateHistoryItem'];
  clearHistory: UseHistoryManagerReturn['clearHistory'];
}

export const useGeminiStream = ({
  // @ts-expect-error - Temporarily passing setHistory until Phase 2
  setHistory, // Keep for Phase 1
  refreshStatic, // Added from HEAD/main
  config,
  openThemeDialog,
  addItemToHistory, // Will be used in Phase 2
  updateHistoryItem, // Will be used in Phase 2
  clearHistory, // Will be used in Phase 2
}: UseGeminiStreamProps) => {
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

  // ID Generation Callback
  const getNextMessageId = useCallback((baseTimestamp: number): number => {
    // Increment *before* adding to ensure uniqueness against the base timestamp
    messageIdCounterRef.current += 1;
    return baseTimestamp + messageIdCounterRef.current;
  }, []);

  // Instantiate command processors
  const { handleSlashCommand, slashCommands } = useSlashCommandProcessor(
    setHistory, // Pass setHistory for now (Phase 1/2 boundary)
    refreshStatic,
    setDebugMessage,
    getNextMessageId,
    openThemeDialog,
    clearHistory, // Pass clearHistory for /clear command
  );

  const { handleShellCommand } = useShellCommandProcessor(
    setHistory, // Pass setHistory for now (Phase 1/2 boundary)
    setStreamingState,
    setDebugMessage,
    getNextMessageId,
    config,
    addItemToHistory, // Pass addItemToHistory
  );

  // Initialize Client Effect - uses props now
  useEffect(() => {
    setInitError(null);
    if (!geminiClientRef.current) {
      try {
        geminiClientRef.current = new GeminiClient(config);
      } catch (error: unknown) {
        setInitError(
          `Failed to initialize client: ${getErrorMessage(error) || 'Unknown error'}`,
        );
      }
    }
    // Re-initialize if API key or model changes
  }, [config]); // Depend on config object directly

  // Input Handling Effect (remains the same)
  useInput((input, key) => {
    if (streamingState === StreamingState.Responding && key.escape) {
      abortControllerRef.current?.abort();
    }
  });

  // Helper function to update Gemini message content (temporary for Phase 1)
  const updateGeminiMessage = useCallback(
    (messageId: number, newContent: string) => {
      // TODO (Phase 2): Replace with updateHistoryItem
      setHistory((prevHistory) =>
        prevHistory.map((item) =>
          item.id === messageId && item.type === 'gemini'
            ? { ...item, text: newContent }
            : item,
        ),
      );
    },
    [setHistory, updateHistoryItem], // Keep setHistory for now
  );

  // Helper function to update Gemini message content and add new part
  const updateAndAddGeminiMessageContent = useCallback(
    (
      messageId: number,
      previousContent: string,
      nextId: number,
      nextContent: string,
    ) => {
      // TODO (Phase 2): Replace with updateHistoryItem and addItemToHistory
      setHistory((prevHistory) => {
        const beforeNextHistory = prevHistory.map((item) =>
          item.id === messageId ? { ...item, text: previousContent } : item,
        );

        return [
          ...beforeNextHistory,
          { id: nextId, type: 'gemini_content', text: nextContent }, // Assuming 'gemini_content' is a valid type or needs adjustment
        ];
      });
    },
    [setHistory, addItemToHistory, updateHistoryItem], // Keep setHistory for now
  );

  // Improved submit query function
  const submitQuery = useCallback(
    async (query: PartListUnion) => {
      if (streamingState === StreamingState.Responding) return;
      if (typeof query === 'string' && query.trim().length === 0) return;

      const userMessageTimestamp = Date.now();
      messageIdCounterRef.current = 0; // Reset counter for this new submission
      let queryToSendToGemini: PartListUnion | null = null;

      if (typeof query === 'string') {
        const trimmedQuery = query.trim();
        setDebugMessage(`User query: '${trimmedQuery}'`);

        // 1. Check for Slash Commands (/)
        if (handleSlashCommand(trimmedQuery)) {
          return;
        }

        // 2. Check for Shell Commands (! or $)
        if (handleShellCommand(trimmedQuery)) {
          return;
        }

        // 3. Check for @ Commands using the utility function
        if (isAtCommand(trimmedQuery)) {
          const atCommandResult = await handleAtCommand({
            query: trimmedQuery,
            config,
            // TODO (Phase 3): Pass history manager functions
            setHistory, // Keep for now
            addItemToHistory,
            setDebugMessage,
            getNextMessageId,
            userMessageTimestamp,
          });

          if (!atCommandResult.shouldProceed) {
            return; // @ command handled it (e.g., error) or decided not to proceed
          }
          queryToSendToGemini = atCommandResult.processedQuery;
          // User message and tool UI were added by handleAtCommand
        } else {
          // 4. It's a normal query for Gemini
          // TODO (Phase 2): Replace with addItemToHistory
          addItemToHistory(
            { type: 'user', text: trimmedQuery },
            userMessageTimestamp,
          );
          queryToSendToGemini = trimmedQuery;
        }
      } else {
        // 5. It's a function response (PartListUnion that isn't a string)
        // Tool call/response UI handles history. Always proceed.
        queryToSendToGemini = query;
      }

      // --- Proceed to Gemini API call ---
      if (queryToSendToGemini === null) {
        // Should only happen if @ command failed and returned null query
        setDebugMessage(
          'Query processing resulted in null, not sending to Gemini.',
        );
        return;
      }

      const client = geminiClientRef.current;
      if (!client) {
        setInitError('Gemini client is not available.');
        // TODO (Phase 2): Use addItemToHistory for error
        addItemToHistory(
          { type: 'error', text: 'Gemini client is not available.' },
          getNextMessageId(userMessageTimestamp),
        );
        return;
      }

      if (!chatSessionRef.current) {
        try {
          chatSessionRef.current = await client.startChat();
        } catch (err: unknown) {
          const errorMsg = `Failed to start chat: ${getErrorMessage(err)}`;
          setInitError(errorMsg);
          // TODO (Phase 2): Use addItemToHistory for error
          addItemToHistory(
            { type: 'error', text: errorMsg },
            getNextMessageId(userMessageTimestamp),
          );
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

        // Use the determined query for the Gemini call
        const stream = client.sendMessageStream(
          chat,
          queryToSendToGemini,
          signal,
        );

        // Process the stream events from the server logic
        let currentGeminiText = ''; // To accumulate message content
        let hasInitialGeminiResponse = false;

        for await (const event of stream) {
          if (signal.aborted) break;

          if (event.type === ServerGeminiEventType.Content) {
            // For content events, accumulate the text and update an existing message or create a new one
            currentGeminiText += event.value;

            // Reset group because we're now adding a user message to the history. If we didn't reset the
            // group here then any subsequent tool calls would get grouped before this message resulting in
            // a misordering of history.
            currentToolGroupId = null;

            if (!hasInitialGeminiResponse) {
              // Create a new Gemini message if this is the first content event
              hasInitialGeminiResponse = true;
              const eventTimestamp = getNextMessageId(userMessageTimestamp);
              currentGeminiMessageIdRef.current = eventTimestamp;

              // TODO (Phase 2): Replace with addItemToHistory
              addItemToHistory(
                { type: 'gemini', text: currentGeminiText },
                eventTimestamp,
              );
            } else if (currentGeminiMessageIdRef.current !== null) {
              const splitPoint = findSafeSplitPoint(currentGeminiText);

              if (splitPoint === currentGeminiText.length) {
                // Update the existing message with accumulated content
                updateGeminiMessage(
                  currentGeminiMessageIdRef.current,
                  currentGeminiText,
                );
              } else {
                // This indicates that we need to split up this Gemini Message.
                // Splitting a message is primarily a performance consideration. There is a
                // <Static> component at the root of App.tsx which takes care of rendering
                // content statically or dynamically. Everything but the last message is
                // treated as static in order to prevent re-rendering an entire message history
                // multiple times per-second (as streaming occurs). Prior to this change you'd
                // see heavy flickering of the terminal. This ensures that larger messages get
                // broken up so that there are more "statically" rendered.
                const originalMessageRef = currentGeminiMessageIdRef.current;
                const beforeText = currentGeminiText.substring(0, splitPoint);

                currentGeminiMessageIdRef.current =
                  getNextMessageId(userMessageTimestamp);
                const afterText = currentGeminiText.substring(splitPoint);
                currentGeminiText = afterText; // Continue accumulating from the split point
                updateAndAddGeminiMessageContent(
                  originalMessageRef,
                  beforeText,
                  currentGeminiMessageIdRef.current,
                  afterText,
                );
              }
            }
          } else if (event.type === ServerGeminiEventType.ToolCallRequest) {
            // Reset the Gemini message tracking for the next response
            currentGeminiText = '';
            hasInitialGeminiResponse = false;
            currentGeminiMessageIdRef.current = null;

            const { callId, name, args } = event.value;

            const cliTool = toolRegistry.getTool(name); // Get the full CLI tool
            if (!cliTool) {
              console.error(`CLI Tool "${name}" not found!`);
              // TODO (Phase 2): Add error to history using addItemToHistory
              continue;
            }

            if (currentToolGroupId === null) {
              currentToolGroupId = getNextMessageId(userMessageTimestamp);
              // TODO (Phase 2): Replace with addItemToHistory
              // Add explicit cast to Omit<HistoryItem, 'id'>
              addItemToHistory(
                { type: 'tool_group', tools: [] } as Omit<HistoryItem, 'id'>,
                currentToolGroupId,
              );
            }

            let description: string;
            try {
              description = cliTool.getDescription(args);
            } catch (e) {
              description = `Error: Unable to get description: ${getErrorMessage(e)}`;
            }

            // Create the UI display object matching IndividualToolCallDisplay
            const toolCallDisplay: IndividualToolCallDisplay = {
              callId,
              name: cliTool.displayName,
              description,
              status: ToolCallStatus.Pending,
              resultDisplay: undefined,
              confirmationDetails: undefined,
            };

            // Add pending tool call to the UI history group
            // TODO (Phase 2): Replace with updateHistoryItem
            updateHistoryItem(currentToolGroupId, (item) => {
              if (item.type === 'tool_group') {
                const currentTools = Array.isArray(item.tools) ? item.tools : [];
                return {
                  ...item,
                  tools: [...currentTools, toolCallDisplay],
                };
              }
              return item; // Should not happen for tool_group type
            });

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
            // Don't set state back to Idle here, wait for user confirmation
            return; // Exit the callback, wait for confirmation handler
          }
        } // End of stream loop

        // If loop finishes without confirmation request or error
        if (streamingState === StreamingState.Responding) {
           setStreamingState(StreamingState.Idle);
        }

      } catch (error: unknown) {
        if (!isNodeError(error) || error.name !== 'AbortError') {
          console.error('Error processing stream or executing tool:', error);
           // TODO (Phase 2): Replace with addItemToHistory
          addItemToHistory(
            {
              type: 'error',
              text: `[Error processing response: ${getErrorMessage(error)}]`,
            },
            getNextMessageId(userMessageTimestamp),
          );
        } else {
           // TODO (Phase 2): Replace with addItemToHistory
           addItemToHistory(
            { type: 'info', text: 'Request cancelled.'},
            getNextMessageId(userMessageTimestamp)
           );
        }
        setStreamingState(StreamingState.Idle); // Ensure state is reset on error/abort
      } finally {
        abortControllerRef.current = null;
      }

      // --- Helper functions defined within submitQuery scope ---

      function updateConfirmingFunctionStatusUI(
        callId: string,
        confirmationDetails: ToolCallConfirmationDetails | undefined,
      ) {
        // TODO (Phase 2): Replace with updateHistoryItem
        updateHistoryItem(currentToolGroupId!, (item) => {
          if (item.type === 'tool_group') {
            return {
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
            };
          }
          return item;
        });
      }

      function updateFunctionResponseUI(
        toolResponse: ToolCallResponseInfo,
        status: ToolCallStatus,
      ) {
         // TODO (Phase 2): Replace with updateHistoryItem
         updateHistoryItem(currentToolGroupId!, (item) => {
           if (item.type === 'tool_group') {
             return {
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
             };
           }
           return item;
         });
      }

      function wireConfirmationSubmission(
        confirmationDetails: ServerToolCallConfirmationDetails,
      ): ToolCallConfirmationDetails {
        const originalConfirmationDetails = confirmationDetails.details;
        const request = confirmationDetails.request;

        const resubmittingConfirm = async (
          outcome: ToolConfirmationOutcome,
        ) => {
          // Call the original onConfirm from the server to signal back
          originalConfirmationDetails.onConfirm(outcome);

          // Update UI based on outcome
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

            const responseInfo: ToolCallResponseInfo = {
              callId: request.callId,
              // Construct a minimal response part indicating cancellation
              responsePart: {
                 functionResponse: {
                   id: request.callId,
                   name: request.name,
                   response: { error: 'User rejected function call.' },
                 }
              },
              resultDisplay,
              error: 'User rejected function call.', // Indicate error state
            };

            updateFunctionResponseUI(responseInfo, ToolCallStatus.Error);
            setStreamingState(StreamingState.Idle); // Return to idle after cancellation

          } else { // Outcome is Execute
             // Update UI to show executing status immediately
             updateFunctionResponseUI(
                { callId: request.callId, responsePart: { functionResponse: { id: request.callId, name: request.name, response: {}}}}, // Minimal info needed
                ToolCallStatus.Executing
             );

            try {
                const tool = toolRegistry.getTool(request.name);
                if (!tool) {
                  throw new Error(
                    `Tool "${request.name}" not found or is not registered.`
                  );
                }
                const result = await tool.execute(request.args);
                const functionResponse: Part = {
                  functionResponse: {
                    name: request.name,
                    id: request.callId, // Use the original callId
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
                // Set state to Idle *before* resubmitting to allow the next query
                setStreamingState(StreamingState.Idle);
                // Resubmit the function response to Gemini
                await submitQuery(functionResponse);

            } catch (error) {
                 console.error(`Error executing tool ${request.name}:`, error);
                 const errorMsg = getErrorMessage(error);
                 const responseInfo: ToolCallResponseInfo = {
                    callId: request.callId,
                    responsePart: { functionResponse: { id: request.callId, name: request.name, response: { error: errorMsg }}},
                    resultDisplay: `Error: ${errorMsg}`,
                    error: errorMsg,
                 };
                 updateFunctionResponseUI(responseInfo, ToolCallStatus.Error);
                 setStreamingState(StreamingState.Idle); // Return to idle on execution error
            }
          }
        };

        // Return the details needed by the UI component, replacing onConfirm
        return {
          ...originalConfirmationDetails,
          onConfirm: resubmittingConfirm,
        };
      }
    },
    // Dependencies need careful review after refactoring
    [
      streamingState,
      setHistory, // Keep for Phase 1
      refreshStatic, // Added dependency
      config,
      getNextMessageId,
      updateGeminiMessage,
      updateAndAddGeminiMessageContent,
      handleSlashCommand,
      handleShellCommand,
      // handleAtCommand is called directly, its dependencies are implicitly included if it uses state/props from here
      setDebugMessage,
      setStreamingState,
      toolRegistry, // Added dependency
      addItemToHistory, // Add new history functions
      updateHistoryItem,
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
