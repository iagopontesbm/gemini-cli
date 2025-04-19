/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Removed fs, path imports as core logic is moved
// Import core logic and types from the server package
import {
  ReadFileLogic,
  ReadFileToolParams,
  ToolResult,
  // Import other necessary types like BaseTool if the CLI wrapper still needs them directly
  // For now, assuming the core logic handles everything needed from BaseTool
} from '@gemini-code/server';

// Import CLI-specific base class and types
import { BaseTool } from './tools.js'; // Keep CLI BaseTool for confirmation
import { ToolCallConfirmationDetails } from '../ui/types.js';

/**
 * CLI wrapper for the ReadFile tool
 */
export class ReadFileTool extends BaseTool<ReadFileToolParams, ToolResult> {
  static readonly Name: string = ReadFileLogic.Name; // Use name from logic

  // Core logic instance from the server package
  private coreLogic: ReadFileLogic;

  /**
   * Creates a new instance of the ReadFileTool CLI wrapper
   * @param rootDirectory Root directory to ground this tool in.
   */
  constructor(rootDirectory: string) {
    // Instantiate the core logic from the server package
    const coreLogicInstance = new ReadFileLogic(rootDirectory);

    // Initialize the CLI BaseTool with display name, description, and schema from core logic
    super(
      ReadFileTool.Name,
      'ReadFile', // Define display name here
      'Reads and returns the content of a specified file from the local filesystem. Handles large files by allowing reading specific line ranges.', // Define description here
      (coreLogicInstance.schema.parameters as Record<string, unknown>) ?? {},
    );

    this.coreLogic = coreLogicInstance;
  }

  /**
   * Delegates validation to the core logic
   */
  validateToolParams(params: ReadFileToolParams): string | null {
    return this.coreLogic.validateToolParams(params);
  }

  /**
   * Delegates getting description to the core logic
   */
  getDescription(params: ReadFileToolParams): string {
    return this.coreLogic.getDescription(params);
  }

  /**
   * Define confirmation behavior here in the CLI wrapper if needed
   * For ReadFile, we likely don't need confirmation.
   */
  shouldConfirmExecute(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    params: ReadFileToolParams,
  ): Promise<ToolCallConfirmationDetails | false> {
    // Example: Potentially confirm if reading a very large file?
    // For now, default to no confirmation.
    return Promise.resolve(false);
  }

  /**
   * Delegates execution to the core logic
   */
  async execute(params: ReadFileToolParams): Promise<ToolResult> {
    return this.coreLogic.execute(params);
  }

  // Removed private methods (isWithinRoot, isBinaryFile, detectFileType)
  // as they are now part of ReadFileLogic in the server package
}
