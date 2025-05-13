/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback } from 'react';
import { Text, Box, useInput, useFocus, Key } from 'ink';
import TextInput from 'ink-text-input';
import { Colors } from '../colors.js';
import { Suggestion } from './SuggestionsDisplay.js';

interface InputPromptProps {
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  inputKey: number;
  setInputKey: React.Dispatch<React.SetStateAction<number>>;
  onSubmit: (value: string) => void;
  showSuggestions: boolean;
  suggestions: Suggestion[];
  activeSuggestionIndex: number;
  navigateUp: () => void;
  navigateDown: () => void;
  resetCompletion: () => void;
}

export const InputPrompt: React.FC<InputPromptProps> = ({
  query,
  setQuery,
  inputKey,
  setInputKey,
  onSubmit,
  showSuggestions,
  suggestions,
  activeSuggestionIndex,
  navigateUp,
  navigateDown,
  resetCompletion,
}) => {
  const { isFocused } = useFocus({ autoFocus: true });

  const handleAutocomplete = useCallback(
    (indexToUse: number) => {
      if (indexToUse < 0 || indexToUse >= suggestions.length) {
        return;
      }
      const selectedSuggestion = suggestions[indexToUse];
      const trimmedQuery = query.trimStart();

      if (trimmedQuery.startsWith('/')) {
        // Handle / command completion
        const slashIndex = query.indexOf('/');
        const base = query.substring(0, slashIndex + 1);
        const newValue = base + selectedSuggestion.value;
        setQuery(newValue);
      } else {
        // Handle @ command completion
        const atIndex = query.lastIndexOf('@');
        if (atIndex === -1) return;

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

        const newValue = base + selectedSuggestion.value;
        setQuery(newValue);
      }

      resetCompletion(); // Hide suggestions after selection
      setInputKey((k: number) => k + 1); // Increment key to force re-render and cursor reset
    },
    [query, setQuery, suggestions, resetCompletion, setInputKey],
  );

  useInput(
    (input: string, key: Key) => {
      if (!isFocused) {
        return;
      }

      if (showSuggestions) {
        if (key.upArrow) {
          navigateUp();
        } else if (key.downArrow) {
          navigateDown();
        } else if (key.tab) {
          if (suggestions.length > 0) {
            const targetIndex =
              activeSuggestionIndex === -1 ? 0 : activeSuggestionIndex;
            if (targetIndex < suggestions.length) {
              handleAutocomplete(targetIndex);
            }
          }
        } else if (key.return) {
          // Check if suggestions are showing and an item is actively selected
          if (
            showSuggestions &&
            activeSuggestionIndex >= 0 &&
            suggestions.length > 0
          ) {
            const selectedSuggestion = suggestions[activeSuggestionIndex];
            // Determine if the context is for slash commands based on the current query.
            const currentQueryTrimmed = query.trimStart();

            if (currentQueryTrimmed.startsWith('/')) {
              // Slash command suggestion selected: execute it.
              const commandToExecute = `/${selectedSuggestion.value}`;
              onSubmit(commandToExecute);
              setQuery(''); // Clear input.
              resetCompletion(); // Hide suggestions.
              setInputKey((k: number) => k + 1); // Refresh TextInput.
            } else {
              // Other suggestion types: complete the input.
              handleAutocomplete(activeSuggestionIndex);
            }
          } else {
            const trimmedQuerySubmit = query.trim();
            if (trimmedQuerySubmit) {
              onSubmit(trimmedQuerySubmit);
              setQuery(''); // Clear input.
              resetCompletion(); // Hide suggestions.
              setInputKey((k) => k + 1); // Refresh TextInput.
            }
          }
        } else if (key.escape) {
          resetCompletion();
        }
      }
      // Enter key when suggestions are NOT showing is handled by TextInput's onSubmit prop below
    },
    { isActive: true },
  );

  return (
    <Box borderStyle="round" borderColor={Colors.AccentBlue} paddingX={1}>
      <Text color={Colors.AccentPurple}>&gt; </Text>
      <Box flexGrow={1}>
        <TextInput
          key={inputKey.toString()}
          value={query}
          onChange={setQuery}
          placeholder="Enter your message or use tools (e.g., @src/file.txt)..."
          onSubmit={() => {
            // This onSubmit is for the TextInput component itself.
            // It should only fire if suggestions are NOT showing,
            // as useInput handles Enter when suggestions are visible.
            const trimmedQuery = query.trim();
            if (!showSuggestions && trimmedQuery) {
              onSubmit(trimmedQuery);
            }
            // If suggestions ARE showing, useInput's Enter handler
            // would have already dealt with it (either completing or submitting).
          }}
        />
      </Box>
    </Box>
  );
};
