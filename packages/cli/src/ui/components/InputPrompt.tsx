/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, useInput, useFocus } from 'ink';
import TextInput from 'ink-text-input';
import { UI_WIDTH } from '../constants.js';

interface InputPromptProps {
  onSubmit: (value: string) => void;
}

export const InputPrompt: React.FC<InputPromptProps> = ({ onSubmit }) => {
  const [value, setValue] = React.useState('');
  const { isFocused } = useFocus({ autoFocus: true });

  useInput(
    (input, key) => {
      if (key.return) {
        if (value.trim()) {
          onSubmit(value);
          setValue('');
        }
      }
    },
    { isActive: isFocused },
  );

  return (
    <Box
      width={UI_WIDTH}
      borderStyle="round"
      borderColor={isFocused ? 'blue' : 'gray'}
      paddingX={1}
    >
      <TextInput
        value={value}
        onChange={setValue}
        placeholder="Enter your message or use tools..."
        onSubmit={() => {
          if (value.trim()) {
            onSubmit(value);
            setValue('');
          }
        }}
      />
    </Box>
  );
};
