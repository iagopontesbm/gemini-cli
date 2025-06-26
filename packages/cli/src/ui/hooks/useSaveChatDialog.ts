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

      // Check if there was meaningful interaction with the model
      const hasUserMessages = history.some((item) => {
        if (item.role !== 'user') return false;

        // Check if the user message has meaningful content
        const textContent = item.parts?.find((part) => 'text' in part)?.text;
        if (!textContent) return false;

        // Filter out slash commands and empty messages
        const trimmedText = textContent.trim();
        return trimmedText.length > 0 && !trimmedText.startsWith('/');
      });

      const hasModelResponse = history.some((item) => item.role === 'model');

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
