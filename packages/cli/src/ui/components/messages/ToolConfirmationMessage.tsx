/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import type { ToolConfirmationPayload } from '../../types.js';

interface ToolConfirmationMessageProps {
  confirmationPayload: ToolConfirmationPayload;
  // Callback function to send the decision (true = confirm, false = deny)
  onSubmitDecision: (confirmed: boolean) => void;
}

export const ToolConfirmationMessage: React.FC<ToolConfirmationMessageProps> = ({
  confirmationPayload,
  onSubmitDecision,
}) => {
  const items = [
    { label: 'Yes, proceed', value: true },
    { label: 'No, cancel', value: false },
  ];

  const handleSelect = (item: { label: string; value: boolean }) => {
    onSubmitDecision(item.value);
  };

  // Basic display - enhance later with diff/command details
  const promptText = `Proceed with tool: ${confirmationPayload.name}?`;
  const argsText = `Args: ${JSON.stringify(confirmationPayload.args)}`;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
      marginY={1}
      marginLeft={2} // Indent under the ToolMessage
    >
      <Text color="yellow" bold>
        {promptText}
      </Text>
      <Text color="yellow">{argsText}</Text>
      <SelectInput items={items} onSelect={handleSelect} />
    </Box>
  );
}; 