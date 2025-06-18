/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ToolCallStatus, type HistoryItem } from '../types.js';
import { UserMessage } from './messages/UserMessage.js';
import { UserShellMessage } from './messages/UserShellMessage.js';
import { GeminiMessage } from './messages/GeminiMessage.js';
import { InfoMessage } from './messages/InfoMessage.js';
import { ErrorMessage } from './messages/ErrorMessage.js';
// import { ToolGroupMessage } from './messages/ToolGroupMessage.js';
import { GeminiMessageContent } from './messages/GeminiMessageContent.js';
import { CompressionMessage } from './messages/CompressionMessage.js';
import { Box } from 'ink';
import { AboutBox } from './AboutBox.js';
import { StatsDisplay } from './StatsDisplay.js';
import { SessionSummaryDisplay } from './SessionSummaryDisplay.js';
import { Config } from '@gemini-cli/core';
import { UseHistoryManagerReturn } from '../hooks/useHistoryManager.js';
import { ToolMessage } from './messages/ToolMessage.js';
import { ToolConfirmationDetails } from './messages/ToolConfirmationDetails.js';
import { ToolConfirmationMessage } from './messages/ToolConfirmationMessage.js';

interface HistoryItemDisplayProps {
  item: HistoryItem;
  availableTerminalHeight: number;
  isPending: boolean;
  config?: Config;
  isFocused?: boolean;
  addItem: UseHistoryManagerReturn['addItem'];
}

export const HistoryItemDisplay: React.FC<HistoryItemDisplayProps> = ({
  item,
  availableTerminalHeight,
  isPending,
  config,
  isFocused = true,
}) => (
  <Box flexDirection="column" key={item.id} width="100%">
    {/* Render standard message types */}
    {item.type === 'user' && <UserMessage text={item.text} />}
    {item.type === 'user_shell' && <UserShellMessage text={item.text} />}
    {item.type === 'gemini' && (
      <GeminiMessage
        text={item.text}
        isPending={isPending}
        availableTerminalHeight={availableTerminalHeight}
      />
    )}
    {item.type === 'gemini_content' && (
      <GeminiMessageContent
        text={item.text}
        isPending={isPending}
        availableTerminalHeight={availableTerminalHeight}
      />
    )}
    {item.type === 'info' && <InfoMessage text={item.text} />}
    {item.type === 'error' && <ErrorMessage text={item.text} />}
    {item.type === 'about' && (
      <AboutBox
        cliVersion={item.cliVersion}
        osVersion={item.osVersion}
        sandboxEnv={item.sandboxEnv}
        modelVersion={item.modelVersion}
      />
    )}
    {item.type === 'stats' && (
      <StatsDisplay
        stats={item.stats}
        lastTurnStats={item.lastTurnStats}
        duration={item.duration}
      />
    )}
    {item.type === 'quit' && (
      <SessionSummaryDisplay stats={item.stats} duration={item.duration} />
    )}
    {
      //     item.type === 'tool_group' && (
      //   <ToolGroupMessage
      //     toolCalls={item.tools}
      //     groupId={item.id}
      //     availableTerminalHeight={availableTerminalHeight}
      //     config={config}
      //     isFocused={isFocused}
      //   />
      // )
    }
    {item.type === 'tool_message' && (
      <ToolMessage
        name={item.name}
        description={item.description}
        resultDisplay={item.resultDisplay}
        status={item.status}
        // TODO: calculate static height
        availableTerminalHeight={availableTerminalHeight - 3}
        emphasis={
          // TODO: maybe pass additional info here
          // isConfirming ? 'high' : toolAwaitingApproval ? 'low' : 'medium'
          item.status === ToolCallStatus.Confirming ? 'high' : 'medium'
        }
        renderOutputAsMarkdown={item.renderOutputAsMarkdown}
        borderTop={item.borderTop}
        borderBottom={item.borderBottom}
      />
    )}
    {item.type === 'tool_confirmation_details' && (
      <ToolConfirmationDetails
        confirmationDetails={item.confirmationDetails}
        borderTop={item.borderTop}
        borderBottom={item.borderBottom}
      />
    )}
    {item.type === 'tool_confirmation_message' && (
      <ToolConfirmationMessage
        confirmationDetails={item.confirmationDetails}
        isFocused={isFocused}
        borderTop={item.borderTop}
        borderBottom={item.borderBottom}
      />
    )}
    {item.type === 'compression' && (
      <CompressionMessage compression={item.compression} />
    )}
  </Box>
);
