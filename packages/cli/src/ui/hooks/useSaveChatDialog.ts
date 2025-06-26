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
): UseSaveChatDialogReturn => {
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const onCompleteCallbackRef = useRef<(() => void) | null>(null);

  const openSaveDialog = useCallback(
    (onComplete: () => void) => {
      // Check environment variable first
      if (process.env.GEMINI_SKIP_SAVE_PROMPT) {
        onComplete();
        return;
      }

      const history = getHistory();
      const hasModelResponse = history.some((item) => item.role === 'model');

      // Only show the dialog if there is something to save
      if (!hasModelResponse) {
        onComplete();
        return;
      }

      onCompleteCallbackRef.current = onComplete;
      setIsSaveDialogOpen(true);
    },
    [getHistory],
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
