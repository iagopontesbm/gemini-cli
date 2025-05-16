/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ToolRegistry,
  DiscoveredTool,
  DiscoveredMCPTool,
} from './tool-registry.js';
import { Config as OriginalConfig } from '../config/config.js';
import { FunctionDeclaration, Schema, Type } from '@google/genai';
import { Client as MCPClientOriginal } from '@modelcontextprotocol/sdk/client/index.js';
import { EventEmitter } from 'node:events';
import * as child_process from 'node:child_process'; // Import to access mocked functions

// Mock child_process: define mocks inside the factory
vi.mock('node:child_process', async (importOriginal) => {
  const actual_child_process = (await importOriginal()) as typeof child_process;
  return {
    ...actual_child_process, // Spread actual module to keep other exports intact
    spawn: vi.fn(),
    execSync: vi.fn(),
  };
});

// Mock Config
const mockGetToolDiscoveryCommand = vi.fn();
const mockGetToolCallCommand = vi.fn();
const mockGetMcpServers = vi.fn();

vi.mock('../config/config.js', () => ({
  Config: vi.fn().mockImplementation(() => ({
    getToolDiscoveryCommand: mockGetToolDiscoveryCommand,
    getToolCallCommand: mockGetToolCallCommand,
    getMcpServers: mockGetMcpServers,
  })),
}));

