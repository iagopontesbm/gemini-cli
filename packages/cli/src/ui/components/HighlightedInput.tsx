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
  // Match words starting with @ or standalone @ symbols
  const parts = text.split(/(@\S*|@)/g);

  return (
    <Text>
      {parts.map((part, index) => {
        if (part && part.startsWith('@')) {
          return (
            <Text key={index} color={Colors.AccentPurple}>
              {part}
            </Text>
          );
        }
        return <Text key={index}>{part}</Text>;
      })}
    </Text>
  );
};
