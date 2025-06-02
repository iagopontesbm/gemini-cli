/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BaseTool,
  ToolResult,
  ToolCallConfirmationDetails,
  ToolConfirmationOutcome,
  ToolMcpConfirmationDetails,
} from './tools.js';
import { CallableTool, Part, FunctionCall } from '@google/genai';

type ToolParams = Record<string, unknown>;

export const MCP_TOOL_DEFAULT_TIMEOUT_MSEC = 10 * 60 * 1000; // default to 10 minutes

export class DiscoveredMCPTool extends BaseTool<ToolParams, ToolResult> {
  private static readonly whitelist: Set<string> = new Set();

  constructor(
    private readonly mcpTool: CallableTool,
    readonly serverName: string,
    readonly name: string,
    readonly description: string,
    readonly parameterSchema: Record<string, unknown>,
    readonly serverToolName: string,
    readonly timeout?: number,
    readonly trust?: boolean,
  ) {
    description += `

This MCP tool was discovered from a local MCP server.`;
    if (serverName !== 'mcp') {
      // Add server name if not the generic 'mcp'
      description += ` Server: '${serverName}'.`;
    }
    description += `
Original tool name on server: \`${serverToolName}\`.`;
    description += `
MCP servers can be configured in project or user settings.
Returns the MCP server response as a json string.
`;

    super(
      name,
      name,
      description,
      parameterSchema,
      true, // isOutputMarkdown
      false, // canUpdateOutput
    );
  }

  async shouldConfirmExecute(
    _params: ToolParams,
    _abortSignal: AbortSignal,
  ): Promise<ToolCallConfirmationDetails | false> {
    const serverWhitelistKey = this.serverName;
    const toolWhitelistKey = `${this.serverName}.${this.serverToolName}`;

    if (this.trust) {
      return false; // server is trusted, no confirmation needed
    }

    if (
      DiscoveredMCPTool.whitelist.has(serverWhitelistKey) ||
      DiscoveredMCPTool.whitelist.has(toolWhitelistKey)
    ) {
      return false; // server and/or tool already allow listed
    }

    const confirmationDetails: ToolMcpConfirmationDetails = {
      type: 'mcp',
      title: 'Confirm MCP Tool Execution',
      serverName: this.serverName,
      toolName: this.serverToolName, // Display original tool name in confirmation
      toolDisplayName: this.name, // Display mangled name as it's what user sees
      onConfirm: async (outcome: ToolConfirmationOutcome) => {
        if (outcome === ToolConfirmationOutcome.ProceedAlwaysServer) {
          DiscoveredMCPTool.whitelist.add(serverWhitelistKey);
        } else if (outcome === ToolConfirmationOutcome.ProceedAlwaysTool) {
          DiscoveredMCPTool.whitelist.add(toolWhitelistKey);
        }
      },
    };
    return confirmationDetails;
  }

  async execute(params: ToolParams): Promise<ToolResult> {
    const functionCalls: FunctionCall[] = [
      {
        name: this.serverToolName,
        args: params,
      },
    ];

    const responseParts: Part[] = await this.mcpTool.callTool(functionCalls);

    const output = getStringifiedResultForDisplay(responseParts);
    return {
      llmContent: responseParts,
      returnDisplay: output,
    };
  }
}

function getStringifiedResultForDisplay(result: Part[]) {
  if (!result || result.length === 0) {
    return '```json\n[]\n```';
  }

  const processFunctionResponse = (part: Part) => {
    if (part.functionResponse) {
      const responseContent = part.functionResponse.response?.content;
      if (responseContent && Array.isArray(responseContent)) {
        // Check if all parts in responseContent are simple TextParts
        const allTextParts = responseContent.every(
          (p: Part) => p.text !== undefined,
        );
        if (allTextParts) {
          return responseContent.map((p: Part) => p.text).join('');
        }
        // If not all simple text parts, return the array of these content parts for JSON stringification
        return responseContent;
      }

      // If no content, or not an array, or not a functionResponse, stringify the whole functionResponse part for inspection
      return part.functionResponse;
    }
    return part; // Fallback for unexpected structure or non-FunctionResponsePart
  };

  if (result.length === 1) {
    const processedResponse = processFunctionResponse(result[0]);
    if (typeof processedResponse === 'string') {
      // If it's a simple string, no need for JSON stringification or markdown
      return processedResponse;
    }
    return '```json\n' + JSON.stringify(processedResponse, null, 2) + '\n```';
  }

  const processedResults = result.map(processFunctionResponse);
  return '```json\n' + JSON.stringify(processedResults, null, 2) + '\n```';
}
