/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  Mocked,
} from 'vitest';
import { DiscoveredMCPTool } from './mcp-tool.js';
import { ToolResult } from './tools.js';
import { CallableTool, Part } from '@google/genai';

// Mock @google/genai mcpToTool and CallableTool
// We only need to mock the parts of CallableTool that DiscoveredMCPTool uses.
const mockCallTool = vi.fn();
const mockToolMethod = vi.fn();

const mockCallableToolInstance: Mocked<CallableTool> = {
  tool: mockToolMethod as any, // Not directly used by DiscoveredMCPTool instance methods
  callTool: mockCallTool as any,
  // Add other methods if DiscoveredMCPTool starts using them
};

describe('DiscoveredMCPTool', () => {
  const serverName = 'mock-mcp-server';
  const toolNameForModel = 'test-mcp-tool-for-model';
  const serverToolName = 'actual-server-tool-name';
  const baseDescription = 'A test MCP tool.';
  const inputSchema: Record<string, unknown> = {
    type: 'object' as const,
    properties: { param: { type: 'string' } },
    required: ['param'],
  }; // Use FunctionDeclaration['parameters'] type

  beforeEach(() => {
    mockCallTool.mockClear();
    mockToolMethod.mockClear(); // Though not used in these tests directly
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should set properties correctly and augment description', () => {
      const tool = new DiscoveredMCPTool(
        mockCallableToolInstance,
        serverName,
        toolNameForModel,
        baseDescription,
        inputSchema,
        serverToolName,
      );

      expect(tool.name).toBe(toolNameForModel);
      expect(tool.schema.name).toBe(toolNameForModel);
      expect(tool.schema.description).toContain(baseDescription);
      expect(tool.schema.description).toContain('This MCP tool was discovered');
      expect(tool.schema.description).toContain(`Server: '${serverName}'.`);
      expect(tool.schema.description).toContain(
        `Original tool name on server: \`${serverToolName}\``,
      );
      expect(tool.schema.parameters).toEqual(inputSchema);
      expect(tool.serverToolName).toBe(serverToolName);
      expect(tool.timeout).toBeUndefined(); // Timeout is now part of mcpServerConfig
    });

    it('should accept and store a custom timeout (passed from mcpServerConfig)', () => {
      const customTimeout = 5000;
      const tool = new DiscoveredMCPTool(
        mockCallableToolInstance,
        serverName,
        toolNameForModel,
        baseDescription,
        inputSchema,
        serverToolName,
        customTimeout, // This timeout is passed from MCPServerConfig
      );
      expect(tool.timeout).toBe(customTimeout);
    });
  });

  describe('execute', () => {
    it('should call mcpTool.callTool with correct parameters', async () => {
      const tool = new DiscoveredMCPTool(
        mockCallableToolInstance,
        serverName,
        toolNameForModel,
        baseDescription,
        inputSchema,
        serverToolName,
        // No explicit timeout here, assuming mcpTool handles it or gets from its own config
      );
      const params = { param: 'testValue' };
      const mockToolSuccessResult = { success: true, details: 'executed' };
      // response.content should be an array of actual Part objects, e.g., TextPart
      const mockFunctionResponseContent: Part[] = [
        { text: JSON.stringify(mockToolSuccessResult) },
      ];
      const mockMcpToolResponseParts: Part[] = [
        {
          functionResponse: {
            name: serverToolName, // The name of the function that was called
            response: {
              content: mockFunctionResponseContent,
            },
          },
        },
      ];
      mockCallTool.mockResolvedValue(mockMcpToolResponseParts);

      const toolResult: ToolResult = await tool.execute(params);

      expect(mockCallTool).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: serverToolName,
            args: params,
          }),
        ]),
      );

      // llmContent is now the raw Part[]
      expect(toolResult.llmContent).toEqual(mockMcpToolResponseParts);

      // returnDisplay should be the stringified version of the *content* of the functionResponse
      // Our getStringifiedResultForDisplay logic:
      // If one funcResponse, and its content is all text and only one text part, return that text.
      const expectedDisplayOutput = JSON.stringify(mockToolSuccessResult);
      expect(toolResult.returnDisplay).toBe(expectedDisplayOutput);
    });

    it('should propagate rejection if mcpTool.callTool rejects', async () => {
      const tool = new DiscoveredMCPTool(
        mockCallableToolInstance,
        serverName,
        toolNameForModel,
        baseDescription,
        inputSchema,
        serverToolName,
      );
      const params = { param: 'failCase' };
      const expectedError = new Error('MCP call failed');
      mockCallTool.mockRejectedValue(expectedError);

      await expect(tool.execute(params)).rejects.toThrow(expectedError);
    });
  });

  // Tests for shouldConfirmExecute can remain largely the same,
  // as they don't directly involve the mcpClient/mcpTool interaction details,
  // but rather the whitelisting logic and trust flag.
  describe('shouldConfirmExecute', () => {
    beforeEach(() => {
      // Clear whitelist before each confirmation test
      (DiscoveredMCPTool as any).whitelist.clear();
    });

    it('should return false if trust is true', async () => {
      const tool = new DiscoveredMCPTool(
        mockCallableToolInstance,
        serverName,
        toolNameForModel,
        baseDescription,
        inputSchema,
        serverToolName,
        undefined,
        true, // trust = true
      );
      expect(
        await tool.shouldConfirmExecute({}, new AbortController().signal),
      ).toBe(false);
    });

    it('should return false if server is whitelisted', async () => {
      (DiscoveredMCPTool as any).whitelist.add(serverName);
      const tool = new DiscoveredMCPTool(
        mockCallableToolInstance,
        serverName,
        toolNameForModel,
        baseDescription,
        inputSchema,
        serverToolName,
      );
      expect(
        await tool.shouldConfirmExecute({}, new AbortController().signal),
      ).toBe(false);
    });

    it('should return false if tool is whitelisted', async () => {
      const toolWhitelistKey = `${serverName}.${serverToolName}`;
      (DiscoveredMCPTool as any).whitelist.add(toolWhitelistKey);
      const tool = new DiscoveredMCPTool(
        mockCallableToolInstance,
        serverName,
        toolNameForModel,
        baseDescription,
        inputSchema,
        serverToolName,
      );
      expect(
        await tool.shouldConfirmExecute({}, new AbortController().signal),
      ).toBe(false);
    });

    it('should return confirmation details if not trusted and not whitelisted', async () => {
      const tool = new DiscoveredMCPTool(
        mockCallableToolInstance,
        serverName,
        toolNameForModel,
        baseDescription,
        inputSchema,
        serverToolName,
      );
      const confirmation = await tool.shouldConfirmExecute(
        {},
        new AbortController().signal,
      );
      expect(confirmation).not.toBe(false);
      if (confirmation) {
        expect(confirmation.type).toBe('mcp');
      }
    });
  });
});
