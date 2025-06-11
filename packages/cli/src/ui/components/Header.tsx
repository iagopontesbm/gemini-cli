/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import { Colors } from '../colors.js';
import { shortAsciiLogo, longAsciiLogo } from './AsciiArt.js';
import { getAsciiArtWidth } from '../utils/textUtils.js'; // Import the utility function

interface HeaderProps {
  customAsciiArt?: string; // For user-defined ASCII art
  textTitle?: string; // For a plain text title
  terminalWidth: number; // For responsive logo
}

export const Header: React.FC<HeaderProps> = ({
  customAsciiArt,
  textTitle,
  terminalWidth,
}) => {
  let displayTitle;
  const widthOfLongLogo = getAsciiArtWidth(longAsciiLogo);

  if (customAsciiArt) {
    displayTitle = customAsciiArt;
  } else if (textTitle) {
    displayTitle = textTitle;
  } else {
    displayTitle =
      terminalWidth >= widthOfLongLogo ? longAsciiLogo : shortAsciiLogo;
  }

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
