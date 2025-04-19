/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box } from 'ink';
import { IndividualToolCallDisplay, ToolCallStatus } from '../../types.js';
import { ToolMessage } from './ToolMessage.js';
import { ToolConfirmationMessage } from './ToolConfirmationMessage.js';

interface ToolGroupMessageProps {
  toolCalls: IndividualToolCallDisplay[];
  onSubmitDecision: (callId: string, confirmed: boolean) => void;
}

// Main component renders the border and maps the tools using ToolMessage
export const ToolGroupMessage: React.FC<ToolGroupMessageProps> = ({
  toolCalls,
  onSubmitDecision,
}) => {
  const hasPending = toolCalls.some(
    (t) => t.status === ToolCallStatus.Pending || t.status === ToolCallStatus.Confirming,
  );
  const borderColor = hasPending ? 'yellow' : 'blue';

  const handleSubmitDecision = (callId: string) => (confirmed: boolean) => {
    onSubmitDecision(callId, confirmed);
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={borderColor}>
      {toolCalls.map((tool) => (
        <React.Fragment key={tool.callId}>
          <ToolMessage
            key={tool.callId}
            callId={tool.callId}
            name={tool.name}
            description={tool.description}
            resultDisplay={tool.resultDisplay}
            status={tool.status}
            confirmationPayload={tool.confirmationPayload}
          />
          {tool.status === ToolCallStatus.Confirming &&
            tool.confirmationPayload && (
              <ToolConfirmationMessage
                confirmationPayload={tool.confirmationPayload}
                onSubmitDecision={handleSubmitDecision(tool.callId)}
              />
            )}
        </React.Fragment>
      ))}
      {/* Optional: Add padding below the last item if needed,
                though ToolMessage already has some vertical space implicitly */}
      {/* {tools.length > 0 && <Box height={1} />} */}
    </Box>
  );
};
