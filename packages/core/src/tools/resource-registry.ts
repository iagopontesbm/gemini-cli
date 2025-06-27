/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Resource,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/types.js';

export interface MCPResource {
  serverName: string;
  resource: Resource;
}

export interface MCPResourceTemplate {
  serverName: string;
  template: ResourceTemplate;
}

/**
 * Registry for managing MCP resources from multiple servers
 */
export class ResourceRegistry {
  private resources: Map<string, MCPResource> = new Map();
  private resourceTemplates: Map<string, MCPResourceTemplate> = new Map();

  /**
   * Register a resource from an MCP server
   */
  registerResource(serverName: string, resource: Resource): void {
    const key = `${serverName}:${resource.uri}`;
    this.resources.set(key, { serverName, resource });
  }

  /**
   * Register a resource template from an MCP server
   */
  registerResourceTemplate(
    serverName: string,
    template: ResourceTemplate,
  ): void {
    const key = `${serverName}:${template.uriTemplate}`;
    this.resourceTemplates.set(key, { serverName, template });
  }

  /**
   * Get all resources from all servers
   */
  getAllResources(): MCPResource[] {
    return Array.from(this.resources.values());
  }

  /**
   * Get all resource templates from all servers
   */
  getAllResourceTemplates(): MCPResourceTemplate[] {
    return Array.from(this.resourceTemplates.values());
  }

  /**
   * Get resources from a specific server
   */
  getResourcesByServer(serverName: string): MCPResource[] {
    return Array.from(this.resources.values()).filter(
      (r) => r.serverName === serverName,
    );
  }

  /**
   * Get resource templates from a specific server
   */
  getResourceTemplatesByServer(serverName: string): MCPResourceTemplate[] {
    return Array.from(this.resourceTemplates.values()).filter(
      (t) => t.serverName === serverName,
    );
  }

  /**
   * Find a resource by URI
   */
  findResourceByUri(uri: string): MCPResource | undefined {
    for (const resource of this.resources.values()) {
      if (resource.resource.uri === uri) {
        return resource;
      }
    }
    return undefined;
  }

  /**
   * Clear resources from a specific server
   */
  clearServerResources(serverName: string): void {
    // Remove resources
    for (const [key, resource] of this.resources.entries()) {
      if (resource.serverName === serverName) {
        this.resources.delete(key);
      }
    }
    // Remove templates
    for (const [key, template] of this.resourceTemplates.entries()) {
      if (template.serverName === serverName) {
        this.resourceTemplates.delete(key);
      }
    }
  }

  /**
   * Clear all resources
   */
  clear(): void {
    this.resources.clear();
    this.resourceTemplates.clear();
  }
}