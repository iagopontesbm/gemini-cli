/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseTool, ToolResult } from './tools.js';
import { ResourceRegistry } from './resource-registry.js';

export interface ListResourcesToolParams {
  serverName?: string;
}

/**
 * Tool for listing available MCP resources
 */
export class ListResourcesTool extends BaseTool<
  ListResourcesToolParams,
  ToolResult
> {
  constructor(private resourceRegistry: ResourceRegistry) {
    super(
      'list_resources',
      'List Resources',
      'List available MCP resources from all servers or a specific server',
      {
        type: 'object',
        properties: {
          serverName: {
            type: 'string',
            description: 'Optional: filter resources by server name',
          },
        },
      },
      true, // isOutputMarkdown
      false, // canUpdateOutput
    );
  }

  async execute(params: ListResourcesToolParams): Promise<ToolResult> {
    const { serverName } = params;

    const resources = serverName
      ? this.resourceRegistry.getResourcesByServer(serverName)
      : this.resourceRegistry.getAllResources();

    const templates = serverName
      ? this.resourceRegistry.getResourceTemplatesByServer(serverName)
      : this.resourceRegistry.getAllResourceTemplates();

    if (resources.length === 0 && templates.length === 0) {
      const message = serverName
        ? `No resources found for server '${serverName}'`
        : 'No MCP resources available';
      return {
        llmContent: message,
        returnDisplay: `ℹ️  ${message}`,
      };
    }

    const parts: string[] = [];
    
    // Group resources by server
    const resourcesByServer = new Map<string, typeof resources>();
    for (const resource of resources) {
      const existing = resourcesByServer.get(resource.serverName) || [];
      existing.push(resource);
      resourcesByServer.set(resource.serverName, existing);
    }

    // Group templates by server
    const templatesByServer = new Map<string, typeof templates>();
    for (const template of templates) {
      const existing = templatesByServer.get(template.serverName) || [];
      existing.push(template);
      templatesByServer.set(template.serverName, existing);
    }

    // Combine all server names
    const allServers = new Set([
      ...resourcesByServer.keys(),
      ...templatesByServer.keys(),
    ]);

    // Format output
    for (const server of allServers) {
      parts.push(`## MCP Server: ${server}\n`);
      
      const serverResources = resourcesByServer.get(server) || [];
      const serverTemplates = templatesByServer.get(server) || [];
      
      if (serverResources.length > 0) {
        parts.push('### Resources\n');
        for (const { resource } of serverResources) {
          parts.push(`- **${resource.name}**`);
          parts.push(`  - URI: \`${resource.uri}\``);
          if (resource.description) {
            parts.push(`  - Description: ${resource.description}`);
          }
          if (resource.mimeType) {
            parts.push(`  - Type: ${resource.mimeType}`);
          }
          parts.push('');
        }
      }
      
      if (serverTemplates.length > 0) {
        parts.push('### Resource Templates\n');
        for (const { template } of serverTemplates) {
          parts.push(`- **${template.name}**`);
          parts.push(`  - Template: \`${template.uriTemplate}\``);
          if (template.description) {
            parts.push(`  - Description: ${template.description}`);
          }
          if (template.mimeType) {
            parts.push(`  - Type: ${template.mimeType}`);
          }
          parts.push('');
        }
      }
    }

    const display = parts.join('\n');
    const llmContent = `Available MCP resources:\n${display}`;

    return {
      llmContent,
      returnDisplay: display,
    };
  }
}