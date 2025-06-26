/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useRef } from 'react';
import { Logger } from '@google/gemini-cli-core';
import type { Content } from '@google/genai';

interface UseSaveChatDialogReturn {
  isSaveDialogOpen: boolean;
  openSaveDialog: (onComplete: () => void) => void;
  handleSave: () => Promise<void>;
  handleDontSave: () => void;
  handleCancel: () => void;
}

export const useSaveChatDialog = (
  sessionId: string,
  getHistory: () => Content[],
  skipSavePrompt?: boolean,
): UseSaveChatDialogReturn => {
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const onCompleteCallbackRef = useRef<(() => void) | null>(null);

  const openSaveDialog = useCallback(
    (onComplete: () => void) => {
      // Never show dialog in non-interactive mode (no TTY)
      if (!process.stdin.isTTY) {
        onComplete();
        return;
      }

      // Check CLI flag first, then environment variable
      if (skipSavePrompt || process.env.GEMINI_SKIP_SAVE_PROMPT) {
        onComplete();
        return;
      }

      const history = getHistory();

      // Debug: Log the raw history
      if (process.env.DEBUG) {
        console.log('[SaveDialog] Raw history length:', history.length);
        history.forEach((item, index) => {
          console.log(`[SaveDialog] History[${index}]:`, {
            role: item.role,
            parts: item.parts?.map((p) =>
              'text' in p ? p.text?.substring(0, 50) + '...' : p,
            ),
          });
        });
      }

      // Filter out system messages and check for real conversation
      const conversationHistory = history.filter(
        (item) => item.role === 'user' || item.role === 'model',
      );

      // Debug: Log filtered history
      if (process.env.DEBUG) {
        console.log(
          '[SaveDialog] Filtered conversation history length:',
          conversationHistory.length,
        );
      }

      // Check if this is just the initial context setup
      // The initial setup always has exactly 2 messages:
      // 1. User message with context (contains "setting up the context")
      // 2. Model response "Got it. Thanks for the context!"
      if (conversationHistory.length === 2) {
        const firstUserMsg = conversationHistory[0];
        const firstModelMsg = conversationHistory[1];

        // Check if this is the initialization pattern
        const isInitMessage =
          firstUserMsg.role === 'user' &&
          firstUserMsg.parts?.some(
            (part) =>
              'text' in part && part.text?.includes('setting up the context'),
          ) &&
          firstModelMsg.role === 'model' &&
          firstModelMsg.parts?.some(
            (part) =>
              'text' in part &&
              part.text?.includes('Got it. Thanks for the context!'),
          );

        if (isInitMessage) {
          // This is just the initial setup, no real conversation
          onComplete();
          return;
        }
      }

      // If there's no conversation at all, don't show dialog
      if (conversationHistory.length === 0) {
        onComplete();
        return;
      }

      // Check if there was meaningful interaction with the model
      // Skip the first user message if it's the context setup
      const meaningfulHistory = conversationHistory.filter((item, index) => {
        if (index === 0 && item.role === 'user') {
          // Check if this is the context setup message
          const isContextSetup = item.parts?.some(
            (part) =>
              'text' in part && part.text?.includes('setting up the context'),
          );
          return !isContextSetup;
        }
        return true;
      });

      const hasUserMessages = meaningfulHistory.some((item) => {
        if (item.role !== 'user') return false;

        // Check if the user message has meaningful content
        const textContent = item.parts?.find((part) => 'text' in part)?.text;
        if (!textContent) return false;

        // Filter out slash commands and empty messages
        const trimmedText = textContent.trim();
        return trimmedText.length > 0 && !trimmedText.startsWith('/');
      });

      // Check for model responses beyond the initial acknowledgment
      const hasModelResponse = meaningfulHistory.some((item, index) => {
        if (item.role !== 'model') return false;

        // Skip the first model response if it's the context acknowledgment
        if (index === 1 && conversationHistory.length >= 2) {
          const isAckResponse = item.parts?.some(
            (part) =>
              'text' in part &&
              part.text?.includes('Got it. Thanks for the context!'),
          );
          return !isAckResponse;
        }

        return true;
      });

      // Debug: Log detection results
      if (process.env.DEBUG) {
        console.log(
          '[SaveDialog] Has meaningful user messages:',
          hasUserMessages,
        );
        console.log('[SaveDialog] Has model response:', hasModelResponse);
      }

      // Only show the dialog if there was actual conversation
      if (!hasUserMessages || !hasModelResponse) {
        onComplete();
        return;
      }

      onCompleteCallbackRef.current = onComplete;
      setIsSaveDialogOpen(true);
    },
    [getHistory, skipSavePrompt],
  );

  const handleSave = useCallback(async () => {
    try {
      const logger = new Logger(sessionId);
      await logger.initialize();
      const history = getHistory();

      if (history.length > 0) {
        await logger.saveCheckpoint(history, 'exit-save');
      }
    } catch (error) {
      // It's better to log the error to the debug console if available,
      // but for now, console.error is sufficient.
      console.error('Failed to save chat:', error);
    } finally {
      setIsSaveDialogOpen(false);
      if (onCompleteCallbackRef.current) {
        onCompleteCallbackRef.current();
        onCompleteCallbackRef.current = null;
      }
    }
  }, [sessionId, getHistory]);

  const handleDontSave = useCallback(() => {
    setIsSaveDialogOpen(false);
    if (onCompleteCallbackRef.current) {
      onCompleteCallbackRef.current();
      onCompleteCallbackRef.current = null;
    }
  }, []);

  const handleCancel = useCallback(() => {
    setIsSaveDialogOpen(false);
    onCompleteCallbackRef.current = null;
  }, []);

  return {
    isSaveDialogOpen,
    openSaveDialog,
    handleSave,
    handleDontSave,
    handleCancel,
  };
};
