/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import * as Diff from 'diff';
import {
  BaseTool,
  ToolCallConfirmationDetails,
  ToolConfirmationOutcome,
  ToolEditConfirmationDetails,
  ToolResult,
  ToolResultDisplay,
} from './tools.js';
import { SchemaValidator } from '../utils/schemaValidator.js';
import { makeRelative, shortenPath } from '../utils/paths.js';
import { isNodeError } from '../utils/errors.js';
import { ReadFileTool } from './read-file.js';
import { GeminiClient } from '../core/client.js';
import { Config, ApprovalMode } from '../config/config.js';
import { ensureCorrectEdit } from '../utils/editCorrector.js';
import { DEFAULT_DIFF_OPTIONS } from './diffOptions.js';

/**
 * Parameters for the Edit tool
 */
export interface EditToolParams {
  /**
   * The absolute path to the file to modify
   */
  file_path: string;

  /**
   * Array of edits to apply (for batch operations)
   */
  edits?: Array<{
    old_string: string;
    new_string: string;
  }>;

  /**
   * The text to replace (for single edit - backward compatibility)
   */
  old_string?: string;

  /**
   * The text to replace it with (for single edit - backward compatibility)
   */
  new_string?: string;

  /**
   * Number of replacements expected. Defaults to 1 if not specified.
   * Use when you want to replace multiple occurrences.
   */
  expected_replacements?: number;

  /**
   * Content for create or overwrite modes
   */
  content?: string;

  /**
   * Edit mode: 'edit' (default), 'create', or 'overwrite'
   */
  mode?: 'edit' | 'create' | 'overwrite';
}

interface EditResult extends ToolResult {
  editsApplied: number;
  editsAttempted: number;
  editsFailed: number;
  failedEdits?: Array<{
    index: number;
    oldString: string;
    newString: string;
    error: string;
  }>;
  mode: string;
}

interface FailedEdit {
  index: number;
  oldString: string;
  newString: string;
  error: string;
}

/**
 * Implementation of the Edit tool logic
 */
export class EditTool extends BaseTool<EditToolParams, EditResult> {
  static readonly Name = 'edit';
  private readonly config: Config;
  private readonly rootDirectory: string;
  private readonly client: GeminiClient;

  /**
   * Creates a new instance of the EditLogic
   * @param rootDirectory Root directory to ground this tool in.
   */
  constructor(config: Config) {
    super(
      EditTool.Name,
      'Edit',
      `Replaces text within a file. By default, replaces a single occurrence, but can replace multiple occurrences when \`expected_replacements\` is specified. This tool requires providing significant context around the change to ensure precise targeting. Always use the ${ReadFileTool} tool to examine the file's current content before attempting a text replacement.

Expectation for required parameters:
1. \`file_path\` MUST be an absolute path; otherwise an error will be thrown.
2. \`old_string\` MUST be the exact literal text to replace (including all whitespace, indentation, newlines, and surrounding code etc.).
3. \`new_string\` MUST be the exact literal text to replace \`old_string\` with (also including all whitespace, indentation, newlines, and surrounding code etc.). Ensure the resulting code is correct and idiomatic.
4. NEVER escape \`old_string\` or \`new_string\`, that would break the exact literal text requirement.
**Important:** If ANY of the above are not satisfied, the tool will fail. CRITICAL for \`old_string\`: Must uniquely identify the single instance to change. Include at least 3 lines of context BEFORE and AFTER the target text, matching whitespace and indentation precisely. If this string matches multiple locations, or does not match exactly, the tool will fail.,
**Multiple replacements:** Set \`expected_replacements\` to the number of occurrences you want to replace. The tool will replace ALL occurrences that match \`old_string\` exactly. Ensure the number of replacements matches your expectation.`,
      {
        properties: {
          file_path: {
            description:
              "The absolute path to the file to modify. Must start with '/'.",
            type: 'string',
          },
          edits: {
            description:
              'Array of edit operations to apply. Each edit should have old_string and new_string properties.',
            type: 'array',
            items: {
              type: 'object',
              properties: {
                old_string: {
                  description:
                    'The exact literal text to replace, preferably unescaped. CRITICAL: Must uniquely identify the single instance to change. Include at least 3 lines of context BEFORE and AFTER the target text, matching whitespace and indentation precisely.',
                  type: 'string',
                },
                new_string: {
                  description:
                    'The exact literal text to replace `old_string` with, preferably unescaped. Provide the EXACT text. Ensure the resulting code is correct and idiomatic.',
                  type: 'string',
                },
              },
              required: ['old_string', 'new_string'],
            },
          },
          old_string: {
            description:
              'The exact literal text to replace (for single edit - backward compatibility). CRITICAL: Must uniquely identify the single instance to change. Include at least 3 lines of context BEFORE and AFTER the target text, matching whitespace and indentation precisely. For single replacements (default), include context. For multiple replacements, specify expected_replacements parameter. If this string is not the exact literal text (i.e. you escaped it), matches multiple locations, or does not match exactly, the tool will fail.',
            type: 'string',
          },
          new_string: {
            description:
              'The exact literal text to replace `old_string` with (for single edit - backward compatibility). Provide the EXACT text. Ensure the resulting code is correct and idiomatic.',
            type: 'string',
          },
          expected_replacements: {
            type: 'number',
            description:
              'Number of replacements expected. Defaults to 1 if not specified. Use when you want to replace multiple occurrences.',
            minimum: 1,
          },
          content: {
            description:
              'Content for create or overwrite modes. When mode is "create", this is the initial content for the new file. When mode is "overwrite", this replaces the entire file content.',
            type: 'string',
          },
          mode: {
            description:
              'Edit mode: "edit" (modify existing file), "create" (create new file), or "overwrite" (replace entire file content). Default is "edit".',
            type: 'string',
            enum: ['edit', 'create', 'overwrite'],
          },
        },
        required: ['file_path'],
        type: 'object',
      },
    );
    this.config = config;
    this.rootDirectory = path.resolve(this.config.getTargetDir());
    this.client = config.getGeminiClient();
  }

