/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import { Colors } from '../colors.js';

interface FooterProps {
  queryLength: number;
  debugMode: boolean;
}

export const Footer: React.FC<FooterProps> = ({ queryLength, debugMode }) => (
  <Box marginTop={1} justifyContent="space-between">
    <Box minWidth={15}>
      <Text color={Colors.SubtleComment}>
        {queryLength === 0 ? '? for shortcuts' : ''}
        {debugMode && <Text color="red"> {"Running in debug mode."}</Text>}
      </Text>
    </Box>
    <Text color={Colors.AccentBlue}>Gemini</Text>
  </Box>
);
