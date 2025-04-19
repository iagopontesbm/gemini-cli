/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import {
  IndividualToolCallDisplay,
  ToolCallStatus,
  ToolConfirmationPayload,
} from '../../types.js';
import { DiffRenderer } from './DiffRenderer.js';
// Import FileDiff and ToolResultDisplay from server package
import type { FileDiff, ToolResultDisplay } from '@gemini-code/server';

export const ToolMessage: React.FC<IndividualToolCallDisplay> = ({
  callId,
  name,
  description,
  resultDisplay,
  status,
  confirmationPayload,
}) => {
  const typedResultDisplay = resultDisplay as ToolResultDisplay | undefined;

  let color = 'gray';
  let prefix = '';
  switch (status) {
    case ToolCallStatus.Pending:
      prefix = 'Pending:';
      break;
    case ToolCallStatus.Invoked:
      prefix = 'Executing:';
      break;
    case ToolCallStatus.Confirming:
      color = 'yellow';
      prefix = 'Confirm:';
      break;
    case ToolCallStatus.Success:
      color = 'green';
      prefix = 'Success:';
      break;
    case ToolCallStatus.Error:
      color = 'red';
      prefix = 'Error:';
      break;
    default:
      // Handle unexpected status if necessary, or just break
      break;
  }

  const title = `${prefix} ${name}`;

  return (
    <Box key={callId} borderStyle="round" paddingX={1} flexDirection="column">
      <Box>
        {status === ToolCallStatus.Invoked && (
          <Box marginRight={1}>
            <Text color="blue">
              <Spinner type="dots" />
            </Text>
          </Box>
        )}
        <Text bold color={color}>
          {title}
        </Text>
        <Text color={color}>
          {status === ToolCallStatus.Error && typedResultDisplay
            ? `: ${typedResultDisplay}`
            : ` - ${description}`}
        </Text>
      </Box>
      {status === ToolCallStatus.Confirming && confirmationPayload && (
        <Box marginLeft={2} borderStyle="round" borderColor="yellow" paddingX={1} marginY={1}>
          <Text color="yellow">Confirmation needed for {confirmationPayload.name}. Args: {JSON.stringify(confirmationPayload.args)}</Text>
          <Text color="gray">(Confirmation UI placeholder)</Text>
        </Box>
      )}
      {status === ToolCallStatus.Success && typedResultDisplay && (
        <Box flexDirection="column" marginLeft={2}>
          {typeof typedResultDisplay === 'string' ? (
            <Text>{typedResultDisplay}</Text>
          ) : (
            <DiffRenderer
              diffContent={(typedResultDisplay as FileDiff).fileDiff}
            />
          )}
        </Box>
      )}
    </Box>
  );
};
