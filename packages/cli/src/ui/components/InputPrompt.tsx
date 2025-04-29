/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback } from 'react'; // Import useCallback
import { Text, Box, useInput, useFocus, Key } from 'ink'; // Import Key
import TextInput from 'ink-text-input';
import { Colors } from '../colors.js';

interface InputPromptProps {
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  inputKey: number; // Key to force TextInput reset on history navigation
  setInputKey: React.Dispatch<React.SetStateAction<number>>; // Setter for the key
  onSubmit: (value: string) => void;
  // Completion props
  showSuggestions: boolean;
  suggestions: string[];
  activeSuggestionIndex: number;
  navigateUp: () => void;
  navigateDown: () => void;
  resetCompletion: () => void;
}

export const InputPrompt: React.FC<InputPromptProps> = ({
  query,
  setQuery,
  inputKey,
  setInputKey, // Destructure setInputKey
  onSubmit,
  showSuggestions,
  suggestions,
  activeSuggestionIndex,
  navigateUp,
  navigateDown,
  resetCompletion,
}) => {
  const { isFocused } = useFocus({ autoFocus: true });

  const handleAutocomplete = useCallback(() => {
    if (activeSuggestionIndex < 0 || activeSuggestionIndex >= suggestions.length) {
      return;
    }
    const selectedSuggestion = suggestions[activeSuggestionIndex];
    const atIndex = query.lastIndexOf('@');
    if (atIndex === -1) return; // Should not happen if suggestions are shown

    // Find the part of the query after the '@'
    const pathPart = query.substring(atIndex + 1);
    // Find the last slash within that part
    const lastSlashIndexInPath = pathPart.lastIndexOf('/');

    let base = '';
    if (lastSlashIndexInPath === -1) {
      // No slash after '@', replace everything after '@'
      base = query.substring(0, atIndex + 1);
    } else {
      // Slash found, keep everything up to and including the last slash
      base = query.substring(0, atIndex + 1 + lastSlashIndexInPath + 1);
    }

    const newValue = base + selectedSuggestion;
    setQuery(newValue);
    resetCompletion(); // Hide suggestions after selection
    setInputKey((k) => k + 1); // Increment key to force re-render and cursor reset
  }, [
    query,
    setQuery,
    suggestions,
    activeSuggestionIndex,
    resetCompletion,
    setInputKey, // Add dependency
  ]);

  useInput(
    (input: string, key: Key) => { // Add types for input and key
      let handled = false;

      if (showSuggestions) {
        if (key.upArrow) {
          navigateUp();
          handled = true;
        } else if (key.downArrow) {
          navigateDown();
          handled = true;
        // Handle Tab OR Enter when a suggestion is active
        } else if ((key.tab || key.return) && activeSuggestionIndex >= 0) {
          handleAutocomplete();
          handled = true;
        } else if (key.escape) {
          resetCompletion();
          handled = true;
        }
      }

      // Only submit on Enter if it wasn't handled above (i.e., wasn't used for autocomplete)
      if (!handled && key.return) {
        if (query.trim()) {
          onSubmit(query);
          // Query clearing is handled by useInputHistory's handleSubmit wrapper
        }
        handled = true; // Mark as handled even if query was empty
      }

      // Prevent default behavior for handled keys when suggestions are active
      // (This comment remains, the logic implicitly handles it by setting `handled`)
      if (handled && showSuggestions && (key.upArrow || key.downArrow || key.tab || key.escape || key.return)) {
        // No explicit preventDefault needed, handled flag stops further processing
      }

    },
    { isActive: isFocused },
  );

  return (
    <Box borderStyle="round" borderColor={Colors.AccentBlue} paddingX={1}>
      <Text color={Colors.AccentPurple}>&gt; </Text>
      <Box flexGrow={1}>
        <TextInput
          key={inputKey.toString()} // Use key to force re-render on history nav
          value={query}
          onChange={setQuery}
          placeholder="Enter your message or use tools (e.g., @src/file.txt)..."
          onSubmit={() => {
            /* onSubmit is handled by useInput hook above */
          }}
        />
      </Box>
    </Box>
  );
};