const MockedMCPClientProto = {
  connect: vi.fn(),
  listTools: vi.fn(),
  callTool: vi.fn(),
  close: vi.fn(),
  onerror: vi.fn(),
};
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => MockedMCPClientProto),
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => {
  const StdioClientTransport = vi.fn().mockImplementation(() => ({
    stderr: new EventEmitter(), // Ensure stderr is on the instance
  }));
  return { StdioClientTransport };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Config = OriginalConfig as any; // Use 'any' for simplicity in test setup
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MCPClient = MCPClientOriginal as any; // Use 'any' for simplicity

// Cast the imported child_process functions to any for use in tests
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockedSpawn = child_process.spawn as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockedExecSync = child_process.execSync as any;

describe('ToolRegistry', () => {
  let mockConfigInstance: OriginalConfig;

  beforeEach(() => {
    mockConfigInstance = new Config();
    // Reset all externally defined mock functions and mocked module functions
    mockGetToolDiscoveryCommand.mockReset();
    mockGetToolCallCommand.mockReset();
    mockGetMcpServers.mockReset();
    mockedSpawn.mockReset();
    mockedExecSync.mockReset();
    MockedMCPClientProto.connect.mockReset();
    MockedMCPClientProto.listTools.mockReset();
    MockedMCPClientProto.callTool.mockReset();
    MockedMCPClientProto.close.mockReset();
    // Clear calls for the MCPClient constructor mock itself
    if (vi.isMockFunction(MCPClient)) {
      MCPClient.mockClear();
    }
  });

  describe('DiscoveredTool', () => {
    const toolName = 'test-tool';
    const toolDescription = 'A test tool';
    const toolParams: Schema = {
      type: Type.OBJECT,
      properties: { param1: { type: Type.STRING } },
    };
    const discoveryCommand = 'discover';
    const callCommand = 'call';

    beforeEach(() => {
      mockGetToolDiscoveryCommand.mockReturnValue(discoveryCommand);
      mockGetToolCallCommand.mockReturnValue(callCommand);
    });

    it('should construct with correct schema and description', () => {
      const tool = new DiscoveredTool(
        mockConfigInstance,
        toolName,
        toolDescription,
        toolParams as Record<string, unknown>,
      );
      expect(tool.name).toBe(toolName);
      expect(tool.schema.name).toBe(toolName);
      expect(tool.schema.description).toContain(toolDescription);
      expect(tool.schema.description).toContain(discoveryCommand);
      expect(tool.schema.description).toContain(callCommand);
      expect(tool.schema.parameters).toEqual(toolParams);
    });

    it('execute should call spawn with correct params and return stdout on success', async () => {
      const tool = new DiscoveredTool(
        mockConfigInstance,
        toolName,
        toolDescription,
        toolParams as Record<string, unknown>,
      );
      const mockChildEmitter = new EventEmitter();
      const mockChildProcess = {
        stdin: { write: vi.fn(), end: vi.fn() },
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        on: vi.fn((event, cb) => {
          mockChildEmitter.on(event, cb);
          return mockChildProcess;
        }),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockedSpawn.mockReturnValue(mockChildProcess as any);
      const executeParams = { param1: 'value1' };
      const promise = tool.execute(executeParams);
      mockChildProcess.stdout.emit('data', 'output data');
      mockChildEmitter.emit('close', 0, null); // Simulate process close with success code
      const result = await promise;
      expect(mockedSpawn).toHaveBeenCalledWith(callCommand, [toolName]);
      expect(mockChildProcess.stdin.write).toHaveBeenCalledWith(
        JSON.stringify(executeParams),
      );
      expect(result.llmContent).toBe('output data');
      expect(result.returnDisplay).toBe('output data');
    });

    it('execute should return error details on non-zero exit code', async () => {
      const tool = new DiscoveredTool(
        mockConfigInstance,
        toolName,
        toolDescription,
        toolParams as Record<string, unknown>,
      );
      const mockChildEmitter = new EventEmitter();
      const mockChildProcess = {
        stdin: { write: vi.fn(), end: vi.fn() },
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        on: vi.fn((event, cb) => {
          if (event === 'close' || event === 'error') {
            mockChildEmitter.on(event, cb);
          }
          return mockChildProcess;
        }),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockedSpawn.mockReturnValue(mockChildProcess as any);
      const executePromise = tool.execute({});
      mockChildProcess.stderr.emit('data', 'error data');
      await new Promise((resolve) => setTimeout(resolve, 0));
      mockChildEmitter.emit('close', 1, null);
      const result = await executePromise;
      expect(result.llmContent).toContain('Stderr: error data');
      expect(result.llmContent).toContain('Exit Code: 1');
    });
  });

  describe('DiscoveredMCPTool', () => {
    let mockMcpClientInstance: MCPClientOriginal;
    const toolName = 'mcp-tool';
    const toolDescription = 'An MCP test tool';
    const toolParams: Schema = {
      type: Type.OBJECT,
      properties: { mcp_param: { type: Type.NUMBER } },
    };
    const serverCommand = 'mcp-server --port 1234';

    beforeEach(() => {
      mockMcpClientInstance = new MCPClient({
        name: 'test-mcp-client',
        version: '0.0.1',
      });
    });

    it('should construct with correct schema and description', () => {
      const tool = new DiscoveredMCPTool(
        mockMcpClientInstance,
        toolName,
        toolDescription,
        toolParams as Record<string, unknown>,
        serverCommand,
      );
      expect(tool.name).toBe(toolName);
      expect(tool.schema.name).toBe(toolName);
      expect(tool.schema.description).toContain(toolDescription);
      expect(tool.schema.description).toContain(serverCommand);
      expect(tool.schema.parameters).toEqual(toolParams);
    });

    it('execute should call mcpClient.callTool and return result', async () => {
      const tool = new DiscoveredMCPTool(
        mockMcpClientInstance,
        toolName,
        toolDescription,
        toolParams as Record<string, unknown>,
        serverCommand,
      );
      const callToolResponse = { success: true, data: 'mcp data' };
      MockedMCPClientProto.callTool.mockResolvedValue(callToolResponse);
      const executeParams = { mcp_param: 123 };
      const result = await tool.execute(executeParams);
      expect(MockedMCPClientProto.callTool).toHaveBeenCalledWith({
        name: toolName,
        arguments: executeParams,
      });
      expect(result.llmContent).toBe(JSON.stringify(callToolResponse, null, 2));
      expect(result.returnDisplay).toBe(
        JSON.stringify(callToolResponse, null, 2),
      );
    });
  });

  describe('ToolRegistry Core', () => {
    let registry: ToolRegistry;
    beforeEach(() => {
      registry = new ToolRegistry(mockConfigInstance);
      if (vi.isMockFunction(MCPClient)) {
        MCPClient.mockClear();
      }
    });

    it('should register and get a tool', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockTool = {
        name: 'manual-tool',
        schema: { name: 'manual-tool' } as FunctionDeclaration,
      } as any;
      registry.registerTool(mockTool);
      expect(registry.getTool('manual-tool')).toBe(mockTool);
      expect(registry.getAllTools()).toContain(mockTool);
      expect(registry.getFunctionDeclarations()).toEqual([mockTool.schema]);
    });

    it('should overwrite a tool if registered with the same name', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockTool1 = {
        name: 'same-name-tool',
        schema: {
          name: 'same-name-tool',
          description: 'v1',
        } as FunctionDeclaration,
      } as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockTool2 = {
        name: 'same-name-tool',
        schema: {
          name: 'same-name-tool',
          description: 'v2',
        } as FunctionDeclaration,
      } as any;
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});
      registry.registerTool(mockTool1);
      registry.registerTool(mockTool2);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Tool with name "same-name-tool" is already registered. Overwriting.',
      );
      expect(registry.getTool('same-name-tool')).toBe(mockTool2);
      expect(registry.getAllTools().length).toBe(1);
      consoleWarnSpy.mockRestore();
    });

    describe('discoverTools - Non-MCP', () => {
      const discoveryCmd = 'my-discovery-script';
      const callCmd = 'my-call-script';
      beforeEach(() => {
        mockGetToolDiscoveryCommand.mockReturnValue(discoveryCmd);
        mockGetToolCallCommand.mockReturnValue(callCmd);
        mockGetMcpServers.mockReturnValue(null);
      });

      it('should discover and register tools from discovery command', () => {
        const discoveredFunctions: FunctionDeclaration[] = [
          {
            name: 'discovered-tool-1',
            description: 'Desc 1',
            parameters: { type: Type.OBJECT, properties: {} },
          },
          {
            name: 'discovered-tool-2',
            description: 'Desc 2',
            parameters: { type: Type.OBJECT, properties: {} },
          },
        ];
        mockedExecSync.mockReturnValue(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          JSON.stringify([
            { function_declarations: discoveredFunctions },
          ]) as any,
        );
        registry.discoverTools();
        expect(mockedExecSync).toHaveBeenCalledWith(discoveryCmd);
        const tools = registry.getAllTools();
        expect(tools.length).toBe(2);
        expect(tools[0].name).toBe('discovered-tool-1');
        expect(tools[0]).toBeInstanceOf(DiscoveredTool);
        expect(tools[1].name).toBe('discovered-tool-2');
        expect(tools[1]).toBeInstanceOf(DiscoveredTool);
      });

      it('should remove previously discovered non-MCP tools before new discovery', () => {
        mockedExecSync.mockReturnValue(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          JSON.stringify([
            {
              function_declarations: [
                {
                  name: 'old-tool',
                  description: 'Old',
                  parameters: { type: Type.OBJECT, properties: {} },
                },
              ],
            },
          ]) as any,
        );
        registry.discoverTools();
        expect(registry.getTool('old-tool')).toBeDefined();
        mockedExecSync.mockReturnValue(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          JSON.stringify([
            {
              function_declarations: [
                {
                  name: 'new-tool',
                  description: 'New',
                  parameters: { type: Type.OBJECT, properties: {} },
                },
              ],
            },
          ]) as any,
        );
        registry.discoverTools();
        expect(registry.getTool('old-tool')).toBeUndefined();
        expect(registry.getTool('new-tool')).toBeDefined();
        expect(registry.getAllTools().length).toBe(1);
      });

      it('should handle errors during non-MCP discovery', () => {
        mockedExecSync.mockImplementation(() => {
          throw new Error('Discovery failed');
        });
        const consoleErrorSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {});
        registry.discoverTools();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            `Error during non-MCP tool discovery using command '${discoveryCmd}'`,
          ),
        );
        expect(registry.getAllTools().length).toBe(0);
        consoleErrorSpy.mockRestore();
      });
    });

    describe('discoverTools - MCP', () => {
      const mcpServerConfig = {
        server1: { command: 'mcp-server-1', args: ['--port', '8080'] },
      };
      const mcpToolList = {
        tools: [
          {
            name: 'mcp-discovered-tool-1',
            description: 'MCP Desc 1',
            inputSchema: { type: Type.OBJECT } as Schema,
          },
        ],
      };

      beforeEach(() => {
        if (vi.isMockFunction(MCPClient)) {
          MCPClient.mockClear();
        }
        mockGetToolDiscoveryCommand.mockReturnValue(null);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockGetMcpServers.mockReturnValue(mcpServerConfig as any);
        MockedMCPClientProto.connect.mockResolvedValue(undefined);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        MockedMCPClientProto.listTools.mockResolvedValue(mcpToolList as any);
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
      });

      it('should discover and register tools from MCP servers', async () => {
        registry.discoverTools();
        await vi.advanceTimersToNextTimerAsync();
        await vi.advanceTimersToNextTimerAsync();
        const tools = registry.getAllTools();
        expect(MCPClient).toHaveBeenCalledTimes(1);
        expect(MockedMCPClientProto.connect).toHaveBeenCalledTimes(1);
        expect(MockedMCPClientProto.listTools).toHaveBeenCalledTimes(1);
        expect(tools.length).toBe(1);
        expect(tools[0].name).toBe('mcp-discovered-tool-1');
        expect(tools[0]).toBeInstanceOf(DiscoveredMCPTool);
        expect(tools[0].schema.description).toContain(
          'mcp-server-1 --port 8080',
        );
      });

      it('should remove previously discovered MCP tools and close clients before new discovery', async () => {
        registry.discoverTools();
        await vi.advanceTimersToNextTimerAsync();
        await vi.advanceTimersToNextTimerAsync();
        expect(registry.getTool('mcp-discovered-tool-1')).toBeDefined();
        expect(MCPClient).toHaveBeenCalledTimes(1);
        MockedMCPClientProto.close.mockClear();

        const newMcpToolList = {
          tools: [
            {
              name: 'new-mcp-tool',
              description: 'New MCP',
              inputSchema: { type: Type.OBJECT } as Schema,
            },
          ],
        };
        MockedMCPClientProto.listTools.mockResolvedValueOnce(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          newMcpToolList as any,
        );
        if (vi.isMockFunction(MCPClient)) {
          MCPClient.mockClear();
        }
        MockedMCPClientProto.connect.mockClear();
        MockedMCPClientProto.listTools.mockClear();

        registry.discoverTools();
        await vi.advanceTimersToNextTimerAsync();
        await vi.advanceTimersToNextTimerAsync();

        expect(MockedMCPClientProto.close).toHaveBeenCalledTimes(1);
        expect(MCPClient).toHaveBeenCalledTimes(1);
        expect(registry.getTool('mcp-discovered-tool-1')).toBeUndefined();
        expect(registry.getTool('new-mcp-tool')).toBeDefined();
        expect(registry.getAllTools().length).toBe(1);
      });

      it('should handle errors during MCP discovery (e.g., connection failure)', async () => {
        MockedMCPClientProto.connect.mockRejectedValueOnce(
          new Error('MCP Connection Failed'),
        );
        const consoleErrorSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {});
        registry.discoverTools();
        await vi.advanceTimersToNextTimerAsync();
        await vi.advanceTimersToNextTimerAsync();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            "Failed to start, connect, or discover tools from MCP server 'server1'",
          ),
        );
        expect(registry.getAllTools().length).toBe(0);
        consoleErrorSpy.mockRestore();
      });
    });
  });
});
