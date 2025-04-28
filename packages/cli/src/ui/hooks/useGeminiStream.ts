/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { exec as _exec } from 'child_process';
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
import { findSafeSplitPoint } from '../utils/markdownUtilities.js';
import { handleAtCommand } from './atCommandProcessor.js';
import { isPotentiallyAtCommand } from '../utils/commandUtils.js';

interface SlashCommand {
  name: string; // slash command
  description: string; // flavor text in UI
  action: (value: PartListUnion) => void;
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

// Hook now accepts apiKey and model
export const useGeminiStream = (
  setHistory: React.Dispatch<React.SetStateAction<HistoryItem[]>>,
  config: Config,
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

  const slashCommands: SlashCommand[] = [
    {
      name: 'clear',
      description: 'clear the screen',
      action: (_value: PartListUnion) => {
        // This just clears the *UI* history, not the model history.
        setDebugMessage('Clearing terminal.');
        setHistory((_) => []);
      },
    },
    {
      name: 'exit',
      description: 'Exit gemini-code',
      action: (_value: PartListUnion) => {
        setDebugMessage('Exiting. Good-bye.');
        const timestamp = getNextMessageId(Date.now());
        addHistoryItem(
          setHistory,
          { type: 'info', text: 'good-bye!' },
          timestamp,
        );
        process.exit(0);
      },
    },
    {
      // TODO: dedup with exit by adding altName or cmdRegex.
      name: 'quit',
      description: 'Quit gemini-code',
      action: (_value: PartListUnion) => {
        setDebugMessage('Quitting. Good-bye.');
        const timestamp = getNextMessageId(Date.now());
        addHistoryItem(
          setHistory,
          { type: 'info', text: 'good-bye!' },
          timestamp,
        );
        process.exit(0);
      },
    },
  ];

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
  }, [config]);

  // Input Handling Effect (remains the same)
  useInput((input, key) => {
    if (streamingState === StreamingState.Responding && key.escape) {
      abortControllerRef.current?.abort();
    }
  });

  // ID Generation Callback (remains the same)
  const getNextMessageId = useCallback((baseTimestamp: number): number => {
    messageIdCounterRef.current += 1;
    return baseTimestamp + messageIdCounterRef.current;
  }, []);

  // Helper function to update Gemini message content
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

  // Possibly handle a query manually, return true if handled.
  const handleQueryManually = (rawQuery: PartListUnion): boolean => {
    if (typeof rawQuery !== 'string') {
      return false;
    }

    const trimmedQuery = rawQuery.trim();
    let query = trimmedQuery;
    if (query.length && query.charAt(0) === '/') {
      query = query.slice(1);
    }

    for (const cmd of slashCommands) {
      if (query === cmd.name) {
        cmd.action(query);
        return true;
      }
    }

    const maybeCommand = trimmedQuery.split(/\s+/)[0];
    if (config.getPassthroughCommands().includes(maybeCommand)) {
      // Execute and capture output
      const targetDir = config.getTargetDir();
      setDebugMessage(`Executing shell command in ${targetDir}: ${query}`);
      const execOptions = {
        cwd: targetDir,
      };
      _exec(query, execOptions, (error, stdout, stderr) => {
        const timestamp = getNextMessageId(Date.now());
        if (error) {
          addHistoryItem(
            setHistory,
            { type: 'error', text: error.message },
            timestamp,
          );
        } else if (stderr) {
          addHistoryItem(
            setHistory,
            { type: 'error', text: stderr },
            timestamp,
          );
        } else {
          // Add stdout as an info message
          addHistoryItem(
            setHistory,
            { type: 'info', text: stdout || '' },
            timestamp,
          );
        }
        // Set state back to Idle *after* command finishes and output is added
        setStreamingState(StreamingState.Idle);
      });
      // Set state to Responding while the command runs
      setStreamingState(StreamingState.Responding);
      return true;
    }

    return false; // Not handled by a manual command.
  };

  // Helper function to update Gemini message content
  const updateAndAddGeminiMessageContent = useCallback(
    (
      messageId: number,
      previousContent: string,
      nextId: number,
      nextContent: string,
    ) => {
      setHistory((prevHistory) => {
        const beforeNextHistory = prevHistory.map((item) =>
          item.id === messageId ? { ...item, text: previousContent } : item,
        );

        return [
          ...beforeNextHistory,
          { id: nextId, type: 'gemini_content', text: nextContent },
        ];
      });
    },
    [setHistory],
  );

  // Improved submit query function
  const submitQuery = useCallback(
    async (query: PartListUnion) => {
      if (streamingState === StreamingState.Responding) return;
      if (typeof query === 'string' && query.trim().length === 0) return;

      const userMessageTimestamp = Date.now();
      let processedQuery: PartListUnion;
      let shouldProceed: boolean;

      // --- Pre-processing for special commands (clear, passthrough, @file) ---
      if (typeof query === 'string') {
        const trimmedQuery = query.trim();
        const maybeCommand = trimmedQuery.split(/\s+/)[0];

        // 1. Handle 'clear' command
        if (trimmedQuery === 'clear') {
          setDebugMessage('Clearing terminal.');
          setHistory((_) => []);
          return; // Stop processing
        }

        // 2. Handle passthrough commands
        if (config.getPassthroughCommands().includes(maybeCommand)) {
          // Add user message first
          addHistoryItem(
            setHistory,
            { type: 'user', text: query },
            userMessageTimestamp,
          );
          // Execute and capture output
          const targetDir = config.getTargetDir();
          setDebugMessage(`Executing shell command in ${targetDir}: ${query}`);
          const execOptions = { cwd: targetDir };
          _exec(query, execOptions, (error, stdout, stderr) => {
            const timestamp = getNextMessageId(Date.now());
            if (error) {
              addHistoryItem(
                setHistory,
                { type: 'error', text: error.message },
                timestamp,
              );
            } else if (stderr) {
              addHistoryItem(
                setHistory,
                { type: 'error', text: stderr },
                timestamp,
              );
            } else {
              addHistoryItem(
                setHistory,
                { type: 'info', text: stdout || '' },
                timestamp,
              );
            }
            setStreamingState(StreamingState.Idle);
          });
          setStreamingState(StreamingState.Responding); // Set state while exec runs
          return; // Prevent Gemini call
        }

        // 3. Check if it looks like an '@' command
        if (isPotentiallyAtCommand(query)) {
          // Handle '@' command using the dedicated processor
          const atCommandResult = await handleAtCommand({
            query,
            config,
            setHistory,
            setDebugMessage,
            getNextMessageId,
            userMessageTimestamp,
          });
          processedQuery = atCommandResult.processedQuery;
          shouldProceed = atCommandResult.shouldProceed;

          if (!shouldProceed) {
            setStreamingState(StreamingState.Idle); // Ensure state is reset if not proceeding
            return; // Stop if @ command handled it or failed
          }
          // If handleAtCommand proceeded, it already added the user message.
        } else {
          // It's a regular query that happens to contain '@', not an @-command.
          // Add the user message manually and proceed to Gemini.
          addHistoryItem(
            setHistory,
            { type: 'user', text: query },
            userMessageTimestamp,
          );
          processedQuery = query;
          shouldProceed = true;
        }
      } else {
        // If query is already PartListUnion (e.g., function response), use it directly
        // No user message added here as it's an internal step
        processedQuery = query;
        shouldProceed = true; // Always proceed with internal function responses
      }
      // --- End Pre-processing ---

      // --- Start Gemini API Call Logic ---
      const client = geminiClientRef.current;
      if (!client) {
        setInitError('Gemini client is not available.');
        setStreamingState(StreamingState.Idle); // Reset state
        return;
      }

      if (!chatSessionRef.current) {
        try {
          chatSessionRef.current = await client.startChat();
        } catch (err: unknown) {
          setInitError(`Failed to start chat: ${getErrorMessage(err)}`);
          setStreamingState(StreamingState.Idle);
          return;
        }
      }

      setStreamingState(StreamingState.Responding);
      setInitError(null);
      messageIdCounterRef.current = 0; // Reset counter for new submission
      const chat = chatSessionRef.current;
      let currentToolGroupId: number | null = null;

      try {
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        const stream = client.sendMessageStream(chat, processedQuery, signal);

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

              addHistoryItem(
                setHistory,
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
                currentGeminiText = afterText;
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
              // Add error to history? Or just log?
              const errorTimestamp = getNextMessageId(userMessageTimestamp);
              addHistoryItem(
                setHistory,
                {
                  type: 'error',
                  text: `Error: Tool "${name}" requested by model not found.`,
                },
                errorTimestamp,
              );
              continue; // Skip this tool call
            }

            if (currentToolGroupId === null) {
              currentToolGroupId = getNextMessageId(userMessageTimestamp);
              // Add explicit cast to Omit<HistoryItem, 'id'>
              addHistoryItem(
                setHistory,
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
            setHistory((prevHistory) =>
              prevHistory.map((item) => {
                if (
                  item.id === currentToolGroupId &&
                  item.type === 'tool_group'
                ) {
                  // Ensure item.tools exists and is an array before spreading
                  const currentTools = Array.isArray(item.tools)
                    ? item.tools
                    : [];
                  return {
                    ...item,
                    tools: [...currentTools, toolCallDisplay], // Add the complete display object
                  };
                }
                return item;
              }),
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
            return; // Exit the loop to wait for user confirmation
          }
        } // End for-await loop

        // If loop finishes normally (not aborted or waiting for confirmation)
        setStreamingState(StreamingState.Idle);
      } catch (error: unknown) {
        if (!isNodeError(error) || error.name !== 'AbortError') {
          console.error('Error processing stream or executing tool:', error);
          addHistoryItem(
            setHistory,
            {
              type: 'error',
              text: `[Stream Error: ${getErrorMessage(error)}]`,
            },
            getNextMessageId(userMessageTimestamp),
          );
        } else {
          // Handle AbortError specifically (user cancellation)
          addHistoryItem(
            setHistory,
            {
              type: 'info',
              text: 'Request cancelled.',
            },
            getNextMessageId(userMessageTimestamp),
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
        setHistory((prevHistory) =>
          prevHistory.map((item) => {
            if (item.id === currentToolGroupId && item.type === 'tool_group') {
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
          }),
        );
      }

      function updateFunctionResponseUI(
        toolResponse: ToolCallResponseInfo,
        status: ToolCallStatus,
      ) {
        setHistory((prevHistory) =>
          prevHistory.map((item) => {
            if (item.id === currentToolGroupId && item.type === 'tool_group') {
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
          }),
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

          // Reset streaming state since confirmation has been chosen.
          // Important: Do NOT set to Idle here yet, let the subsequent submitQuery call handle it.
          // setStreamingState(StreamingState.Idle); // REMOVED

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
              error: {
                name: 'FunctionCallRejection',
                message: 'User rejected function call.',
              },
            };

            // Update UI to show cancellation/error *before* resubmitting
            updateFunctionResponseUI(responseInfo, ToolCallStatus.Canceled); // Use Canceled status

            // Resubmit the rejection to the model
            await submitQuery(functionResponse);
          } else {
            // User approved (ProceedOnce or ProceedAlways)
            const tool = toolRegistry.getTool(request.name);
            if (!tool) {
              // This should ideally not happen if ToolCallRequest handled it, but double-check
              const errorMsg = `Tool "${request.name}" not found or is not registered.`;
              console.error(errorMsg);
              const functionResponse: Part = {
                functionResponse: {
                  id: request.callId,
                  name: request.name,
                  response: { error: errorMsg },
                },
              };
              const responseInfo: ToolCallResponseInfo = {
                callId: request.callId,
                responsePart: functionResponse,
                resultDisplay: errorMsg,
                error: { name: 'ToolNotFound', message: errorMsg },
              };
              updateFunctionResponseUI(responseInfo, ToolCallStatus.Error);
              await submitQuery(functionResponse); // Send error back to model
              return; // Stop execution
            }

            // Execute the tool
            try {
              const result = await tool.execute(request.args);
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
              // Update UI to show success *before* resubmitting
              updateFunctionResponseUI(responseInfo, ToolCallStatus.Success);

              // Resubmit the successful result to the model
              await submitQuery(functionResponse);
            } catch (executionError) {
              // Handle errors during tool execution
              const errorMsg = `Error executing tool "${request.name}": ${getErrorMessage(executionError)}`;
              console.error(errorMsg);
              const functionResponse: Part = {
                functionResponse: {
                  id: request.callId,
                  name: request.name,
                  response: { error: errorMsg },
                },
              };
              const responseInfo: ToolCallResponseInfo = {
                callId: request.callId,
                responsePart: functionResponse,
                resultDisplay: errorMsg, // Show error in UI
                error: { name: 'ErrorExecutingTool', message: errorMsg },
              };
              // Update UI to show error *before* resubmitting
              updateFunctionResponseUI(responseInfo, ToolCallStatus.Error);
              // Resubmit the error to the model
              await submitQuery(functionResponse);
            }
          }
        }; // End of resubmittingConfirm

        return {
          ...originalConfirmationDetails,
          onConfirm: resubmittingConfirm,
        };
      } // End of wireConfirmationSubmission
    },
    // Dependencies need careful review
    [
      streamingState,
      setHistory,
      config, // Depend on the whole config object now
      getNextMessageId,
      updateGeminiMessage,
      toolRegistry,
      setDebugMessage, // Added setDebugMessage
      setInitError, // Added setInitError
    ],
  );

  return { streamingState, submitQuery, initError, debugMessage };
};
