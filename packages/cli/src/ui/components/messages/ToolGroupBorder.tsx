/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box } from 'ink';
import React from 'react';
import { Colors } from '../../colors.js';

interface ToolGroupBorderProps {
  hasPending: boolean;
  position: 'top' | 'bottom';
}

export const ToolGroupBorder: React.FC<ToolGroupBorderProps> = ({
  hasPending,
  position,
}) => {
  const borderColor = hasPending ? Colors.AccentYellow : Colors.Gray;

  return (
    <Box
      borderStyle="round"
      width="100%"
      marginLeft={1}
      borderDimColor={hasPending}
      borderColor={borderColor}
      borderTop={position === 'top'}
      borderBottom={position === 'bottom'}
      marginBottom={position === 'bottom' ? 1 : 0}
      paddingTop={position === 'top' ? 1 : 0}
      paddingBottom={position === 'bottom' ? 1 : 0}
    />
  );
};
