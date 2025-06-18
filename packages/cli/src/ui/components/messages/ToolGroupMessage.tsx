/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// import React, { useMemo } from 'react';
// import { Box } from 'ink';
// import {
//   /* IndividualToolCallDisplay, */ ToolCallStatus,
// } from '../../types.js';
// import { ToolMessage } from './ToolMessage.js';
// import { ToolConfirmationMessage } from './ToolConfirmationMessage.js';
// import { Config } from '@gemini-cli/core';
// import { ToolConfirmationDetails } from './ToolConfirmationDetails.js';

// interface ToolGroupMessageProps {
//   groupId: number;
//   toolCalls: IndividualToolCallDisplay[];
//   availableTerminalHeight: number;
//   config?: Config;
//   isFocused?: boolean;
// }

// Main component renders the border and maps the tools using ToolMessage
// export const ToolGroupMessage: React.FC<ToolGroupMessageProps> = ({
//   toolCalls,
//   availableTerminalHeight,
//   config,
//   isFocused = true,
// }) => {
//   const staticHeight = /* border */ 2 + /* marginBottom */ 1;
//
//   // only prompt for tool approval on the first 'confirming' tool in the list
//   // note, after the CTA, this automatically moves over to the next 'confirming' tool
//   const toolAwaitingApproval = useMemo(
//     () => toolCalls.find((tc) => tc.status === ToolCallStatus.Confirming),
//     [toolCalls],
//   );
//
//   // tool_group_border(top)
//   //
//   // for tool in tools:
//   //   tool_message
//   //   tool_confirmation_details
//   //   tool_confirmation_message
//   //
//   // tool_group_border(bottom)
//
//   return (
//     <Box flexDirection="column" width="100%">
//       {toolCalls.map((tool) => {
//         const isConfirming = toolAwaitingApproval?.callId === tool.callId;
//         const renderConfirmation =
//           tool.status === ToolCallStatus.Confirming && isConfirming;
//         return (
//           <Box width="100%" key={tool.callId} flexDirection="column">
//             <ToolMessage
//               name={tool.name}
//               description={tool.description}
//               resultDisplay={tool.resultDisplay}
//               status={tool.status}
//               availableTerminalHeight={availableTerminalHeight - staticHeight}
//               emphasis={
//                 isConfirming ? 'high' : toolAwaitingApproval ? 'low' : 'medium'
//               }
//               renderOutputAsMarkdown={tool.renderOutputAsMarkdown}
//               borderTop={true}
//               borderBottom={!renderConfirmation}
//             />
//             {renderConfirmation && tool.confirmationDetails && (
//               <ToolConfirmationDetails
//                 confirmationDetails={tool.confirmationDetails}
//                 borderTop={false}
//                 borderBottom={false}
//               />
//             )}
//             {renderConfirmation && tool.confirmationDetails && (
//               <ToolConfirmationMessage
//                 confirmationDetails={tool.confirmationDetails}
//                 isFocused={isFocused}
//                 borderTop={false}
//                 borderBottom={true}
//               />
//             )}
//           </Box>
//         );
//       })}
//     </Box>
//   );
// };
