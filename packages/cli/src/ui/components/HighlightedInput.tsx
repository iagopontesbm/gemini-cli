/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Text } from 'ink';
import { Colors } from '../colors.js';

interface HighlightedInputProps {
  text: string;
}

export const HighlightedInput: React.FC<HighlightedInputProps> = ({ text }) => {
  // Match words starting with @ or / , or standalone @ or / symbols
  const parts = text.split(/(@\S*|@|\/\S*|\/)/g);

  return (
    <Text>
      {parts.map((part, index) => {
        if (part && (part.startsWith('@') || part.startsWith('/'))) {
          return (
            <Text key={index} bold color={Colors.AccentPurple}>
              {part}
            </Text>
          );
        }
        return <Text key={index}>{part}</Text>;
      })}
    </Text>
  );
};
