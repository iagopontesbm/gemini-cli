import { useInput } from 'ink';
import type { Key } from 'ink';
import type React from 'react';

interface UseInputNavigationProps {
  isInputActive: boolean;
  isWaitingForToolConfirmation: boolean;
  userMessages: string[];
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  historyIndex: number;
  setHistoryIndex: React.Dispatch<React.SetStateAction<number>>;
  originalQueryBeforeNav: string;
  setOriginalQueryBeforeNav: React.Dispatch<React.SetStateAction<string>>;
}

export function useInputNavigation({
  isInputActive,
  isWaitingForToolConfirmation,
  userMessages,
  query,
  setQuery,
  historyIndex,
  setHistoryIndex,
  originalQueryBeforeNav,
  setOriginalQueryBeforeNav,
}: UseInputNavigationProps) {
  useInput(
    (input: string, key: Key) => {
      if (!isInputActive || isWaitingForToolConfirmation) {
        return;
      }

      if (key.upArrow) {
        if (userMessages.length === 0) return;
        if (historyIndex === -1) {
          // Store the current input only when starting navigation
          setOriginalQueryBeforeNav(query);
        }
        const nextIndex = Math.min(historyIndex + 1, userMessages.length - 1);
        if (nextIndex !== historyIndex) {
          setHistoryIndex(nextIndex);
          setQuery(userMessages[userMessages.length - 1 - nextIndex]);
        }
      } else if (key.downArrow) {
        if (historyIndex < 0) return; // Already at the bottom or not navigating
        const nextIndex = Math.max(historyIndex - 1, -1);
        setHistoryIndex(nextIndex);
        if (nextIndex === -1) {
          // Restore the original query when navigating back past the start
          setQuery(originalQueryBeforeNav);
        } else {
          setQuery(userMessages[userMessages.length - 1 - nextIndex]);
        }
      } else {
        // Any other key press while navigating resets the history index
        if (
          historyIndex !== -1 &&
          (input ||
            key.backspace ||
            key.delete ||
            key.leftArrow ||
            key.rightArrow)
        ) {
          setHistoryIndex(-1);
          setOriginalQueryBeforeNav(''); // Clear the stored query
        }
      }
    },
    { isActive: isInputActive }, // Ensure the hook is active only when input is expected
  );
}
