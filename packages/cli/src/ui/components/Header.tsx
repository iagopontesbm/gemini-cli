/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import { Colors } from '../colors.js';
import { defaultAsciiLogo } from './AsciiArt.js'; // Import the default ASCII logo

interface HeaderProps {
  customAsciiArt?: string; // For user-defined ASCII art
  textTitle?: string; // For a plain text title
}

export const Header: React.FC<HeaderProps> = ({
  customAsciiArt,
  textTitle,
}) => {
  // Determine the title to display based on priority
  const displayTitle = customAsciiArt || textTitle || defaultAsciiLogo;

  return (
    <>
      <Box marginBottom={1} alignItems="flex-start">
        {Colors.GradientColors ? (
          <Gradient colors={Colors.GradientColors}>
            <Text>{displayTitle}</Text>
          </Gradient>
        ) : (
          <Text>{displayTitle}</Text>
        )}
      </Box>
    </>
  );
};
