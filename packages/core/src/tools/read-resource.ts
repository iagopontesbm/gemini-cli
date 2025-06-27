/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { BaseTool, ToolResult } from './tools.js';
import { ResourceRegistry } from './resource-registry.js';

export interface ReadResourceToolParams {
  uri: string;
}

/**
 * Tool for reading MCP resources
 */
export class ReadResourceTool extends BaseTool<
  ReadResourceToolParams,
  ToolResult
> {
  constructor(
    private mcpClients: Map<string, Client>,
    private resourceRegistry: ResourceRegistry,
  ) {
    super(
      'read_resource',
      'Read Resource',
      'Read content from an MCP resource by URI',
      {
        type: 'object',
        properties: {
          uri: {
            type: 'string',
            description: 'The URI of the resource to read',
          },
        },
        required: ['uri'],
      },
      false, // isOutputMarkdown
      false, // canUpdateOutput
    );
  }

  async execute(params: ReadResourceToolParams): Promise<ToolResult> {
    const { uri } = params;

    // Find which server has this resource
    const mcpResource = this.resourceRegistry.findResourceByUri(uri);
    if (!mcpResource) {
      return {
        llmContent: `Resource not found: ${uri}`,
        returnDisplay: `❌ Resource not found: ${uri}`,
      };
    }

    const client = this.mcpClients.get(mcpResource.serverName);
    if (!client) {
      return {
        llmContent: `MCP server not connected: ${mcpResource.serverName}`,
        returnDisplay: `❌ MCP server not connected: ${mcpResource.serverName}`,
      };
    }

    try {
      const result = await client.readResource({ uri });
      
      if (!result.contents || result.contents.length === 0) {
        return {
          llmContent: `Resource ${uri} has no content`,
          returnDisplay: `⚠️  Resource ${uri} has no content`,
        };
      }

      // Combine all content items
      const contentParts: string[] = [];
      for (const content of result.contents) {
        if ('text' in content && typeof content.text === 'string') {
          contentParts.push(content.text);
        } else if ('blob' in content && typeof content.blob === 'string') {
          // Handle binary data (base64 encoded)
          const binarySize = Math.ceil((content.blob.length * 3) / 4); // Estimate binary size from base64
          contentParts.push(`[Binary data: ~${binarySize} bytes]`);
        }
      }

      const fullContent = contentParts.join('\n\n');
      const resourceInfo = mcpResource.resource;

      return {
        llmContent: fullContent,
        returnDisplay: `📄 **${resourceInfo.name}** (${uri})\n${
          resourceInfo.mimeType ? `Type: ${resourceInfo.mimeType}\n` : ''
        }\n${fullContent}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        llmContent: `Failed to read resource ${uri}: ${errorMessage}`,
        returnDisplay: `❌ Failed to read resource ${uri}: ${errorMessage}`,
      };
    }
  }
}