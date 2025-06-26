/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text, useInput } from 'ink';
import { Colors } from '../colors.js';
import { RadioButtonSelect } from './shared/RadioButtonSelect.js';

interface SaveChatDialogProps {
  onSave: () => void;
  onDontSave: () => void;
  onCancel?: () => void;
}

export function SaveChatDialog({
  onSave,
  onDontSave,
  onCancel,
}: SaveChatDialogProps): React.JSX.Element {
  const items = [
    { label: 'Save chat', value: 'save' },
    { label: "Don't save", value: 'dont-save' },
  ];

  const handleSelect = (value: string) => {
    if (value === 'save') {
      onSave();
    } else if (value === 'dont-save') {
      onDontSave();
    }
  };

  useInput((input, key) => {
    if (key.escape && onCancel) {
      onCancel();
    }
    // Handle CTRL+C to exit without saving
    if (key.ctrl && (input === 'c' || input === 'C')) {
      onDontSave();
    }
  });

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.AccentYellow}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold color={Colors.AccentYellow}>
        ⚠️  Save current chat before exiting?
      </Text>
      <Box marginTop={1}>
        <Text>
          Your current conversation will be lost if you don&apos;t save it.
        </Text>
      </Box>
      <Box marginTop={1}>
        <RadioButtonSelect
          items={items}
          initialIndex={0}
          onSelect={handleSelect}
          onHighlight={() => {}}
          isFocused={true}
        />
      </Box>
      <Box marginTop={1}>
        <Text color={Colors.Gray}>
          (Use ↑↓ to navigate, Enter to select, Esc to cancel, Ctrl+C to exit without saving)
        </Text>
      </Box>
    </Box>
  );
} 