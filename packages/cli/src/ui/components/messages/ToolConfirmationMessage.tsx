/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import type { ToolConfirmationPayload } from '../../types.js';
import { DiffRenderer } from './DiffRenderer.js';

interface ToolConfirmationMessageProps {
  confirmationPayload: ToolConfirmationPayload;
  // Callback function to send the decision (true = confirm, false = deny)
  onSubmitDecision: (confirmed: boolean) => void;
}

// Helper to check if details contain a file diff
function hasFileDiff(details: any): details is { fileDiff: string } {
  return details && typeof details.fileDiff === 'string';
}

// Helper to check if details contain a command
function hasCommand(details: any): details is { command: string } {
  return details && typeof details.command === 'string';
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

  const promptText = `Proceed with tool: ${confirmationPayload.name}?`;
  const argsText = `Args: ${JSON.stringify(confirmationPayload.args)}`;
  const details = confirmationPayload.details;

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
      {/* Display details if available */}
      {details && (
        <Box flexDirection="column" marginTop={1}>
          {hasFileDiff(details) && (
            <>
              <Text>Proposed Changes:</Text>
              <DiffRenderer diffContent={details.fileDiff} />
            </>
          )}
          {hasCommand(details) && (
            <Text>Command: {details.command}</Text>
          )}
          {/* Fallback if details format is unknown */}
          {!hasFileDiff(details) && !hasCommand(details) && (
             <Text>Details: {JSON.stringify(details)}</Text>
          )}
        </Box>
      )}
       {!details && (
           <Text color="yellow">Args: {JSON.stringify(confirmationPayload.args)}</Text>
       )}

      <Box marginTop={1}> 
        <SelectInput items={items} onSelect={handleSelect} />
      </Box>
    </Box>
  );
}; 