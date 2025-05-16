/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { FunctionDeclaration } from '@google/genai';
import { Tool, ToolResult, BaseTool } from './tools.js';
import { Config } from '../config/config.js';
import { spawn, execSync } from 'node:child_process';
// TODO: remove this dependency once MCP support is built into genai SDK
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
type ToolParams = Record<string, unknown>;

export class DiscoveredTool extends BaseTool<ToolParams, ToolResult> {
  constructor(
    private readonly config: Config,
    readonly name: string,
    description: string,
    readonly parameterSchema: Record<string, unknown>,
  ) {
    const discoveryCmd = config.getToolDiscoveryCommand()!;
    const callCommand = config.getToolCallCommand()!;
    description += `

This tool was discovered from the project by executing the command \`${discoveryCmd}\` on project root.
When called, this tool will execute the command \`${callCommand} ${name}\` on project root.
Tool discovery and call commands can be configured in project settings.

When called, the tool call command is executed as a subprocess.
On success, tool output is returned as a json string.
Otherwise, the following information is returned:

Stdout: Output on stdout stream. Can be \`(empty)\` or partial.
Stderr: Output on stderr stream. Can be \`(empty)\` or partial.
Error: Error or \`(none)\` if no error was reported for the subprocess.
Exit Code: Exit code or \`(none)\` if terminated by signal.
Signal: Signal number or \`(none)\` if no signal was received.
`;
    super(name, name, description, parameterSchema);
  }

  async execute(params: ToolParams): Promise<ToolResult> {
    const callCommand = this.config.getToolCallCommand()!;
    const child = spawn(callCommand, [this.name]);
    child.stdin.write(JSON.stringify(params));
    child.stdin.end();
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    let error: Error | null = null;
    child.on('error', (err: Error) => {
      error = err;
    });
    let code: number | null = null;
    let signal: NodeJS.Signals | null = null;
    child.on(
      'close',
      (_code: number | null, _signal: NodeJS.Signals | null) => {
        code = _code;
        signal = _signal;
      },
    );
    await new Promise((resolve) => child.on('close', resolve));

    // if there is any error, non-zero exit code, signal, or stderr, return error details instead of stdout
    if (error || code !== 0 || signal || stderr) {
      const llmContent = [
        `Stdout: ${stdout || '(empty)'}`,
        `Stderr: ${stderr || '(empty)'}`,
        `Error: ${error ?? '(none)'}`,
        `Exit Code: ${code ?? '(none)'}`,
        `Signal: ${signal ?? '(none)'}`,
      ].join('\n'); // This should be a literal for LLM, but display might interpret it. Let's keep as is from original.
      return {
        llmContent,
        returnDisplay: llmContent,
      };
    }

    return {
      llmContent: stdout,
      returnDisplay: stdout,
    };
  }
}

export class DiscoveredMCPTool extends BaseTool<ToolParams, ToolResult> {
  constructor(
    private readonly mcpClient: Client,
    readonly name: string,
    descriptionFromDiscovery: string,
    readonly parameterSchema: Record<string, unknown>,
    commandStringForDescription: string, // e.g., "my-mcp-server --port 1234"
  ) {
    let fullDescription = descriptionFromDiscovery;

    // Append to the existing description
    fullDescription += `\n
This MCP tool was discovered from a local MCP server using JSON RPC 2.0 over stdio transport protocol.
The MCP server was started by executing the command \`${commandStringForDescription || 'N/A'}\` on project root.
When called, this tool will invoke the \`tools/call\` method for tool name \`${name}\`.
MCP server command can be configured in project settings.
Returns the MCP server response as a json string.
`;
    super(name, name, fullDescription, parameterSchema);
  }

  async execute(params: ToolParams): Promise<ToolResult> {
    const result = await this.mcpClient.callTool({
      name: this.name,
      arguments: params,
    });
    return {
      llmContent: JSON.stringify(result, null, 2),
      returnDisplay: JSON.stringify(result, null, 2),
    };
  }
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  // Store multiple MCP clients, keyed by a unique server identifier (e.g., server name from config)
  private mcpClients: Map<string, Client> = new Map();

  constructor(private readonly config: Config) {}

