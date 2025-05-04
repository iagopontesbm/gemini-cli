/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';
import { EditorState } from '../components/InputPrompt.js';

interface UseInputHistoryProps {
  userMessages: readonly string[];
  onSubmit: (value: string) => void;
  isActive: boolean;
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  setEditorState: React.Dispatch<React.SetStateAction<EditorState>>;
}

interface UseInputHistoryReturn {
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  handleSubmit: (value: string) => void;
  navigateUp: () => boolean;
  navigateDown: () => boolean;
}

export function useInputHistory({
  userMessages,
  onSubmit,
  isActive,
  query,
  setQuery,
  setEditorState,
}: UseInputHistoryProps): UseInputHistoryReturn {
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [originalQueryBeforeNav, setOriginalQueryBeforeNav] =
    useState<string>('');

  const resetHistoryNav = useCallback(() => {
    setHistoryIndex(-1);
    setOriginalQueryBeforeNav('');
  }, []);

  const handleSubmit = useCallback(
    (value: string) => {
      const trimmedValue = value.trim();
      if (trimmedValue) {
        onSubmit(trimmedValue); // This will call handleFinalSubmit, which then calls setQuery('') from App.tsx
      }
      resetHistoryNav();
    },
    [onSubmit, resetHistoryNav],
  );

  const setQueryAndMoveCursor = useCallback(
    (value: string) => {
      setQuery(value);
      setEditorState((s) => ({
        key: s.key + 1,
        initialCursorOffset: value.length,
      }));
    },
    [setQuery, setEditorState],
  );

  const navigateUp = useCallback(() => {
    if (!isActive) return false;
    if (userMessages.length === 0) return false;

    let nextIndex = historyIndex;
    if (historyIndex === -1) {
      setOriginalQueryBeforeNav(query);
      nextIndex = 0;
    } else if (historyIndex < userMessages.length - 1) {
      nextIndex = historyIndex + 1;
    } else {
      return false;
    }
    if (nextIndex !== historyIndex) {
      setHistoryIndex(nextIndex);
      const newValue = userMessages[userMessages.length - 1 - nextIndex];
      setQueryAndMoveCursor(newValue);
      return true;
    }
    return false;
  }, [
    historyIndex,
    setHistoryIndex,
    setQueryAndMoveCursor,
    userMessages,
    isActive,
    query,
    setOriginalQueryBeforeNav,
  ]);

  const navigateDown = useCallback(() => {
    if (!isActive) return false;
    if (historyIndex === -1) return false;

    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);

    if (nextIndex === -1) {
      setQueryAndMoveCursor(originalQueryBeforeNav);
    } else {
      const newValue = userMessages[userMessages.length - 1 - nextIndex];
      setQueryAndMoveCursor(newValue);
    }
    return true;
  }, [
    historyIndex,
    setHistoryIndex,
    originalQueryBeforeNav,
    setQueryAndMoveCursor,
    userMessages,
    isActive,
  ]);

  return {
    query,
    setQuery,
    handleSubmit,
    navigateUp,
    navigateDown,
  };
}
