/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import { Colors } from '../colors.js';

// Try to import ink-big-text, but have a fallback ready
let BigText: React.ComponentType<{text: string; letterSpacing?: number; space?: boolean}> | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, no-restricted-syntax
  BigText = require('ink-big-text').default;
} catch {
  // Will use fallback
}

interface HeaderProps {
  title?: string;
}

// ASCII art fallback for when fonts can't be loaded
const getAsciiArt = (title: string): string => {
  const asciiArtMap: { [key: string]: string } = {
    'GEMINI': `
 ██████╗ ███████╗███╗   ███╗██╗███╗   ██╗██╗
██╔════╝ ██╔════╝████╗ ████║██║████╗  ██║██║
██║  ███╗█████╗  ██╔████╔██║██║██╔██╗ ██║██║
██║   ██║██╔══╝  ██║╚██╔╝██║██║██║╚██╗██║██║
╚██████╔╝███████╗██║ ╚═╝ ██║██║██║ ╚████║██║
 ╚═════╝ ╚══════╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝
`,
  };
  
  // Return custom ASCII art if available, otherwise return the title as-is
  return asciiArtMap[title.toUpperCase()] || title;
};

export const Header: React.FC<HeaderProps> = ({ title = 'GEMINI' }) => (
  <>
    <Box alignItems="flex-start" marginBottom={1}>
      {BigText ? (
        // Use ink-big-text if available
        Colors.GradientColors ? (
          <Gradient colors={Colors.GradientColors}>
            <BigText text={title} letterSpacing={0} space={false} />
          </Gradient>
        ) : (
          <BigText text={title} letterSpacing={0} space={false} />
        )
      ) : (
        // Use ASCII art fallback
        Colors.GradientColors ? (
          <Gradient colors={Colors.GradientColors}>
            <Text>{getAsciiArt(title)}</Text>
          </Gradient>
        ) : (
          <Text>{getAsciiArt(title)}</Text>
        )
      )}
    </Box>
  </>
);