  /**
   * Registers a tool definition.
   * @param tool - The tool object containing schema and execution logic.
   */
  registerTool(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      // Decide on behavior: throw error, log warning, or allow overwrite
      console.warn(
        `Tool with name "${tool.name}" is already registered. Overwriting.`,
      );
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Discovers tools from project, if a discovery command is configured.
   * Can be called multiple times to update discovered tools.
   */
  discoverTools(): void {
    // remove any previously discovered tools (both non-MCP and MCP)
    const toolsToDelete: string[] = [];
    for (const [name, tool] of this.tools.entries()) {
      if (tool instanceof DiscoveredTool || tool instanceof DiscoveredMCPTool) {
        toolsToDelete.push(name);
      }
    }
    for (const name of toolsToDelete) {
      this.tools.delete(name);
    }

    // Dispose and clear any existing MCP clients before rediscovery
    this.mcpClients.forEach((client) => client.close());
    this.mcpClients.clear();

    // discover tools using discovery command, if configured (non-MCP)
    const discoveryCmd = this.config.getToolDiscoveryCommand();
    if (discoveryCmd) {
      try {
        // execute discovery command and extract function declarations
        const functions: FunctionDeclaration[] = [];
        // Assuming the command outputs a JSON array where each item has a 'function_declarations' key
        const discoveryOutput = JSON.parse(
          execSync(discoveryCmd).toString().trim(),
        );
        if (Array.isArray(discoveryOutput)) {
          for (const item of discoveryOutput) {
            if (item && Array.isArray(item['function_declarations'])) {
              functions.push(...item['function_declarations']);
            }
          }
        }
        // register each function as a tool
        for (const func of functions) {
          this.registerTool(
            new DiscoveredTool(
              this.config,
              func.name!,
              func.description!,
              func.parameters! as Record<string, unknown>,
            ),
          );
        }
      } catch (error) {
        console.error(
          `Error during non-MCP tool discovery using command '${discoveryCmd}':\n${error}`,
        );
      }
    }

    // discover tools using MCP server configurations
    const mcpServers = this.config.getMcpServers();
    if (mcpServers) {
      Object.entries(mcpServers).forEach(([serverName, serverConfig]) => {
        // This IIFE is used because discoverTools is synchronous, but MCP client setup is async.
        (async () => {
          const { command: commandToExecute, args: commandArgs } = serverConfig;
          const displayCommand =
            commandToExecute + (commandArgs ? ' ' + commandArgs.join(' ') : '');

          try {
            const client = new Client({
              name: `mcp-client-${serverName}`, // Unique name for the client
              version: '0.0.1',
            });
            const transport = new StdioClientTransport({
              command: commandToExecute,
              args: commandArgs,
              stderr: 'pipe', // Capture stderr
            });

            // It's important to connect the client before trying to use it.
            await client.connect(transport);
            this.mcpClients.set(serverName, client); // Store the connected client

            client.onerror = (error) => {
              console.error(
                `MCP Client Error (${serverName} - ${displayCommand}):`,
                error.toString(),
              );
            };

            if (!transport.stderr) {
              // This case should ideally not happen if stderr: 'pipe' is effective and transport initializes correctly.
              console.warn(
                `MCP Transport for ${serverName} (${displayCommand}) missing stderr stream.`,
              );
            } else {
              transport.stderr.on('data', (data) => {
                const stderrStr = data.toString();
                // filter out INFO messages logged for each request received by some MCP servers
                if (
                  !stderrStr.includes('] INFO') &&
                  !stderrStr.includes('INF')
                ) {
                  // Basic filtering
                  console.log(
                    `MCP STDERR (${serverName} - ${displayCommand}):`,
                    stderrStr.trim(),
                  );
                }
              });
            }

            const result = await client.listTools();
            for (const tool of result.tools) {
              this.registerTool(
                new DiscoveredMCPTool(
                  client, // Pass the specific client for this server
                  tool.name,
                  tool.description ?? '', // Use description from discovery
                  tool.inputSchema,
                  displayCommand, // Pass the command string for this server
                ),
              );
            }
            console.log(
              `Successfully discovered tools from MCP server: ${serverName} (${displayCommand})`,
            );
          } catch (error) {
            console.error(
              `Failed to start, connect, or discover tools from MCP server '${serverName}' using command '${displayCommand}': \n${error}`,
            );
            // If connection failed, ensure this client isn't kept or is disposed if already added
            const existingClient = this.mcpClients.get(serverName);
            if (existingClient) {
              existingClient.close(); // Dispose if client object was created
              this.mcpClients.delete(serverName); // Remove from map
            }
          }
        })();
      });
    }
  }

  /**
   * Retrieves the list of tool schemas (FunctionDeclaration array).
   * Extracts the declarations from the ToolListUnion structure.
   * Includes discovered (vs registered) tools if configured.
   * @returns An array of FunctionDeclarations.
   */
  getFunctionDeclarations(): FunctionDeclaration[] {
    const declarations: FunctionDeclaration[] = [];
    this.tools.forEach((tool) => {
      declarations.push(tool.schema);
    });
    return declarations;
  }

  /**
   * Returns an array of all registered and discovered tool instances.
   */
  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get the definition of a specific tool.
   */
  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }
}
