/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';

interface SuggestionsDisplayProps {
  suggestions: string[];
  activeIndex: number;
  isLoading: boolean;
  width: number;
}

const MAX_SUGGESTIONS_TO_SHOW = 8;

export function SuggestionsDisplay({
  suggestions,
  activeIndex,
  isLoading,
  width,
}: SuggestionsDisplayProps) {
  if (isLoading) {
    return (
      <Box borderStyle="round" paddingX={1} width={width}>
        <Text color="gray">Loading suggestions...</Text>
      </Box>
    );
  }

  if (suggestions.length === 0) {
    return null; // Don't render anything if there are no suggestions
  }

  // Limit the number of suggestions shown
  const visibleSuggestions = suggestions.slice(0, MAX_SUGGESTIONS_TO_SHOW);

  return (
    <Box
      borderStyle="round"
      flexDirection="column"
      paddingX={1}
      width={width} // Use the passed width
    >
      {visibleSuggestions.map((suggestion, index) => (
        <Text
          key={suggestion}
          color={index === activeIndex ? 'black' : 'white'}
          backgroundColor={index === activeIndex ? 'blue' : undefined}
        >
          {suggestion}
        </Text>
      ))}
      {suggestions.length > MAX_SUGGESTIONS_TO_SHOW && (
        <Text color="gray">
          ... ({suggestions.length - MAX_SUGGESTIONS_TO_SHOW} more)
        </Text>
      )}
    </Box>
  );
}
