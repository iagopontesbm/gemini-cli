/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback } from 'react';
import { Text, Box, Key } from 'ink';
import { Colors } from '../colors.js';
import { Suggestion } from './SuggestionsDisplay.js';
import { MultilineTextEditor } from './shared/multiline-editor.js';

interface InputPromptProps {
  query: string;
  onChange: (value: string) => void;
  onChangeAndMoveCursor: (value: string) => void;
  editorState: EditorState;
  onSubmit: (value: string) => void;
  showSuggestions: boolean;
  suggestions: Suggestion[];
  activeSuggestionIndex: number;
  resetCompletion: () => void;
  navigateHistoryUp: () => void;
  navigateHistoryDown: () => void;
  navigateSuggestionUp: () => void;
  navigateSuggestionDown: () => void;
}

export interface EditorState {
  key: number;
  initialCursorOffset?: number;
}

export const InputPrompt: React.FC<InputPromptProps> = ({
  query,
  onChange,
  onChangeAndMoveCursor,
  editorState,
  onSubmit,
  showSuggestions,
  suggestions,
  activeSuggestionIndex,
  navigateHistoryUp,
  navigateHistoryDown,
  navigateSuggestionUp,
  navigateSuggestionDown,
  resetCompletion,
}) => {
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
        onChangeAndMoveCursor(newValue);
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
        onChangeAndMoveCursor(newValue);
      }

      resetCompletion(); // Hide suggestions after selection
      setInputKey((k: number) => k + 1); // Increment key to force re-render and cursor reset
    },
    [query, suggestions, resetCompletion, onChangeAndMoveCursor],
  );

  const inputPreprocessor = useCallback(
    (input: string, key: Key) => {
      if (showSuggestions) {
        if (key.upArrow) {
          navigateSuggestionUp();
          return true;
        } else if (key.downArrow) {
          navigateSuggestionDown();
          return true;
        } else if (key.tab) {
          if (suggestions.length > 0) {
            const targetIndex =
              activeSuggestionIndex === -1 ? 0 : activeSuggestionIndex;
            if (targetIndex < suggestions.length) {
              handleAutocomplete(targetIndex);
              return true;
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
          return true;
        } else if (key.escape) {
          resetCompletion();
          return true;
        }
      }
      return false;
    },
    [
      handleAutocomplete,
      navigateSuggestionDown,
      navigateSuggestionUp,
      query,
      suggestions,
      showSuggestions,
      resetCompletion,
      activeSuggestionIndex,
      onSubmit,
    ],
  );

  return (
    <Box borderStyle="round" borderColor={Colors.AccentBlue} paddingX={1}>
      <Text color={Colors.AccentPurple}>&gt; </Text>
      <Box flexGrow={1}>
        <MultilineTextEditor
          key={editorState.key.toString()}
          initialCursorOffset={editorState.initialCursorOffset}
          initialText={query}
          onChange={onChange}
          placeholder="Enter your message or use tools (e.g., @src/file.txt)..."
          /* Account for width used by the box and &gt; */
          navigateUp={navigateHistoryUp}
          navigateDown={navigateHistoryDown}
          inputPreprocessor={inputPreprocessor}
          widthUsedByParent={3}
          widthFraction={0.9}
          onSubmit={() => {
            // This onSubmit is for the TextInput component itself.
            // It should only fire if suggestions are NOT showing,
            // as inputPreprocessor handles Enter when suggestions are visible.
            const trimmedQuery = query.trim();
            if (!showSuggestions && trimmedQuery) {
              onSubmit(trimmedQuery);
            }
          }}
        />
      </Box>
    </Box>
  );
};
