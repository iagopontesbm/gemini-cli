/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Text, Box, useInput, useFocus } from 'ink';
import TextInput from 'ink-text-input';
import { Colors } from '../colors.js';
import {
  SuggestionsDisplay,
  MAX_SUGGESTIONS_TO_SHOW,
} from './SuggestionsDisplay.js';

interface InputPromptProps {
  onSubmit: (value: string) => void;
  query: string;
  setQuery: (value: string) => void;
  suggestions: string[];
  activeSuggestionIndex: number;
  // Allow setActiveSuggestionIndex to accept a function for safe state updates
  setActiveSuggestionIndex: (
    update: number | ((prevIndex: number) => number),
  ) => void;
  showSuggestions: boolean;
  resetCompletionState: () => void;
  resetHistoryNav: () => void;
  forceInputReset: () => void; // RESTORED prop
  isCompletionActive: boolean;
}

export const InputPrompt: React.FC<InputPromptProps> = ({
  onSubmit,
  query,
  setQuery,
  suggestions,
  activeSuggestionIndex,
  setActiveSuggestionIndex,
  showSuggestions,
  resetCompletionState,
  resetHistoryNav,
  forceInputReset, // RESTORED prop
  isCompletionActive,
}) => {
  const { isFocused } = useFocus({ autoFocus: true });
  const [triggerReset, setTriggerReset] = useState(false); // RESTORED state
  const [scrollOffset, setScrollOffset] = useState(0);

  // Reset scroll offset when suggestions are hidden or change
  useEffect(() => {
    if (!showSuggestions || suggestions.length === 0) {
      setScrollOffset(0);
    }
  }, [showSuggestions, suggestions]);

  // Adjust scroll offset when active index goes out of view
  useEffect(() => {
    if (!showSuggestions) return; // Only adjust when suggestions are visible

    if (activeSuggestionIndex < scrollOffset) {
      setScrollOffset(activeSuggestionIndex);
    } else if (
      activeSuggestionIndex >=
      scrollOffset + MAX_SUGGESTIONS_TO_SHOW
    ) {
      setScrollOffset(activeSuggestionIndex - MAX_SUGGESTIONS_TO_SHOW + 1);
    }
    // Ensure scrollOffset doesn't go negative or beyond possible limits
    setScrollOffset((currentOffset) =>
      Math.max(
        0,
        Math.min(
          currentOffset,
          Math.max(0, suggestions.length - MAX_SUGGESTIONS_TO_SHOW),
        ),
      ),
    );
  }, [
    activeSuggestionIndex,
    suggestions.length,
    showSuggestions,
    scrollOffset,
  ]);

  // Helper function to handle selecting a suggestion
  const handleCompletionSelection = (indexToUse?: number) => {
    const targetIndex = indexToUse ?? activeSuggestionIndex;
    if (targetIndex >= 0 && suggestions[targetIndex]) {
      const selectedSuggestion = suggestions[targetIndex];
      const atIndex = query.lastIndexOf('@');
      const prefix = query.substring(0, atIndex + 1); // e.g., "some text @"
      const partialPath = query.substring(atIndex + 1); // e.g., "src/ui/co"
      const lastSlashIndexInPartial = partialPath.lastIndexOf('/');

      // Get the directory path already typed after the '@'
      const basePath =
        lastSlashIndexInPartial === -1
          ? '' // No slash yet, base is empty relative to '@'
          : partialPath.substring(0, lastSlashIndexInPartial + 1); // e.g., "src/ui/"

      const completedValue = prefix + basePath + selectedSuggestion;

      setQuery(completedValue);
      // Don't delay reset anymore
      resetCompletionState();
      setTriggerReset(true); // RESTORED trigger
      return true; // Indicate selection happened
    }
    return false; // Indicate selection didn't happen
  };

  useInput(
    (input, key) => {
      // Let useInputHistory handle Up/Down if completion is NOT active
      if (!isCompletionActive && (key.upArrow || key.downArrow)) {
        return;
      }

      // Completion Logic (only when suggestions are shown and available)
      if (showSuggestions && suggestions.length > 0) {
        if (key.upArrow) {
          setActiveSuggestionIndex((prevIndex) =>
            prevIndex <= 0 ? suggestions.length - 1 : prevIndex - 1,
          );
          return;
        } else if (key.downArrow) {
          setActiveSuggestionIndex((prevIndex) =>
            prevIndex >= suggestions.length - 1 ? 0 : prevIndex + 1,
          );
          return;
        } else if (key.return) {
          // Use the currently active index for Enter
          const selectionHandled = handleCompletionSelection();
          if (selectionHandled) {
            // Force reset ONLY when completion is selected via Enter
            // setTriggerReset(true); // Already called in handleCompletionSelection
            return;
          }
          // If selection wasn't handled (e.g., no suggestion selected), fall through to default submit
        } else if (key.tab) {
          let selectionHandled = false;
          if (activeSuggestionIndex >= 0) {
            // If an item is highlighted, try selecting it (pass the index)
            selectionHandled = handleCompletionSelection(activeSuggestionIndex);
          } else if (suggestions.length > 0) {
            // If no item is highlighted, but suggestions exist, select the first one (pass index 0)
            selectionHandled = handleCompletionSelection(0);
          }

          if (selectionHandled) {
            // Force reset ONLY when completion is selected via Tab
            // setTriggerReset(true); // Already called in handleCompletionSelection
            setActiveSuggestionIndex(
              activeSuggestionIndex >= 0 ? activeSuggestionIndex : 0,
            );
            return;
          }
          // If Tab didn't select anything (e.g., no suggestions), block default behavior
          return;
        } else if (key.escape) {
          resetCompletionState();
          return;
        }
        // Allow other keys to fall through for default input handling by TextInput
      }

      // Default Enter key handling (Submit) - only if suggestions NOT shown OR Enter didn't select a suggestion
      if (key.return) {
        if (query.trim()) {
          onSubmit(query);
        }
        return;
      }

      // Reset history navigation if user types something other than navigation keys
      // (Ensure this doesn't interfere with typing while suggestions are shown)
      if (
        !showSuggestions &&
        !key.upArrow &&
        !key.downArrow &&
        !key.pageDown &&
        !key.pageUp
      ) {
        // Only reset history nav if suggestions are NOT shown and it's not a nav key
        if (input || key.backspace || key.delete) {
          // Check if it's a typing key
          resetHistoryNav();
        }
      }
    },
    { isActive: isFocused },
  );

  // RESTORED: Effect to trigger the input reset after state update
  useEffect(() => {
    if (triggerReset) {
      forceInputReset();
      setTriggerReset(false); // Reset the trigger
    }
  }, [triggerReset, forceInputReset]);

  return (
    <Box borderStyle="round" borderColor={Colors.AccentBlue} paddingX={1}>
      <Text color={Colors.AccentPurple}>&gt; </Text>
      <Box flexGrow={1} flexDirection="column">
        <TextInput
          value={query}
          onChange={setQuery}
          placeholder="Enter your message or use @ for file completion..."
          onSubmit={() => {
            // We handle Enter in useInput now
          }}
          focus={isFocused}
        />
        {showSuggestions && (
          <Box marginTop={1}>
            <SuggestionsDisplay
              suggestions={suggestions}
              activeIndex={activeSuggestionIndex}
              isLoading={false}
              width={50}
              scrollOffset={scrollOffset}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
};
