/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';
import { useInput } from 'ink';

// Props for the hook
interface UseInputHistoryProps {
  userMessages: readonly string[];
  onSubmit: (value: string) => void;
  isActive: boolean;
}

// Return type of the hook
interface UseInputHistoryReturn {
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  handleSubmit: (value: string) => void;
  inputKey: number;
  setInputKey: React.Dispatch<React.SetStateAction<number>>;
}

export function useInputHistory({
  userMessages,
  onSubmit,
  isActive,
}: UseInputHistoryProps): UseInputHistoryReturn {
  const [query, setQuery] = useState('');
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [originalQueryBeforeNav, setOriginalQueryBeforeNav] =
    useState<string>('');
  const [inputKey, setInputKey] = useState<number>(0);

  // Function to reset navigation state, called on submit or manual reset
  const resetHistoryNav = useCallback(() => {
    setHistoryIndex(-1);
    setOriginalQueryBeforeNav('');
  }, []);

  const handleSubmit = useCallback(
    (value: string) => {
      const trimmedValue = value.trim();
      if (trimmedValue) {
        onSubmit(trimmedValue);
      }
      setQuery('');
      resetHistoryNav();
    },
    [onSubmit, resetHistoryNav],
  );

  useInput(
    (input, key) => {
      // Do nothing if the hook is not active
      if (!isActive) {
        return;
      }

      let didNavigate = false;

      if (key.upArrow) {
        if (userMessages.length === 0) return;

        let nextIndex = historyIndex;
        if (historyIndex === -1) {
          // Starting navigation UP, save current input
          setOriginalQueryBeforeNav(query);
          nextIndex = 0;
        } else if (historyIndex < userMessages.length - 1) {
          // Continue navigating UP
          nextIndex = historyIndex + 1;
        } else {
          return; // Already at the oldest item
        }

        if (nextIndex !== historyIndex) {
          setHistoryIndex(nextIndex);
          // History is ordered newest to oldest, so access from the end
          const newValue = userMessages[userMessages.length - 1 - nextIndex];
          setQuery(newValue);
          setInputKey((k) => k + 1);
          didNavigate = true;
        }
      } else if (key.downArrow) {
        if (historyIndex === -1) return; // Already at the bottom

        const nextIndex = historyIndex - 1;
        setHistoryIndex(nextIndex);

        if (nextIndex === -1) {
          // Restore original query
          setQuery(originalQueryBeforeNav);
        } else {
          // Set query based on reversed index
          const newValue = userMessages[userMessages.length - 1 - nextIndex];
          setQuery(newValue);
        }
        setInputKey((k) => k + 1);
        didNavigate = true;
      } else {
        // If user types anything other than arrows while navigating, reset history navigation state
        if (historyIndex !== -1 && !didNavigate) {
          if (input || key.backspace || key.delete) {
            resetHistoryNav();
          }
        }
      }
    },
    { isActive },
  );

  return {
    query,
    setQuery,
    handleSubmit,
    inputKey,
    setInputKey,
  };
}
