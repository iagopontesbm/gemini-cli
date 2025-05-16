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
  ServerGeminiStreamEvent as GeminiEvent,
  ServerGeminiContentEvent as ContentEvent,
  ServerGeminiToolCallRequestEvent as ToolCallRequestEvent,
  ServerGeminiToolCallResponseEvent as ToolCallResponseEvent,
  ServerGeminiToolCallConfirmationEvent as ToolCallConfirmationEvent,
  ServerGeminiErrorEvent as ErrorEvent,
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
  MessageType,
  HistoryItem,
  HistoryItemGemini,
  HistoryItemGeminiContent,
} from '../types.js';
import { isAtCommand } from '../utils/commandUtils.js';
import { useShellCommandProcessor } from './shellCommandProcessor.js';
import { handleAtCommand } from './atCommandProcessor.js';
import { findLastSafeSplitPoint } from '../utils/markdownUtilities.js';
import { UseHistoryManagerReturn } from './useHistoryManager.js';

enum StreamProcessingStatus {
  Completed,
  PausedForConfirmation,
  UserCancelled,
  Error,
}

/**
 * Hook to manage the Gemini stream, handle user input, process commands,
 * and interact with the Gemini API and history manager.
 */
export const useGeminiStream = (
  historyManager: UseHistoryManagerReturn,
  refreshStatic: () => void,
  setShowHelp: React.Dispatch<React.SetStateAction<boolean>>,
  config: Config,
  onDebugMessage: (message: string) => void,
  handleSlashCommand: (cmd: PartListUnion) => boolean,
) => {
  const { addItem, setPendingItem, commitPendingItem, pendingItem } =
    historyManager;
  const toolRegistry = config.getToolRegistry();
  const [initError, setInitError] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController>(
    new AbortController(),
  );
  const chatSessionRef = useRef<Chat | null>(null);
  const geminiClientRef = useRef<GeminiClient | null>(null);
  const [isResponding, setIsResponding] = useState<boolean>(false);

  const onExec = useCallback(async (done: Promise<void>) => {
    setIsResponding(true);
    await done;
    setIsResponding(false);
  }, []);
  const { handleShellCommand } = useShellCommandProcessor(
    addItem,
    onExec,
    onDebugMessage,
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

  useEffect(() => {
    if (pendingItem?.type === 'tool_group' && !ongoingToolCalls(pendingItem)) {
      commitPendingItem();
    }
  }, [pendingItem, commitPendingItem]);

  useInput((_input, key) => {
    if (key.escape) {
      abortController.abort('User Cancelled with ESC');
      setAbortController(new AbortController());
    }
  });

  const prepareQueryForGemini = async (
    query: PartListUnion,
    userMessageTimestamp: number,
    signal: AbortSignal,
  ): Promise<{ queryToSend: PartListUnion | null; shouldProceed: boolean }> => {
    if (typeof query === 'string' && query.trim().length === 0) {
      return { queryToSend: null, shouldProceed: false };
    }

    let localQueryToSendToGemini: PartListUnion | null = null;

    if (typeof query === 'string') {
      const trimmedQuery = query.trim();
      onDebugMessage(`User query: '${trimmedQuery}'`);

      // Handle UI-only commands first
      if (handleSlashCommand(trimmedQuery)) {
        return { queryToSend: null, shouldProceed: false };
      }
      if (handleShellCommand(trimmedQuery)) {
        return { queryToSend: null, shouldProceed: false };
      }

      // Handle @-commands (which might involve tool calls)
      if (isAtCommand(trimmedQuery)) {
        const atCommandResult = await handleAtCommand({
          query: trimmedQuery,
          config,
          addItem,
          onDebugMessage,
          messageId: userMessageTimestamp,
          signal,
        });
        if (!atCommandResult.shouldProceed) {
          return { queryToSend: null, shouldProceed: false };
        }
        localQueryToSendToGemini = atCommandResult.processedQuery;
      } else {
        // Normal query for Gemini
        addItem(
          { type: MessageType.USER, text: trimmedQuery },
          userMessageTimestamp,
        );
        localQueryToSendToGemini = trimmedQuery;
      }
    } else {
      // It's a function response (PartListUnion that isn't a string)
      localQueryToSendToGemini = query;
    }

    if (localQueryToSendToGemini === null) {
      onDebugMessage(
        'Query processing resulted in null, not sending to Gemini.',
      );
      return { queryToSend: null, shouldProceed: false };
    }
    return { queryToSend: localQueryToSendToGemini, shouldProceed: true };
  };

  const ensureChatSession = async (): Promise<{
    client: GeminiClient | null;
    chat: Chat | null;
  }> => {
    const currentClient = geminiClientRef.current;
    if (!currentClient) {
      const errorMsg = 'Gemini client is not available.';
      setInitError(errorMsg);
      addItem({ type: MessageType.ERROR, text: errorMsg }, Date.now());
      return { client: null, chat: null };
    }

    if (!chatSessionRef.current) {
      try {
        chatSessionRef.current = await currentClient.startChat();
      } catch (err: unknown) {
        const errorMsg = `Failed to start chat: ${getErrorMessage(err)}`;
        setInitError(errorMsg);
        addItem({ type: MessageType.ERROR, text: errorMsg }, Date.now());
        return { client: currentClient, chat: null };
      }
    }
    return { client: currentClient, chat: chatSessionRef.current };
  };

  // --- UI Helper Functions (used by event handlers) ---
  const updateFunctionResponseUI = (
    toolResponse: ToolCallResponseInfo,
    status: ToolCallStatus,
  ) => {
    setPendingItem((item) =>
      item?.type === 'tool_group'
        ? {
            ...item,
            tools: item.tools.map((tool) =>
              tool.callId === toolResponse.callId
                ? {
                    ...tool,
                    status,
                    resultDisplay: toolResponse.resultDisplay,
                  }
                : tool,
            ),
          }
        : item,
    );
  };

  const updateConfirmingFunctionStatusUI = (
    callId: string,
    confirmationDetails: ToolCallConfirmationDetails | undefined,
  ) => {
    setPendingItem((item) =>
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
        : item,
    );
  };

  const wireConfirmationSubmission = (
    confirmationDetails: ServerToolCallConfirmationDetails,
  ): ToolCallConfirmationDetails => {
    const originalConfirmationDetails = confirmationDetails.details;
    const request = confirmationDetails.request;
    const resubmittingConfirm = async (outcome: ToolConfirmationOutcome) => {
      originalConfirmationDetails.onConfirm(outcome);
      if (outcome === ToolConfirmationOutcome.Cancel) {
        declineToolExecution(
          'User rejected function call.',
          ToolCallStatus.Error,
          request,
          originalConfirmationDetails,
        );
        return;
      }
      setPendingItem((item) =>
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
      const tool = toolRegistry.getTool(request.name);
      if (!tool) {
        throw new Error(
          `Tool "${request.name}" not found or is not registered.`,
        );
      }
      try {
        // assign to const so we don't lose it if user cancels while tool is executing
        const signal = abortController.signal;
        const result = await tool.execute(request.args, signal);
        if (signal.aborted) {
          declineToolExecution(
            result.llmContent,
            ToolCallStatus.Canceled,
            request,
            originalConfirmationDetails,
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
        if (pendingItem) {
          commitPendingItem();
        }
        setIsResponding(false);
        await submitQuery(functionResponse); // Recursive call
      } catch (e) {
        addItem(
          { type: MessageType.ERROR, text: `[Confirmation Error: ${e}]` },
          Date.now(),
        );
      }
    };
    // Extracted declineToolExecution to be part of wireConfirmationSubmission's closure
    // or could be a standalone helper if more params are passed.
    function declineToolExecution(
      declineMessage: string,
      status: ToolCallStatus,
      request: ServerToolCallConfirmationDetails['request'],
      originalDetails: ServerToolCallConfirmationDetails['details'],
    ) {
      let resultDisplay: ToolResultDisplay | undefined;
      if ('fileDiff' in originalDetails) {
        resultDisplay = {
          fileDiff: (originalDetails as ToolEditConfirmationDetails).fileDiff,
        };
      } else {
        resultDisplay = `~~${(originalDetails as ToolExecuteConfirmationDetails).command}~~`;
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
        history.push({ role: 'model', parts: [functionResponse] });
      }
      updateFunctionResponseUI(responseInfo, status);
      if (pendingItem) {
        commitPendingItem();
      }
      setIsResponding(false);
    }

    return { ...originalConfirmationDetails, onConfirm: resubmittingConfirm };
  };

  // --- Stream Event Handlers ---
  const handleContentEvent = (
    eventValue: ContentEvent['value'],
    currentGeminiMessageBuffer: string, // Retained for now, though its role might diminish
  ): string => {
    let newGeminiMessageBuffer = currentGeminiMessageBuffer + eventValue;

    if (
      pendingItem?.type !== 'gemini' &&
      pendingItem?.type !== 'gemini_content'
    ) {
      if (pendingItem) {
        commitPendingItem();
      }
      const nextPendingItem: HistoryItemGemini = {
        type: 'gemini',
        text: eventValue,
      };
      setPendingItem(nextPendingItem);
      newGeminiMessageBuffer = eventValue; // Buffer reset to current event value
    } else {
      // Accumulate into existing gemini/gemini_content pending item, or update if just created by above block
      // The newGeminiMessageBuffer from the start of function already has (old buffer + eventValue)
      // If pendingItem was null and created above, its text is eventValue, newGeminiMessageBuffer is also eventValue.
      // If pendingItem existed, its text is old, newGeminiMessageBuffer is (pendingItem.text + eventValue) if buffer was pendingItem.text
      // This part is tricky due to currentGeminiMessageBuffer. Assuming it reflects pendingItem.text or is managed correctly outside.
      // For safety, let's ensure pendingItem.text is updated with the full newGeminiMessageBuffer before splitting.
      setPendingItem((prevPending) => {
        if (
          !prevPending ||
          (prevPending.type !== 'gemini' &&
            prevPending.type !== 'gemini_content')
        ) {
          return prevPending;
        }
        return { ...prevPending, text: newGeminiMessageBuffer };
      });
    }

    const splitPoint = findLastSafeSplitPoint(newGeminiMessageBuffer);
    if (splitPoint === newGeminiMessageBuffer.length) {
      // No split needed. Content is already in pendingItem from the setPendingItem call above.
      // Ensure it reflects newGeminiMessageBuffer if it wasn't the one setting it.
      setPendingItem((prevPending) => {
        if (!prevPending) return undefined;
        return {
          ...prevPending,
          type:
            prevPending.type === 'gemini_content' ? 'gemini_content' : 'gemini',
          text: newGeminiMessageBuffer,
        };
      });
    } else {
      const beforeText = newGeminiMessageBuffer.substring(0, splitPoint);
      const afterText = newGeminiMessageBuffer.substring(splitPoint);

      setPendingItem((prevPending) => {
        if (
          !prevPending ||
          (prevPending.type !== 'gemini' &&
            prevPending.type !== 'gemini_content')
        ) {
          return prevPending;
        }
        return { ...prevPending, text: beforeText };
      });
      commitPendingItem();

      const nextPendingItem: HistoryItemGeminiContent = {
        type: 'gemini_content',
        text: afterText,
      };
      setPendingItem(nextPendingItem);
      newGeminiMessageBuffer = afterText;
    }
    return newGeminiMessageBuffer;
  };

  const handleToolCallRequestEvent = (
    eventValue: ToolCallRequestEvent['value'],
  ) => {
    const { callId, name, args } = eventValue;
    const cliTool = toolRegistry.getTool(name);
    if (!cliTool) {
      console.error(`CLI Tool "${name}" not found!`);
      return;
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

    commitPendingItem();
    setPendingItem((currentPendingItem) => {
      if (currentPendingItem?.type === 'tool_group') {
        return {
          ...currentPendingItem,
          tools: [...currentPendingItem.tools, toolCallDisplay],
        };
      }
      return {
        id: -1,
        type: 'tool_group',
        tools: [toolCallDisplay],
      };
    });
  };

  const handleToolCallResponseEvent = (
    eventValue: ToolCallResponseEvent['value'],
  ) => {
    const status = eventValue.error
      ? ToolCallStatus.Error
      : ToolCallStatus.Success;
    updateFunctionResponseUI(eventValue, status);
  };

  const handleToolCallConfirmationEvent = (
    eventValue: ToolCallConfirmationEvent['value'],
  ) => {
    const confirmationDetails = wireConfirmationSubmission(eventValue);
    updateConfirmingFunctionStatusUI(
      eventValue.request.callId,
      confirmationDetails,
    );
  };

  const handleUserCancelledEvent = (userMessageTimestamp: number) => {
    if (pendingItem) {
      if (pendingItem.type === 'tool_group') {
        setPendingItem((currentPI) => {
          if (!currentPI || currentPI.type !== 'tool_group') return currentPI;
          const updatedTools = currentPI.tools.map(
            (tool: IndividualToolCallDisplay) =>
              tool.status === ToolCallStatus.Pending ||
              tool.status === ToolCallStatus.Confirming ||
              tool.status === ToolCallStatus.Executing
                ? { ...tool, status: ToolCallStatus.Canceled }
                : tool,
          );
          return { ...currentPI, tools: updatedTools };
        });
      }
      commitPendingItem();
    }
    addItem(
      { type: MessageType.INFO, text: 'User cancelled the request.' },
      userMessageTimestamp,
    );
    setIsResponding(false);
  };

  const handleErrorEvent = (
    eventValue: ErrorEvent['value'],
    userMessageTimestamp: number,
  ) => {
    if (pendingItem) {
      commitPendingItem();
    }
    addItem(
      { type: MessageType.ERROR, text: `[API Error: ${eventValue.message}]` },
      userMessageTimestamp,
    );
  };

  const processGeminiStreamEvents = async (
    stream: AsyncIterable<GeminiEvent>,
    userMessageTimestamp: number,
  ): Promise<StreamProcessingStatus> => {
    let geminiMessageBuffer = '';

    let awaitingConfirmation = false;
    for await (const event of stream) {
      if (event.type === ServerGeminiEventType.Content) {
        geminiMessageBuffer = handleContentEvent(
          event.value,
          geminiMessageBuffer,
        );
      } else if (event.type === ServerGeminiEventType.ToolCallRequest) {
        handleToolCallRequestEvent(event.value);
      } else if (event.type === ServerGeminiEventType.ToolCallResponse) {
        handleToolCallResponseEvent(event.value);
      } else if (event.type === ServerGeminiEventType.ToolCallConfirmation) {
        handleToolCallConfirmationEvent(event.value);
        awaitingConfirmation = true;
      } else if (event.type === ServerGeminiEventType.UserCancelled) {
        handleUserCancelledEvent(userMessageTimestamp);
        return StreamProcessingStatus.UserCancelled;
      } else if (event.type === ServerGeminiEventType.Error) {
        handleErrorEvent(event.value, userMessageTimestamp);
        return StreamProcessingStatus.Error;
      }
    }
    return awaitingConfirmation
      ? StreamProcessingStatus.PausedForConfirmation
      : StreamProcessingStatus.Completed;
  };

  const submitQuery = useCallback(
    async (query: PartListUnion) => {
      if (isResponding) return;

      const userMessageTimestamp = Date.now();
      setShowHelp(false);

      const signal = abortController.signal;

      const { queryToSend, shouldProceed } = await prepareQueryForGemini(
        query,
        userMessageTimestamp,
        signal,
      );

      if (!shouldProceed || queryToSend === null) {
        return;
      }

      const { client, chat } = await ensureChatSession();

      if (!client || !chat) {
        return;
      }

      setIsResponding(true);
      setInitError(null);

      try {
        const stream = client.sendMessageStream(chat, queryToSend, signal);
        const processingStatus = await processGeminiStreamEvents(
          stream,
          userMessageTimestamp,
        );

        if (
          processingStatus === StreamProcessingStatus.PausedForConfirmation ||
          processingStatus === StreamProcessingStatus.UserCancelled
        ) {
          return;
        }

        if (pendingItem) {
          commitPendingItem();
        }
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
      } finally {
        setIsResponding(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isResponding,
      setShowHelp,
      handleSlashCommand,
      handleShellCommand,
      config,
      addItem,
      onDebugMessage,
      refreshStatic,
      setInitError,
      abortController,
    ],
  );

  const streamingState: StreamingState = isResponding
    ? StreamingState.Responding
    : pendingConfirmations(pendingItem)
      ? StreamingState.WaitingForConfirmation
      : StreamingState.Idle;

  return {
    streamingState,
    submitQuery,
    initError,
  };
};

const pendingConfirmations = (item?: HistoryItem): boolean =>
  item?.type === 'tool_group' &&
  item.tools.some((t) => t.status === ToolCallStatus.Confirming);

const ongoingToolCalls = (item?: HistoryItem): boolean =>
  item?.type === 'tool_group' &&
  !!item?.tools.length &&
  item.tools.some(
    (t) =>
      t.status === ToolCallStatus.Confirming ||
      t.status === ToolCallStatus.Executing ||
      t.status === ToolCallStatus.Pending,
  );