  /**
   * Checks if a path is within the root directory.
   * @param pathToCheck The absolute path to check.
   * @returns True if the path is within the root directory, false otherwise.
   */
  private isWithinRoot(pathToCheck: string): boolean {
    const normalizedPath = path.normalize(pathToCheck);
    const normalizedRoot = this.rootDirectory;
    const rootWithSep = normalizedRoot.endsWith(path.sep)
      ? normalizedRoot
      : normalizedRoot + path.sep;
    return (
      normalizedPath === normalizedRoot ||
      normalizedPath.startsWith(rootWithSep)
    );
  }

  /**
   * Validates the parameters for the Edit tool
   * @param params Parameters to validate
   * @returns Error message string or null if valid
   */
  validateToolParams(params: EditToolParams): string | null {
    if (
      this.schema.parameters &&
      !SchemaValidator.validate(
        this.schema.parameters as Record<string, unknown>,
        params,
      )
    ) {
      return 'Parameters failed schema validation.';
    }

    if (!path.isAbsolute(params.file_path)) {
      return `File path must be absolute: ${params.file_path}`;
    }

    if (!this.isWithinRoot(params.file_path)) {
      return `File path must be within the root directory (${this.rootDirectory}): ${params.file_path}`;
    }

    const mode = params.mode || 'edit';
    
    // Validate parameters based on mode
    if (mode === 'create' || mode === 'overwrite') {
      // For create/overwrite modes, we need either content parameter or edits array or old_string/new_string
      const hasContent = params.content !== undefined;
      const hasEditsArray = params.edits && params.edits.length > 0;
      const hasSingleEdit =
        params.old_string !== undefined && params.new_string !== undefined;

      if (!hasContent && !hasEditsArray && !hasSingleEdit) {
        return `For ${mode} mode, must provide either "content" parameter, "edits" array, or "old_string"/"new_string" pair.`;
      }
    } else {
      // For edit mode, we need either edits array or old_string/new_string pair
      const hasEditsArray = params.edits && params.edits.length > 0;
      const hasSingleEdit =
        params.old_string !== undefined && params.new_string !== undefined;

      if (!hasEditsArray && !hasSingleEdit) {
        return 'Must provide either "edits" array or "old_string"/"new_string" pair.';
      }
    }

    // If using single edit mode, ensure both old_string and new_string are provided
    if (params.old_string !== undefined && params.new_string === undefined) {
      return 'When "old_string" is provided, "new_string" must also be provided.';
    }
    if (params.new_string !== undefined && params.old_string === undefined) {
      return 'When "new_string" is provided, "old_string" must also be provided.';
    }

    return null;
  }

