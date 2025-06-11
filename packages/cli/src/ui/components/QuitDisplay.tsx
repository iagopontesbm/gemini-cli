/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import { Colors } from '../colors.js';
import { formatDuration } from '../utils/formatters.js';
import { CumulativeStats } from '../contexts/SessionContext.js';
import { FormattedStats, StatRow } from './Stats.js';

// --- Prop and Data Structures ---

interface QuitDisplayProps {
  stats: CumulativeStats;
  duration: string;
}

// --- Main Component ---

export const QuitDisplay: React.FC<QuitDisplayProps> = ({
  stats,
  duration,
}) => {
  const cumulativeFormatted: FormattedStats = {
    inputTokens: stats.promptTokenCount,
    outputTokens: stats.candidatesTokenCount,
    toolUseTokens: stats.toolUsePromptTokenCount,
    thoughtsTokens: stats.thoughtsTokenCount,
    cachedTokens: stats.cachedContentTokenCount,
    totalTokens: stats.totalTokenCount,
  };

  const cachedDisplay =
    stats.totalTokenCount > 0
      ? `${cumulativeFormatted.cachedTokens.toLocaleString()} (${((cumulativeFormatted.cachedTokens / cumulativeFormatted.totalTokens) * 100).toFixed(1)}%)`
      : cumulativeFormatted.cachedTokens.toLocaleString();

  const cachedColor =
    cumulativeFormatted.cachedTokens > 0 ? Colors.AccentGreen : undefined;

  const title = 'Agent powering down. Goodbye!';

  return (
    <Box
      borderStyle="round"
      borderColor="gray"
      flexDirection="column"
      paddingY={1}
      paddingX={2}
      alignSelf="flex-start"
    >
      <Box marginBottom={1} flexDirection="column">
        {Colors.GradientColors ? (
          <Gradient colors={Colors.GradientColors}>
            <Text bold>{title}</Text>
          </Gradient>
        ) : (
          <Text bold>{title}</Text>
        )}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text bold>{`Cumulative Stats (${stats.turnCount} Turns)`}</Text>
        <Box marginTop={1} flexDirection="column">
          <StatRow
            label="Input Tokens"
            value={cumulativeFormatted.inputTokens.toLocaleString()}
          />
          <StatRow
            label="Output Tokens"
            value={cumulativeFormatted.outputTokens.toLocaleString()}
          />
          <StatRow
            label="Tool Use Tokens"
            value={cumulativeFormatted.toolUseTokens.toLocaleString()}
          />
          <StatRow
            label="Thoughts Tokens"
            value={cumulativeFormatted.thoughtsTokens.toLocaleString()}
          />
          <StatRow
            label="Cached Tokens"
            value={cachedDisplay}
            valueColor={cachedColor}
          />
          {/* Divider Line */}
          <Box
            borderTop={true}
            borderLeft={false}
            borderRight={false}
            borderBottom={false}
            borderStyle="single"
          />
          <StatRow
            label="Total Tokens"
            value={cumulativeFormatted.totalTokens.toLocaleString()}
          />
          <Box marginTop={1} flexDirection="column">
            <StatRow
              label="Total duration (API)"
              value={formatDuration(stats.apiTimeMs)}
            />
            <StatRow label="Total duration (wall)" value={duration} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
