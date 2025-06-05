/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import { Colors } from '../colors.js';
import { patchCfontsLoader } from './cfonts-loader.js';

// Apply the cfonts loader patch
patchCfontsLoader();

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

export const Header: React.FC<HeaderProps> = ({ title = 'GEMINI' }) => {
  const [BigText, setBigText] = useState<React.ComponentType<{text: string; letterSpacing?: number; space?: boolean}> | null>(null);

  useEffect(() => {
    // Dynamically import ink-big-text
    import('ink-big-text')
      .then(module => setBigText(() => module.default))
      .catch(error => {
        console.error('Failed to load ink-big-text:', error);
        // BigText remains null, will use fallback
      });
  }, []);

  const renderContent = () => {
    if (BigText) {
      return <BigText text={title} letterSpacing={0} space={false} />;
    } else {
      return <Text>{getAsciiArt(title)}</Text>;
    }
  };

  return (
  <>
    <Box alignItems="flex-start" marginBottom={1}>
      {Colors.GradientColors ? (
        <Gradient colors={Colors.GradientColors}>
          {renderContent()}
        </Gradient>
      ) : (
        renderContent()
      )}
    </Box>
  </>
  );
};