  private _applyReplacement(
    currentContent: string | null,
    oldString: string,
    newString: string,
    isNewFile: boolean,
  ): string {
    if (isNewFile) {
      return newString;
    }
    if (currentContent === null) {
      // Should not happen if not a new file, but defensively return empty or newString if oldString is also empty
      return oldString === '' ? newString : '';
    }
    // If oldString is empty and it's not a new file, do not modify the content.
    if (oldString === '' && !isNewFile) {
      return currentContent;
    }
    return currentContent.replaceAll(oldString, newString);
  }

  /**
   * Applies multiple edits to file content
   * @param params Parameters containing edits to apply
   * @param mode Edit mode (edit, create, overwrite)
   * @param abortSignal Abort signal for cancellation
   * @returns Result with detailed edit metrics
   */
  private async applyMultipleEdits(
    params: EditToolParams,
    mode: string,
    abortSignal: AbortSignal,
  ): Promise<{
    newContent: string;
    editsApplied: number;
    editsAttempted: number;
    editsFailed: number;
    failedEdits: FailedEdit[];
    isNewFile: boolean;
    originalContent: string | null;
  }> {
    // Handle content parameter for create/overwrite modes
    if ((mode === 'create' || mode === 'overwrite') && params.content !== undefined) {
      // For content-based creation/overwrite, we don't need to process edits
      let fileExists = false;
      try {
        fs.readFileSync(params.file_path, 'utf8');
        fileExists = true;
      } catch (err: unknown) {
        if (!isNodeError(err) || err.code !== 'ENOENT') {
          throw err;
        }
      }
      
      if (mode === 'create' && fileExists) {
        return {
          newContent: fileExists ? fs.readFileSync(params.file_path, 'utf8') : '',
          editsApplied: 0,
          editsAttempted: 1,
          editsFailed: 1,
          failedEdits: [{
            index: 0,
            oldString: '',
            newString: params.content,
            error: `File already exists: ${params.file_path}`
          }],
          isNewFile: false,
          originalContent: fileExists ? fs.readFileSync(params.file_path, 'utf8') : null,
        };
      }
      
      return {
        newContent: params.content,
        editsApplied: 1,
        editsAttempted: 1,
        editsFailed: 0,
        failedEdits: [],
        isNewFile: mode === 'create' || !fileExists,
        originalContent: fileExists ? fs.readFileSync(params.file_path, 'utf8') : null,
      };
    }

    // Normalize edits - convert single edit to array format
    const edits = [];
    if (params.edits && params.edits.length > 0) {
      edits.push(...params.edits);
    }
    if (params.old_string !== undefined && params.new_string !== undefined) {
      edits.push({
        old_string: params.old_string,
        new_string: params.new_string,
      });
    }

    const expectedReplacements = params.expected_replacements ?? 1;
    let currentContent: string | null = null;
    let fileExists = false;
    let isNewFile = false;

    // Read current file content
    try {
      currentContent = fs.readFileSync(params.file_path, 'utf8');
      fileExists = true;
    } catch (err: unknown) {
      if (!isNodeError(err) || err.code !== 'ENOENT') {
        throw err;
      }
    }

    // Handle different modes
    if (mode === 'create' && fileExists) {
      throw new Error(`File already exists: ${params.file_path}`);
    }
    if (mode === 'edit' && !fileExists) {
      throw new Error(`File does not exist: ${params.file_path}`);
    }
    if (mode === 'overwrite') {
      currentContent = '';
      isNewFile = true;
    }
    if (
      !fileExists &&
      (mode === 'create' || (edits.length === 1 && edits[0].old_string === ''))
    ) {
      isNewFile = true;
      currentContent = '';
    }

    const result = {
      newContent: currentContent || '',
      editsApplied: 0,
      editsAttempted: edits.length,
      editsFailed: 0,
      failedEdits: [] as FailedEdit[],
      isNewFile,
      originalContent: currentContent,
    };

    // Apply each edit
    for (let i = 0; i < edits.length; i++) {
      const edit = edits[i];

      if (isNewFile && edit.old_string === '') {
        // Creating new file with content
        result.newContent = edit.new_string;
        result.editsApplied++;
        continue;
      }

      // Use edit corrector for better matching
      try {
        const correctedEdit = await ensureCorrectEdit(
          result.newContent,
          {
            file_path: params.file_path,
            old_string: edit.old_string,
            new_string: edit.new_string,
            expected_replacements: params.expected_replacements,
          },
          this.client,
          abortSignal,
        );

        // Handle both single and multiple replacements based on expected_replacements
        if (expectedReplacements === 1 && correctedEdit.occurrences === 1) {
          result.newContent = result.newContent.replace(
            correctedEdit.params.old_string,
            correctedEdit.params.new_string,
          );
          result.editsApplied++;
        } else if (
          expectedReplacements > 1 &&
          correctedEdit.occurrences === expectedReplacements
        ) {
          result.newContent = result.newContent.replaceAll(
            correctedEdit.params.old_string,
            correctedEdit.params.new_string,
          );
          result.editsApplied++;
        } else {
          result.editsFailed++;
          result.failedEdits.push({
            index: i,
            oldString: edit.old_string,
            newString: edit.new_string,
            error:
              correctedEdit.occurrences === 0
                ? 'String not found'
                : `Expected ${expectedReplacements} occurrences but found ${correctedEdit.occurrences}`,
          });
        }
      } catch (error) {
        result.editsFailed++;
        result.failedEdits.push({
          index: i,
          oldString: edit.old_string,
          newString: edit.new_string,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }

  /**
   * Handles different edit modes for file operations
   * @param params Edit parameters
   * @param newContent The new content to write
   */
  private async handleEditModes(
    params: EditToolParams,
    newContent: string,
  ): Promise<void> {
    this.ensureParentDirectoriesExist(params.file_path);
    fs.writeFileSync(params.file_path, newContent, 'utf8');
  }

  /**
   * Handles the confirmation prompt for the Edit tool in the CLI.
   * It needs to calculate the diff to show the user.
   */
  async shouldConfirmExecute(
    params: EditToolParams,
    abortSignal: AbortSignal,
  ): Promise<ToolCallConfirmationDetails | false> {
    if (this.config.getApprovalMode() === ApprovalMode.AUTO_EDIT) {
      return false;
    }
    const validationError = this.validateToolParams(params);
    if (validationError) {
      console.error(
        `[EditTool Wrapper] Attempted confirmation with invalid parameters: ${validationError}`,
      );
      return false;
    }

    try {
      // Calculate what the edits would produce
      const editResult = await this.applyMultipleEdits(params, params.mode || 'edit', abortSignal);

      // Don't show confirmation if no edits would be applied
      if (editResult.editsApplied === 0 && !editResult.isNewFile) {
        return false;
      }

      // Read current content for diff comparison
      let currentContent: string | null = null;
      try {
        currentContent = fs.readFileSync(params.file_path, 'utf8');
      } catch (err: unknown) {
        if (isNodeError(err) && err.code === 'ENOENT') {
          currentContent = '';
        } else {
          console.error(`Error reading file for confirmation diff: ${err}`);
          return false;
        }
      }

      // Generate diff for confirmation
      const fileName = path.basename(params.file_path);
      const fileDiff = Diff.createPatch(
        fileName,
        currentContent || '',
        editResult.newContent,
        'Current',
        'Proposed',
        DEFAULT_DIFF_OPTIONS,
      );

      const editsCount =
        (params.edits?.length || 0) + (params.old_string !== undefined ? 1 : 0);
      const title =
        editsCount > 1
          ? `Confirm ${editsCount} Edits: ${shortenPath(makeRelative(params.file_path, this.rootDirectory))}`
          : `Confirm Edit: ${shortenPath(makeRelative(params.file_path, this.rootDirectory))}`;

      const confirmationDetails: ToolEditConfirmationDetails = {
        type: 'edit',
        title,
        fileName,
        fileDiff,
        onConfirm: async (outcome: ToolConfirmationOutcome) => {
          if (outcome === ToolConfirmationOutcome.ProceedAlways) {
            this.config.setApprovalMode(ApprovalMode.AUTO_EDIT);
          }
        },
      };
      return confirmationDetails;
    } catch (error) {
      console.error(`Error generating confirmation diff: ${error}`);
      return false;
    }
  }

  getDescription(params: EditToolParams): string {
    if (!params.file_path) {
      return `Model did not provide valid parameters for edit tool`;
    }
    const relativePath = makeRelative(params.file_path, this.rootDirectory);
    const mode = params.mode || 'edit';

    // Handle batch edits
    if (params.edits && params.edits.length > 0) {
      if (params.edits.length === 1) {
        const edit = params.edits[0];
        if (edit.old_string === '') {
          return `Create ${shortenPath(relativePath)}`;
        }
        const oldSnippet =
          edit.old_string.split('\n')[0].substring(0, 30) +
          (edit.old_string.length > 30 ? '...' : '');
        const newSnippet =
          edit.new_string.split('\n')[0].substring(0, 30) +
          (edit.new_string.length > 30 ? '...' : '');
        return `${shortenPath(relativePath)}: ${oldSnippet} => ${newSnippet}`;
      } else {
        return `${mode} ${shortenPath(relativePath)} (${params.edits.length} edits)`;
      }
    }

    // Handle single edit (backward compatibility)
    if (params.old_string !== undefined && params.new_string !== undefined) {
      if (params.old_string === '') {
        return `Create ${shortenPath(relativePath)}`;
      }
      const oldStringSnippet =
        params.old_string.split('\n')[0].substring(0, 30) +
        (params.old_string.length > 30 ? '...' : '');
      const newStringSnippet =
        params.new_string.split('\n')[0].substring(0, 30) +
        (params.new_string.length > 30 ? '...' : '');
      return `${shortenPath(relativePath)}: ${oldStringSnippet} => ${newStringSnippet}`;
    }

    return `${mode} ${shortenPath(relativePath)}`;
  }

  /**
   * Executes the edit operation with the given parameters.
   * @param params Parameters for the edit operation
   * @returns Result of the edit operation
   */
  async execute(
    params: EditToolParams,
    abortSignal: AbortSignal,
  ): Promise<EditResult> {
    const validationError = this.validateToolParams(params);
    if (validationError) {
      return {
        llmContent: `Error: Invalid parameters provided. Reason: ${validationError}`,
        returnDisplay: `Error: ${validationError}`,
        editsApplied: 0,
        editsAttempted: 0,
        editsFailed: 1,
        mode: params.mode || 'edit',
      };
    }

    try {
      const editResult = await this.applyMultipleEdits(params, params.mode || 'edit', abortSignal);

      // Apply the changes to the file
      await this.handleEditModes(params, editResult.newContent);

      // Generate appropriate response messages
      let displayResult: ToolResultDisplay;
      let llmContent: string;

      if (editResult.isNewFile) {
        displayResult = `Created ${shortenPath(makeRelative(params.file_path, this.rootDirectory))}`;
        llmContent = `Created new file: ${params.file_path}`;
      } else if (editResult.editsApplied > 0) {
        // Generate diff for display using original content before writing
        const fileName = path.basename(params.file_path);
        // Use the original content from before the edit was applied
        const originalContent = editResult.originalContent || '';
        const fileDiff = Diff.createPatch(
          fileName,
          originalContent,
          editResult.newContent,
          'Current',
          'Proposed',
          DEFAULT_DIFF_OPTIONS,
        );
        displayResult = { fileDiff, fileName };
        llmContent = `Successfully applied ${editResult.editsApplied}/${editResult.editsAttempted} edits to ${params.file_path}`;
      } else {
        displayResult = `No edits applied to ${shortenPath(makeRelative(params.file_path, this.rootDirectory))}`;
        llmContent = `Failed to apply any edits to ${params.file_path}`;
      }

      // Add details about failed edits
      if (editResult.editsFailed > 0) {
        const failureDetails = editResult.failedEdits
          .map((f) => `Edit ${f.index + 1}: ${f.error}`)
          .join('; ');
        llmContent += `. Failed edits: ${failureDetails}`;
      }

      return {
        llmContent,
        returnDisplay: displayResult,
        editsApplied: editResult.editsApplied,
        editsAttempted: editResult.editsAttempted,
        editsFailed: editResult.editsFailed,
        failedEdits: editResult.failedEdits,
        mode: params.mode || 'edit',
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const editsAttempted =
        (params.edits?.length || 0) + (params.old_string !== undefined ? 1 : 0);

      return {
        llmContent: `Error executing edits: ${errorMsg}`,
        returnDisplay: `Error: ${errorMsg}`,
        editsApplied: 0,
        editsAttempted,
        editsFailed: editsAttempted,
        mode: params.mode || 'edit',
      };
    }
  }

  /**
   * Creates parent directories if they don't exist
   */
  private ensureParentDirectoriesExist(filePath: string): void {
    const dirName = path.dirname(filePath);
    if (!fs.existsSync(dirName)) {
      fs.mkdirSync(dirName, { recursive: true });
    }
  }
}
