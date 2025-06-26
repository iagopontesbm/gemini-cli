/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ResourceRegistry } from './resource-registry.js';
import { Resource, ResourceTemplate } from '@modelcontextprotocol/sdk/types.js';

describe('ResourceRegistry', () => {
  let registry: ResourceRegistry;

  beforeEach(() => {
    registry = new ResourceRegistry();
  });

  describe('registerResource', () => {
    it('should register a resource', () => {
      const resource: Resource = {
        uri: 'file:///test.txt',
        name: 'Test File',
        description: 'A test file',
        mimeType: 'text/plain',
      };

      registry.registerResource('test-server', resource);
      const resources = registry.getAllResources();
      
      expect(resources).toHaveLength(1);
      expect(resources[0].serverName).toBe('test-server');
      expect(resources[0].resource).toEqual(resource);
    });

    it('should handle multiple resources from different servers', () => {
      const resource1: Resource = {
        uri: 'file:///test1.txt',
        name: 'Test File 1',
      };
      const resource2: Resource = {
        uri: 'file:///test2.txt',
        name: 'Test File 2',
      };

      registry.registerResource('server1', resource1);
      registry.registerResource('server2', resource2);
      
      const resources = registry.getAllResources();
      expect(resources).toHaveLength(2);
    });
  });

  describe('registerResourceTemplate', () => {
    it('should register a resource template', () => {
      const template: ResourceTemplate = {
        uriTemplate: 'file:///{path}',
        name: 'File Template',
        description: 'Template for files',
        mimeType: 'text/plain',
      };

      registry.registerResourceTemplate('test-server', template);
      const templates = registry.getAllResourceTemplates();
      
      expect(templates).toHaveLength(1);
      expect(templates[0].serverName).toBe('test-server');
      expect(templates[0].template).toEqual(template);
    });
  });

  describe('getResourcesByServer', () => {
    it('should return resources for a specific server', () => {
      const resource1: Resource = {
        uri: 'file:///test1.txt',
        name: 'Test File 1',
      };
      const resource2: Resource = {
        uri: 'file:///test2.txt',
        name: 'Test File 2',
      };

      registry.registerResource('server1', resource1);
      registry.registerResource('server2', resource2);
      
      const server1Resources = registry.getResourcesByServer('server1');
      expect(server1Resources).toHaveLength(1);
      expect(server1Resources[0].resource.uri).toBe('file:///test1.txt');
      
      const server2Resources = registry.getResourcesByServer('server2');
      expect(server2Resources).toHaveLength(1);
      expect(server2Resources[0].resource.uri).toBe('file:///test2.txt');
    });

    it('should return empty array for unknown server', () => {
      const resources = registry.getResourcesByServer('unknown-server');
      expect(resources).toEqual([]);
    });
  });

  describe('findResourceByUri', () => {
    it('should find a resource by URI', () => {
      const resource: Resource = {
        uri: 'file:///test.txt',
        name: 'Test File',
      };

      registry.registerResource('test-server', resource);
      const found = registry.findResourceByUri('file:///test.txt');
      
      expect(found).toBeDefined();
      expect(found?.serverName).toBe('test-server');
      expect(found?.resource).toEqual(resource);
    });

    it('should return undefined for unknown URI', () => {
      const found = registry.findResourceByUri('file:///unknown.txt');
      expect(found).toBeUndefined();
    });
  });

  describe('clearServerResources', () => {
    it('should clear resources for a specific server', () => {
      const resource1: Resource = {
        uri: 'file:///test1.txt',
        name: 'Test File 1',
      };
      const resource2: Resource = {
        uri: 'file:///test2.txt',
        name: 'Test File 2',
      };
      const template: ResourceTemplate = {
        uriTemplate: 'file:///{path}',
        name: 'File Template',
      };

      registry.registerResource('server1', resource1);
      registry.registerResource('server2', resource2);
      registry.registerResourceTemplate('server1', template);
      
      registry.clearServerResources('server1');
      
      const resources = registry.getAllResources();
      expect(resources).toHaveLength(1);
      expect(resources[0].serverName).toBe('server2');
      
      const templates = registry.getAllResourceTemplates();
      expect(templates).toHaveLength(0);
    });
  });

  describe('clear', () => {
    it('should clear all resources and templates', () => {
      const resource: Resource = {
        uri: 'file:///test.txt',
        name: 'Test File',
      };
      const template: ResourceTemplate = {
        uriTemplate: 'file:///{path}',
        name: 'File Template',
      };

      registry.registerResource('server1', resource);
      registry.registerResourceTemplate('server2', template);
      
      registry.clear();
      
      expect(registry.getAllResources()).toHaveLength(0);
      expect(registry.getAllResourceTemplates()).toHaveLength(0);
    });
  });
});