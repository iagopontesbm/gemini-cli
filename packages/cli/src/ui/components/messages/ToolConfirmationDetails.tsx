/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import { DiffRenderer } from './DiffRenderer.js';
import { Colors } from '../../colors.js';
import {
  ToolCallConfirmationDetails,
  ToolExecuteConfirmationDetails,
  ToolMcpConfirmationDetails,
  Config,
} from '@gemini-cli/core';

export interface ToolConfirmationDetailsProps {
  confirmationDetails: ToolCallConfirmationDetails;
  config?: Config;
}

export const ToolConfirmationDetails: React.FC<
  ToolConfirmationDetailsProps
> = ({ confirmationDetails }) => {
  let bodyContent: React.ReactNode | null = null;

  if (confirmationDetails.type === 'edit') {
    if (confirmationDetails.isModifying) {
      // TODO: Check if it works well
      return null;
    }

    bodyContent = (
      <DiffRenderer
        diffContent={confirmationDetails.fileDiff}
        filename={confirmationDetails.fileName}
      />
    );
  } else if (confirmationDetails.type === 'exec') {
    const executionProps =
      confirmationDetails as ToolExecuteConfirmationDetails;

    bodyContent = (
      <Box flexDirection="column">
        <Box paddingX={1} marginLeft={1}>
          <Text color={Colors.AccentCyan}>{executionProps.command}</Text>
        </Box>
      </Box>
    );
  } else if (confirmationDetails.type === 'info') {
    const infoProps = confirmationDetails;
    const displayUrls =
      infoProps.urls &&
      !(infoProps.urls.length === 1 && infoProps.urls[0] === infoProps.prompt);

    bodyContent = (
      <Box flexDirection="column" paddingX={1} marginLeft={1}>
        <Text color={Colors.AccentCyan}>{infoProps.prompt}</Text>
        {displayUrls && infoProps.urls && infoProps.urls.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text>URLs to fetch:</Text>
            {infoProps.urls.map((url) => (
              <Text key={url}> - {url}</Text>
            ))}
          </Box>
        )}
      </Box>
    );
  } else {
    // mcp tool confirmation
    const mcpProps = confirmationDetails as ToolMcpConfirmationDetails;

    bodyContent = (
      <Box flexDirection="column" paddingX={1} marginLeft={1}>
        <Text color={Colors.AccentCyan}>MCP Server: {mcpProps.serverName}</Text>
        <Text color={Colors.AccentCyan}>Tool: {mcpProps.toolName}</Text>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      width="100%"
      marginLeft={1}
      borderDimColor={true}
      borderColor={Colors.AccentYellow}
      borderTop={false}
      borderBottom={false}
    >
      <Box flexGrow={1} flexShrink={1} overflow="hidden" marginBottom={1}>
        {bodyContent}
      </Box>
    </Box>
  );
};
