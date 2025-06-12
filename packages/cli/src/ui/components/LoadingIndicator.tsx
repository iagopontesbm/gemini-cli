/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import { Colors } from '../colors.js';
import { useStreamingContext } from '../contexts/StreamingContext.js';
import { StreamingState } from '../types.js';
import { GeminiRespondingSpinner } from './GeminiRespondingSpinner.js';

interface LoadingIndicatorProps {
  currentLoadingPhrase?: string;
  elapsedTime: number;
  rightContent?: React.ReactNode;
  thought?: string | null;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  currentLoadingPhrase,
  elapsedTime,
  rightContent,
  thought,
}) => {
  const streamingState = useStreamingContext();

  if (streamingState === StreamingState.Idle) {
    return null;
  }

  const getBoldedText = (text: string): string => {
    const match = text.match(/\*\*(.*?)\*\*/s);
    return match ? match[1].trim() : '';
  };

  const getRestOfText = (text: string): string => {
    const LENGTH_LIMIT = 80;
    const rest = text.replace(/\*\*(.*?)\*\*/s, '').trim();
    if (rest.length > LENGTH_LIMIT) {
      return rest.slice(0, LENGTH_LIMIT) + '...';
    }
    return rest;
  };

  const boldedText = thought ? getBoldedText(thought) : '';
  const restOfText = thought ? getRestOfText(thought) : '';

  const primaryText = boldedText || currentLoadingPhrase;

  return (
    <Box marginTop={1} paddingLeft={0} flexDirection="column">
      {/* Main loading line */}
      <Box>
        <Box marginRight={1}>
          <GeminiRespondingSpinner
            nonRespondingDisplay={
              streamingState === StreamingState.WaitingForConfirmation
                ? '⠏'
                : ''
            }
          />
        </Box>
        {primaryText && <Text color={Colors.AccentPurple}>{primaryText}</Text>}
        <Text color={Colors.Gray}>
          {streamingState === StreamingState.WaitingForConfirmation
            ? ''
            : ` (esc to cancel, ${elapsedTime}s)`}
        </Text>
        <Box flexGrow={1}>{/* Spacer */}</Box>
        {rightContent && <Box>{rightContent}</Box>}
      </Box>

      {/* Secondary thought line */}
      {restOfText && (
        <Box marginLeft={2}>
          <Text color={Colors.Gray}>{restOfText}</Text>
        </Box>
      )}
    </Box>
  );
};
