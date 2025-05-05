/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Text, Box } from 'ink';
import { MarkdownRenderer } from '../../utils/MarkdownRenderer.js';
import { Colors } from '../../colors.js';


interface InfoMessageProps {
  text: string;
  style: 'markdown' | 'text' | undefined;
}

export const InfoMessage: React.FC<InfoMessageProps> = ({ text, style }) => {
  const prefix = 'ℹ ';
  const prefixWidth = prefix.length;

  return (
    <Box flexDirection="row">
      <Box width={prefixWidth}>
        <Text color={Colors.AccentYellow}>{prefix}</Text>
      </Box>
      {style === 'markdown' ? (
      <Box flexGrow={1} flexDirection="column">
        {MarkdownRenderer.render(text)}
      </Box>
      ) : (
      <Box flexGrow={1}>
        <Text color={Colors.AccentYellow}>
          {text}
        </Text>
      </Box>
      )}
    </Box>
  );
};
