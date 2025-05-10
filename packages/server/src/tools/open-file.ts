/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { Config } from '../config/config.js';
import {
  BaseTool,
  ToolResult,
  ToolCallConfirmationDetails,
  ToolExecuteConfirmationDetails,
  ToolConfirmationOutcome,
} from './tools.js';
import { SchemaValidator } from '../utils/schemaValidator.js';
import { spawn } from 'child_process';

export interface OpenFileToolParams {
  filePath: string;
}

export class OpenFileTool extends BaseTool<OpenFileToolParams, ToolResult> {
  static Name: string = 'open_file';

  constructor(private readonly config: Config) {
    const toolDisplayName = 'Open File';
    const toolDescription =
      'Opens the specified file in the default local text editor.';
    const toolParameterSchema = {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'The absolute path to the file to open.',
        },
      },
      required: ['filePath'],
    };
    super(
      OpenFileTool.Name,
      toolDisplayName,
      toolDescription,
      toolParameterSchema,
    );
  }

  getDescription(params: OpenFileToolParams): string {
    return `open ${params.filePath}`;
  }

  validateToolParams(params: OpenFileToolParams): string | null {
    if (
      !SchemaValidator.validate(
        this.parameterSchema as Record<string, unknown>,
        params,
      )
    ) {
      return 'Parameters failed schema validation.';
    }
    if (!params.filePath.trim()) {
      return 'File path cannot be empty.';
    }
    if (!path.isAbsolute(params.filePath)) {
      return 'File path must be absolute.';
    }
    // To ensure the tool is more robust, check if the file exists.
    if (!fs.existsSync(params.filePath)) {
      return `File not found: ${params.filePath}`;
    }
    // Also check if it's a file and not a directory.
    if (!fs.statSync(params.filePath).isFile()) {
      return `Path is a directory, not a file: ${params.filePath}`;
    }

    return null;
  }

  async shouldConfirmExecute(
    params: OpenFileToolParams,
  ): Promise<ToolCallConfirmationDetails | false> {
    const validationError = this.validateToolParams(params);
    if (validationError) {
      // If validation fails, we don't proceed to confirmation.
      // The execute method will also call validateToolParams and return an error.
      return false;
    }

    const confirmationDetails: ToolExecuteConfirmationDetails = {
      title: 'Confirm Open File',
      command: `open "${params.filePath}"`, // Command displayed to the user
      rootCommand: 'open', // The base command for permission handling (if any)
      onConfirm: async (_outcome: ToolConfirmationOutcome) => {
        // Handle "always allow" if we add that feature. For now, it does nothing specific.
      },
    };
    return confirmationDetails;
  }

  async execute(params: OpenFileToolParams): Promise<ToolResult> {
    const validationError = this.validateToolParams(params);
    if (validationError) {
      return {
        llmContent: [
          `Command rejected: open "${params.filePath}"`, // Use quotes for consistency
          `Reason: ${validationError}`,
        ].join('\n'),
        returnDisplay: `Error: ${validationError}`,
      };
    }

    return new Promise((resolve) => {
      let command: string;
      let args: string[];

      if (process.platform === 'win32') {
        command = 'cmd'; // Using 'cmd' to ensure 'start' is available
        // Using /c to execute the command and then terminate.
        // The empty string "" as the first argument to start is a common practice
        // to handle paths with spaces correctly, as 'start' can interpret
        // the first quoted argument as a window title.
        args = ['/c', 'start', '""', params.filePath];
      } else if (process.platform === 'darwin') {
        command = 'open';
        args = [params.filePath];
      } else {
        resolve({
          llmContent: `Unsupported platform: ${process.platform}. Cannot open file.`,
          returnDisplay: `Error: Unsupported platform ${process.platform}.`,
        });
        return;
      }

      const childProcess = spawn(command, args, {
        detached: true,
        stdio: 'ignore',
        // For Windows, if 'start' is used directly (not via 'cmd /c'),
        // and if it still has issues, 'shell: true' might be considered,
        // but it's generally less secure and direct 'cmd /c start' is preferred.
      });

      childProcess.on('error', (err) => {
        // This typically means the command itself (e.g., 'cmd' or 'open') could not be spawned.
        resolve({
          llmContent: `Error spawning '${command}' for ${params.filePath}: ${err.message}`,
          returnDisplay: `Failed to initiate open command: ${err.message}. Ensure '${command}' is in your PATH.`,
        });
      });

      childProcess.on('close', (code) => {
        // For 'open' on macOS, a 0 exit code means it successfully dispatched.
        // For 'cmd /c start' on Windows, 'start' itself doesn't wait for the app to close.
        // If 'start' successfully launches the application, 'cmd' should exit with 0.
        // If 'start' fails (e.g., file not found, no association), it might print to stderr
        // and 'cmd' might return a non-zero code.
        if (code === 0) {
          resolve({
            llmContent: `Successfully requested to open ${params.filePath} using '${command}'.`,
            returnDisplay: `Request to open ${params.filePath} sent.`,
          });
        } else {
          // This path might be taken if 'start' itself fails or if 'open' fails.
          resolve({
            llmContent: `'${command} ${args.join(' ')}' command exited with code ${code}.`,
            returnDisplay: `Could not open file. The command exited with code ${code}.`,
          });
        }
      });
    });
  }
}
