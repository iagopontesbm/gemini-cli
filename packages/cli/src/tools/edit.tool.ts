/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs'; // Needed for shouldConfirmExecute
import path from 'path'; // Needed for shouldConfirmExecute
// Import core logic and types from the server package
import {
  EditLogic,
  EditToolParams,
  ToolResult,
} from '@gemini-code/server';

// Import CLI-specific base class and UI types
import { BaseTool } from './tools.js';
import {
  ToolCallConfirmationDetails,
  ToolConfirmationOutcome,
  ToolEditConfirmationDetails,
} from '../ui/types.js';
import { makeRelative, shortenPath } from '../utils/paths.js'; // Keep for getDescription in wrapper
import * as Diff from 'diff'; // Keep diff import for shouldConfirmExecute diff generation
import { isNodeError } from '../utils/errors.js';

/**
 * CLI wrapper for the Edit tool.
 * Handles confirmation prompts and potentially UI-specific state like 'Always Edit'.
 */
export class EditTool extends BaseTool<EditToolParams, ToolResult> {
  static readonly Name: string = EditLogic.Name; // Use name from logic

  // Core logic instance from the server package
  private coreLogic: EditLogic;
  private shouldAlwaysEdit = false; // UI-specific state

  /**
   * Creates a new instance of the EditTool CLI wrapper
   * @param rootDirectory Root directory to ground this tool in.
   */
  constructor(rootDirectory: string) {
    // Instantiate the core logic from the server package
    const coreLogicInstance = new EditLogic(rootDirectory);

    // Initialize the CLI BaseTool
    // Note: The description references other tool *names*. If those change, this needs updating.
    super(
      EditTool.Name,
      'Edit', // Define display name here
      `Replaces a SINGLE, UNIQUE occurrence of text within a file. Requires providing significant context around the change to ensure uniqueness. For moving/renaming files, use the Bash tool with \`mv\`. For replacing entire file contents or creating new files use the WriteFile tool. Always use the ReadFile tool to examine the file before using this tool.`, // Define description here
      (coreLogicInstance.schema.parameters as Record<string, unknown>) ?? {},
    );

    this.coreLogic = coreLogicInstance;
  }

  /**
   * Delegates validation to the core logic
   */
  validateToolParams(params: EditToolParams): string | null {
    // Use the validation logic from the server package
    return this.coreLogic.validateParams(params);
  }

  /**
   * Delegates getting description to the core logic
   */
  getDescription(params: EditToolParams): string {
    // Use the description logic from the server package
    return this.coreLogic.getDescription(params);
  }

  /**
   * Handles the confirmation prompt for the Edit tool in the CLI.
   * It needs to calculate the diff to show the user.
   */
  async shouldConfirmExecute(
    params: EditToolParams,
  ): Promise<ToolCallConfirmationDetails | false> {
    if (this.shouldAlwaysEdit) {
      return false;
    }

    const validationError = this.validateToolParams(params);
    if (validationError) {
      console.error(
        `[EditTool Wrapper] Attempted confirmation with invalid parameters: ${validationError}`,
      );
      // Do not prompt for confirmation if params are invalid
      return false;
    }

    // Need to recalculate the edit to generate the diff for confirmation
    // This duplicates calculation from execute, but is necessary for the prompt.
    // We cannot directly use the logic from EditLogic.execute as it writes the file.

    let currentContent: string | null = null;
    let fileExists = false;
    let newContent = '';

    try {
      currentContent = fs.readFileSync(params.file_path, 'utf8');
      fileExists = true;
    } catch (err: unknown) {
      if (isNodeError(err) && err.code === 'ENOENT') {
        fileExists = false;
      } else {
        console.error(`Error reading file for confirmation diff: ${err}`);
        return false; // Don't confirm if we can't read the original file
      }
    }

    if (params.old_string === '' && !fileExists) {
      // Creating a new file
      newContent = params.new_string;
    } else if (!fileExists) {
      // Trying to edit non-existent file
      return false; // Cannot calculate diff, no confirmation
    } else if (currentContent !== null) {
      // Editing existing file - check occurrences
      const occurrences = this.coreLogic['countOccurrences'](
        currentContent,
        params.old_string,
      );
      const expectedReplacements =
        params.expected_replacements === undefined
          ? 1
          : params.expected_replacements;

      if (occurrences === 0 || occurrences !== expectedReplacements) {
        // No match or wrong number of matches - edit will fail, no confirmation needed
        return false;
      }
      newContent = this.coreLogic['replaceAll'](
        currentContent,
        params.old_string,
        params.new_string,
      );
    } else {
      return false; // Failed to read content
    }

    // If we got here, the edit is likely possible, generate diff
    const fileName = path.basename(params.file_path);
    const fileDiff = Diff.createPatch(
      fileName,
      currentContent ?? '',
      newContent,
      'Current',
      'Proposed',
      { context: 3 }, // Removed ignoreWhitespace for potentially more accurate display diff
    );

    const confirmationDetails: ToolEditConfirmationDetails = {
      title: `Confirm Edit: ${shortenPath(makeRelative(params.file_path, this.coreLogic['rootDirectory']))}`,
      fileName,
      fileDiff,
      onConfirm: async (outcome: ToolConfirmationOutcome) => {
        if (outcome === ToolConfirmationOutcome.ProceedAlways) {
          this.shouldAlwaysEdit = true;
        }
      },
    };
    return confirmationDetails;
  }

  /**
   * Delegates execution to the core logic
   */
  async execute(params: EditToolParams): Promise<ToolResult> {
    // The core logic handles the actual file writing and diff generation for the result
    return this.coreLogic.execute(params);
  }

  // Removed private methods (isWithinRoot, calculateEdit, countOccurrences, replaceAll, ensureParentDirectoriesExist)
  // as they are now part of EditLogic in the server package (except calculateEdit which is partially duplicated in shouldConfirmExecute).
}
