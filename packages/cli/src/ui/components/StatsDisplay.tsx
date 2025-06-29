/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import { Colors } from '../colors.js';
import { formatDuration } from '../utils/formatters.js';
import { useSessionStats, ModelMetrics } from '../contexts/SessionContext.js';
import { computeSessionStats } from '../utils/computeStats.js';

// Helper function to determine status color based on thresholds
const getStatusColor = (
  value: number,
  thresholds: { green: number; yellow: number },
  // Adding an optional third tier for metrics that don't have a "Red" state
  options: { defaultColor?: string } = {},
) => {
  if (value >= thresholds.green) {
    return Colors.AccentGreen;
  }
  if (value >= thresholds.yellow) {
    return Colors.AccentYellow;
  }
  // Fallback to a neutral default color or an error color (Red)
  return options.defaultColor || Colors.AccentRed;
};

// A more flexible and powerful StatRow component
interface StatRowProps {
  title: string;
  children: React.ReactNode; // Use children to allow for complex, colored values
}

const StatRow: React.FC<StatRowProps> = ({ title, children }) => (
  <Box>
    {/* Fixed width for the label creates a clean "gutter" for alignment */}
    <Box width={28}>
      <Text color={Colors.LightBlue}>{title}</Text>
    </Box>
    {children}
  </Box>
);

// A SubStatRow for indented, secondary information
interface SubStatRowProps {
  title: string;
  children: React.ReactNode;
}

const SubStatRow: React.FC<SubStatRowProps> = ({ title, children }) => (
  <Box paddingLeft={2}>
    {/* Adjust width for the "» " prefix */}
    <Box width={26}>
      <Text>» {title}</Text>
    </Box>
    {children}
  </Box>
);

// A Section component to group related stats
interface SectionProps {
  title: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, children }) => (
  <Box flexDirection="column" width="100%" marginBottom={1}>
    <Text bold>{title}</Text>
    {children}
  </Box>
);

const ModelUsageTable: React.FC<{ models: Record<string, ModelMetrics> }> = ({
  models,
}) => {
  const nameWidth = 24;
  const requestsWidth = 12;
  const tokensWidth = 14;

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Header */}
      <Box>
        <Box width={nameWidth}>
          <Text bold>Model</Text>
        </Box>
        <Box width={requestsWidth}>
          <Text bold>Requests</Text>
        </Box>
        <Box width={tokensWidth}>
          <Text bold>Total Tokens</Text>
        </Box>
      </Box>
      {/* Divider */}
      <Box
        borderStyle="round"
        borderBottom={true}
        borderTop={false}
        borderLeft={false}
        borderRight={false}
        width={nameWidth + requestsWidth + tokensWidth - 2}
      ></Box>

      {/* Rows */}
      {Object.entries(models).map(([name, modelMetrics]) => (
        <Box key={name}>
          <Box width={nameWidth}>
            <Text>{name.replace('-001', '')}</Text>
          </Box>
          <Box width={requestsWidth}>
            <Text>{modelMetrics.api.totalRequests}</Text>
          </Box>
          <Box width={tokensWidth}>
            <Text color={Colors.AccentYellow}>
              {modelMetrics.tokens.total.toLocaleString()}
            </Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
};

interface StatsDisplayProps {
  duration: string;
}

export const StatsDisplay: React.FC<StatsDisplayProps> = ({ duration }) => {
  const { stats } = useSessionStats();
  const { metrics } = stats;
  const { models, tools } = metrics;
  const computed = computeSessionStats(metrics);

  const cacheThresholds = { green: 40, yellow: 15 };
  const cacheColor = getStatusColor(computed.cacheEfficiency, cacheThresholds, {
    defaultColor: Colors.Foreground,
  });

  const successThresholds = { green: 95, yellow: 85 };
  const agreementThresholds = { green: 80, yellow: 60 };
  const successColor = getStatusColor(computed.successRate, successThresholds);
  const agreementColor = getStatusColor(
    computed.agreementRate,
    agreementThresholds,
  );

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.Gray}
      flexDirection="column"
      paddingY={1}
      paddingX={2}
    >
      <Text bold color={Colors.AccentPurple}>
        Session Stats
      </Text>
      <Box height={1} />

      <Section title="Performance">
        <StatRow title="Wall Time:">
          <Text>{duration}</Text>
        </StatRow>
        <StatRow title="Agent Active:">
          <Text>{formatDuration(computed.agentActiveTime)}</Text>
        </StatRow>
        <SubStatRow title="API Time:">
          <Text>
            {formatDuration(computed.totalApiTime)}{' '}
            <Text color={Colors.Gray}>
              ({computed.apiTimePercent.toFixed(1)}%)
            </Text>
          </Text>
        </SubStatRow>
        <SubStatRow title="Tool Time:">
          <Text>
            {formatDuration(computed.totalToolTime)}{' '}
            <Text color={Colors.Gray}>
              ({computed.toolTimePercent.toFixed(1)}%)
            </Text>
          </Text>
        </SubStatRow>
      </Section>

      {tools.totalCalls > 0 && (
        <Section title="Interaction Summary">
          <StatRow title="Tool Calls:">
            <Text>
              {tools.totalCalls} ({' '}
              <Text color={Colors.AccentGreen}>✔ {tools.totalSuccess}</Text>{' '}
              <Text color={Colors.AccentRed}>✖ {tools.totalFail}</Text> )
            </Text>
          </StatRow>
          <StatRow title="Success Rate:">
            <Text color={successColor}>{computed.successRate.toFixed(1)}%</Text>
          </StatRow>
          {computed.totalDecisions > 0 && (
            <StatRow title="User Agreement:">
              <Text color={agreementColor}>
                {computed.agreementRate.toFixed(1)}%{' '}
                <Text color={Colors.Gray}>
                  ({computed.totalDecisions} reviewed)
                </Text>
              </Text>
            </StatRow>
          )}
        </Section>
      )}

      {computed.cacheEfficiency > 0 && (
        <Section title="Efficiency & Optimizations">
          <StatRow title="API Cache Efficiency:">
            <Text color={cacheColor}>
              {computed.cacheEfficiency.toFixed(1)}%
            </Text>
          </StatRow>
        </Section>
      )}

      {Object.keys(models).length > 0 && <ModelUsageTable models={models} />}
    </Box>
  );
};
