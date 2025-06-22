/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import { Colors } from '../colors.js';
import { formatDuration } from '../utils/formatters.js';
import { CumulativeStats } from '../contexts/SessionContext.js';
import { FormattedStats, StatRow, StatsColumn } from './Stats.js';
import { AuthType } from '@gemini-cli/core';
import { shouldShowCachedTokens } from '../utils/authUtils.js';

// --- Constants ---

const COLUMN_WIDTH = '48%';

// --- Prop and Data Structures ---

interface StatsDisplayProps {
  stats: CumulativeStats;
  lastTurnStats: CumulativeStats;
  duration: string;
  authType?: AuthType;
}

// --- Main Component ---

export const StatsDisplay: React.FC<StatsDisplayProps> = ({
  stats,
  lastTurnStats,
  duration,
  authType,
}) => {
  const showCached = shouldShowCachedTokens(authType);

  const lastTurnFormatted: FormattedStats = {
    inputTokens: lastTurnStats.promptTokenCount,
    outputTokens: lastTurnStats.candidatesTokenCount,
    toolUseTokens: lastTurnStats.toolUsePromptTokenCount,
    thoughtsTokens: lastTurnStats.thoughtsTokenCount,
    cachedTokens: lastTurnStats.cachedContentTokenCount,
    totalTokens: lastTurnStats.totalTokenCount,
  };

  const cumulativeFormatted: FormattedStats = {
    inputTokens: stats.promptTokenCount,
    outputTokens: stats.candidatesTokenCount,
    toolUseTokens: stats.toolUsePromptTokenCount,
    thoughtsTokens: stats.thoughtsTokenCount,
    cachedTokens: stats.cachedContentTokenCount,
    totalTokens: stats.totalTokenCount,
  };

  return (
    <Box
      borderStyle="round"
      borderColor="gray"
      flexDirection="column"
      paddingY={1}
      paddingX={2}
    >
      <Text bold color={Colors.AccentPurple}>
        Stats
      </Text>

      <Box flexDirection="row" justifyContent="space-between" marginTop={1}>
        <StatsColumn
          title="Last Turn"
          stats={lastTurnFormatted}
          width={COLUMN_WIDTH}
          showCachedTokens={showCached}
        />
        <StatsColumn
          title={`Cumulative (${stats.turnCount} Turns)`}
          stats={cumulativeFormatted}
          isCumulative={true}
          width={COLUMN_WIDTH}
          showCachedTokens={showCached}
        />
      </Box>

      <Box flexDirection="row" justifyContent="space-between" marginTop={1}>
        {/* Left column for "Last Turn" duration */}
        <Box width={COLUMN_WIDTH} flexDirection="column">
          <StatRow
            label="Turn Duration (API)"
            value={formatDuration(lastTurnStats.apiTimeMs)}
          />
        </Box>

        {/* Right column for "Cumulative" durations */}
        <Box width={COLUMN_WIDTH} flexDirection="column">
          <StatRow
            label="Total duration (API)"
            value={formatDuration(stats.apiTimeMs)}
          />
          <StatRow label="Total duration (wall)" value={duration} />
        </Box>
      </Box>
    </Box>
  );
};
