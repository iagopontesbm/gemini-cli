#!/usr/bin/env node
/**
 * Example MCP Resource Server
 * 
 * This server demonstrates how to expose resources via the Model Context Protocol.
 * Resources are read-only data sources that can be accessed by the Gemini CLI.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFile } from 'fs/promises';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create MCP server instance
const server = new Server({
  name: 'example-resource-server',
  version: '1.0.0',
}, {
  capabilities: {
    resources: {}
  }
});

// Static resources that this server exposes
const STATIC_RESOURCES = [
  {
    uri: 'project://readme',
    name: 'Project README',
    description: 'The README.md file from the project root',
    mimeType: 'text/markdown'
  },
  {
    uri: 'config://package.json',
    name: 'Package Configuration',
    description: 'The package.json file',
    mimeType: 'application/json'
  },
  {
    uri: 'config://tsconfig.json',
    name: 'TypeScript Configuration',
    description: 'The tsconfig.json file if it exists',
    mimeType: 'application/json'
  },
  {
    uri: 'example://sample-data',
    name: 'Sample Data',
    description: 'Example data demonstrating resource capabilities',
    mimeType: 'application/json'
  }
];

// Resource templates for dynamic access
const RESOURCE_TEMPLATES = [
  {
    uriTemplate: 'file:///{path}',
    name: 'File Access',
    description: 'Read any file by providing its path',
    mimeType: 'text/plain'
  },
  {
    uriTemplate: 'env:///{name}',
    name: 'Environment Variable',
    description: 'Access environment variables by name',
    mimeType: 'text/plain'
  }
];

// Handler for listing available resources
server.setRequestHandler('resources/list', async () => {
  return {
    resources: STATIC_RESOURCES
  };
});

// Handler for listing resource templates
server.setRequestHandler('resources/templates/list', async () => {
  return {
    resourceTemplates: RESOURCE_TEMPLATES
  };
});

// Handler for reading resource content
server.setRequestHandler('resources/read', async (request) => {
  const { uri } = request.params;
  
  try {
    // Handle static resources
    if (uri === 'project://readme') {
      const content = await readFile(join(__dirname, '../../README.md'), 'utf-8');
      return {
        contents: [{
          uri,
          mimeType: 'text/markdown',
          text: content
        }]
      };
    }
    
    if (uri === 'config://package.json') {
      const content = await readFile(join(__dirname, '../../package.json'), 'utf-8');
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: content
        }]
      };
    }
    
    if (uri === 'config://tsconfig.json') {
      try {
        const content = await readFile(join(__dirname, '../../tsconfig.json'), 'utf-8');
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: content
          }]
        };
      } catch (error) {
        throw new Error('tsconfig.json not found');
      }
    }
    
    if (uri === 'example://sample-data') {
      const sampleData = {
        message: 'This is sample data from the MCP resource server',
        timestamp: new Date().toISOString(),
        capabilities: ['resources', 'resource-templates'],
        metadata: {
          server: 'example-resource-server',
          version: '1.0.0'
        }
      };
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(sampleData, null, 2)
        }]
      };
    }
    
    // Handle template-based resources
    if (uri.startsWith('file:///')) {
      const filePath = uri.slice('file:///'.length);
      const resolvedPath = resolve(filePath);
      const content = await readFile(resolvedPath, 'utf-8');
      return {
        contents: [{
          uri,
          mimeType: 'text/plain',
          text: content
        }]
      };
    }
    
    if (uri.startsWith('env:///')) {
      const envName = uri.slice('env:///'.length);
      const value = process.env[envName];
      if (value === undefined) {
        throw new Error(`Environment variable '${envName}' not found`);
      }
      return {
        contents: [{
          uri,
          mimeType: 'text/plain',
          text: value
        }]
      };
    }
    
    throw new Error(`Unknown resource: ${uri}`);
  } catch (error) {
    throw new Error(`Failed to read resource: ${error.message}`);
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Example MCP Resource Server started');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});