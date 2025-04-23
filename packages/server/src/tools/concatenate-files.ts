/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseTool, ToolResult } from './tools.js'; // Assuming 'tools.ts' is where BaseTool is defined
import { SchemaValidator } from '../utils/schemaValidator.js'; // Assuming this utility is available
import { getErrorMessage } from '../utils/errors.js'; // Assuming this utility is available

// Node.js built-in modules for file system and path manipulation
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Parameters for the ConcatenateFilesTool.
 */
export interface ConcatenateFilesParams {
  /**
   * An array of file paths or directory paths to search within.
   * Paths are relative to the tool's configured target directory.
   */
  paths: string[];

  /**
   * Optional. Simplified glob patterns for files to include.
   * Example: ["*.ts", "src/** /*.md"]
   */
  include?: string[];

  /**
   * Optional. Simplified glob patterns for files/directories to exclude.
   * Example: ["*.log", "dist/**"]
   */
  exclude?: string[];

  /**
   * Optional. Search directories recursively. Defaults to true.
   */
  recursive?: boolean;

  /**
   * Optional. Apply default exclusion patterns. Defaults to true.
   */
  useDefaultExcludes?: boolean;

  /**
   * Optional. Format string for the separator line before each file's content.
   * Use '{filePath}' as a placeholder for the relative file path.
   * Defaults to "--- {filePath} ---".
   */
  outputSeparatorFormat?: string;

  /**
   * Optional. The encoding to use when reading files. Defaults to "utf-8".
   */
  encoding?: BufferEncoding;
}

/**
 * Default exclusion patterns for commonly ignored directories and binary file types.
 */
const DEFAULT_EXCLUDES: string[] = [
  '**/node_modules/**',
  '**/.git/**',
  '**/.vscode/**',
  '**/.idea/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/__pycache__/**',
  '**/*.pyc',
  '**/*.pyo',
  '**/*.bin',
  '**/*.exe',
  '**/*.dll',
  '**/*.so',
  '**/*.dylib',
  '**/*.class',
  '**/*.jar',
  '**/*.war',
  '**/*.zip',
  '**/*.tar',
  '**/*.gz',
  '**/*.bz2',
  '**/*.rar',
  '**/*.7z',
  '**/*.png',
  '**/*.jpg',
  '**/*.jpeg',
  '**/*.gif',
  '**/*.bmp',
  '**/*.tiff',
  '**/*.ico',
  '**/*.pdf',
  '**/*.doc',
  '**/*.docx',
  '**/*.xls',
  '**/*.xlsx',
  '**/*.ppt',
  '**/*.pptx',
  '**/*.odt',
  '**/*.ods',
  '**/*.odp',
  '**/*.DS_Store',
  '**/.env',
];

/**
 * Tool implementation for finding and concatenating text files from the local filesystem
 * within a specified target directory.
 * This tool uses manual directory traversal and simplified glob-to-regex conversion.
 * It is intended to run in an environment with access to the local file system (e.g., a Node.js backend).
 */
export class ConcatenateFilesTool extends BaseTool<
  ConcatenateFilesParams,
  ToolResult
> {
  static readonly Name: string = 'concatenateFiles';
  readonly targetDir: string;

  /**
   * Creates an instance of ConcatenateFilesTool.
   * @param targetDir The absolute root directory within which this tool is allowed to operate.
   * All paths provided in `params` will be resolved relative to this directory.
   */
  constructor(targetDir: string) {
    const parameterSchema: Record<string, unknown> = {
      type: 'object',
      properties: {
        paths: {
          type: 'array',
          items: { type: 'string' },
          description:
            "Required. An array of file paths or directory paths to process, relative to the tool's target directory.",
        },
        include: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional. Simplified glob-like patterns for files to include (e.g., ["*.ts", "src/**/*.js"]). If empty, includes most non-binary files.',
          default: [],
        },
        exclude: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional. Simplified glob-like patterns for files/directories to exclude (e.g., ["*.log", "dist/"]). Added to default excludes if useDefaultExcludes is true.',
          default: [],
        },
        recursive: {
          type: 'boolean',
          description:
            'Optional. Whether to search directories recursively. Defaults to true.',
          default: true,
        },
        useDefaultExcludes: {
          type: 'boolean',
          description:
            'Optional. Whether to apply a list of default exclusion patterns. Defaults to true.',
          default: true,
        },
        outputSeparatorFormat: {
          type: 'string',
          description:
            'Optional. Template for the separator string. Use {filePath} for the relative path. Defaults to "--- {filePath} ---".',
          default: '--- {filePath} ---',
        },
        encoding: {
          type: 'string',
          description: 'Optional. File encoding. Defaults to "utf-8".',
          default: 'utf-8',
        },
      },
      required: ['paths'],
    };

    super(
      ConcatenateFilesTool.Name,
      'Concatenate Files',
      `Recursively finds and concatenates text files from specified paths within a configured target directory. Uses simplified pattern matching. Useful for gathering context for LLMs.`,
      parameterSchema,
    );
    this.targetDir = path.resolve(targetDir); // Ensure targetDir is absolute and normalized
  }

  /**
   * Converts a simplified glob pattern to a RegExp.
   * Supports:
   * - `*`: matches any characters except path separators (`/` or `\`).
   * - `**`: matches any characters including path separators (greedy).
   * - `?`: matches any single character except path separators.
   * - Other characters are literal.
   * @param globPattern The glob pattern string.
   * @returns A RegExp object.
   * @private
   */
  private globToRegex(globPattern: string): RegExp {
    let regexStr = '^';
    // Normalize to use forward slashes for consistent matching
    const pattern = globPattern.replace(/\\/g, '/');

    for (let i = 0; i < pattern.length; i++) {
      const char = pattern[i];
      switch (char) {
        case '*':
          if (pattern[i + 1] === '*') {
            // '**'
            regexStr += '.*'; // Matches any characters, including '/'
            i++; // Skip next '*'
          } else {
            // '*'
            regexStr += '[^/]*'; // Matches any characters except '/'
          }
          break;
        case '?':
          regexStr += '[^/]'; // Matches a single character except '/'
          break;
        // Escape regex special characters
        case '.':
        case '+':
        case '(':
        case ')':
        case '{':
        case '}':
        case '[':
        case ']':
        case '\\':
        case '$':
        case '^':
        case '|':
          regexStr += '\\' + char;
          break;
        default:
          regexStr += char;
          break;
      }
    }
    regexStr += '$';
    return new RegExp(regexStr);
  }

  validateParams(params: ConcatenateFilesParams): string | null {
    if (
      this.schema.parameters &&
      !SchemaValidator.validate(
        this.schema.parameters as Record<string, unknown>,
        params,
      )
    ) {
      if (
        !params.paths ||
        !Array.isArray(params.paths) ||
        params.paths.length === 0
      ) {
        return 'The "paths" parameter is required and must be a non-empty array of strings.';
      }
      return 'Parameters failed schema validation. Ensure "paths" is a non-empty array and other parameters match their expected types.';
    }
    for (const p of params.paths) {
      if (typeof p !== 'string' || p.trim() === '') {
        return 'Each item in "paths" must be a non-empty string.';
      }
      // Additional check: ensure paths don't try to escape the targetDir with leading '..'
      // This is a basic check; the main enforcement is done by resolving and comparing absolute paths.
      if (p.startsWith('..') || p.includes('/..') || p.includes('\\..')) {
        return `Path item "${p}" attempts to traverse outside the target directory. Paths must be relative and within the target directory.`;
      }
    }
    if (
      params.include &&
      (!Array.isArray(params.include) ||
        !params.include.every((item) => typeof item === 'string'))
    ) {
      return 'If provided, "include" must be an array of strings.';
    }
    if (
      params.exclude &&
      (!Array.isArray(params.exclude) ||
        !params.exclude.every((item) => typeof item === 'string'))
    ) {
      return 'If provided, "exclude" must be an array of strings.';
    }
    return null;
  }

  getDescription(params: ConcatenateFilesParams): string {
    const pathDesc = `from: \`${params.paths.join('`, `')}\` (within target directory: \`${this.targetDir}\`)`;
    const recursiveDesc = `Recursion: ${params.recursive !== false ? 'enabled' : 'disabled'}`;
    const includeDesc =
      params.include && params.include.length > 0
        ? `Including patterns: \`${params.include.join('`, `')}\``
        : 'Including files based on default behavior.';

    let effectiveExcludes =
      params.useDefaultExcludes !== false ? [...DEFAULT_EXCLUDES] : [];
    if (params.exclude && params.exclude.length > 0) {
      effectiveExcludes = [...effectiveExcludes, ...params.exclude];
    }
    const excludeDesc = `Excluding: ${effectiveExcludes.length > 0 ? `patterns like \`${effectiveExcludes.slice(0, 2).join('`, `')}${effectiveExcludes.length > 2 ? '...`' : '`'}` : 'none explicitly (beyond default non-text file avoidance).'}`;

    return `Will attempt to concatenate files ${pathDesc}. ${recursiveDesc}. ${includeDesc}. ${excludeDesc}.`;
  }

  /**
   * Recursively traverses directories to find files matching the criteria.
   * @param currentDirPath Absolute path to the directory to traverse.
   * @param toolTargetDir The tool's root target directory for boundary checks and relative path calculations.
   * @param isRecursiveMasterFlag Master flag for recursion from tool parameters.
   * @param includeRegexes Array of RegExp for include patterns.
   * @param excludeRegexes Array of RegExp for exclude patterns.
   * @param filesToConsider Set to add absolute paths of matching files.
   * @param skippedFiles Array to log skipped files and reasons.
   * @param dotHandling Determines how dotfiles are handled.
   * @param explicitIncludePatterns Original include patterns for dotfile check.
   */
  private async _traverseDirectory(
    currentDirPath: string, // This is already absolute and verified to be within targetDir
    toolTargetDir: string,
    isRecursiveMasterFlag: boolean,
    includeRegexes: RegExp[],
    excludeRegexes: RegExp[],
    filesToConsider: Set<string>,
    skippedFiles: { path: string; reason: string }[],
    dotHandling: 'skip' | 'include_if_pattern_starts_with_dot' | 'allow',
    explicitIncludePatterns: string[],
  ): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(currentDirPath, { withFileTypes: true });
    } catch (error) {
      skippedFiles.push({
        path: path.relative(toolTargetDir, currentDirPath),
        reason: `Directory read error: ${getErrorMessage(error)}`,
      });
      return;
    }

    for (const entry of entries) {
      const absoluteEntryPath = path.join(currentDirPath, entry.name);

      // Security check: Ensure we don't somehow escape the target directory (should be redundant if entry point is secure)
      if (!absoluteEntryPath.startsWith(toolTargetDir)) {
        skippedFiles.push({
          path: entry.name,
          reason:
            'Attempted to access outside target directory during traversal.',
        });
        continue;
      }
      const relativeEntryPath = path
        .relative(toolTargetDir, absoluteEntryPath)
        .replace(/\\/g, '/');

      // Dotfile/dot-directory handling
      if (entry.name.startsWith('.')) {
        let allowDotEntry = false;
        if (dotHandling === 'allow') {
          allowDotEntry = true;
        } else if (dotHandling === 'include_if_pattern_starts_with_dot') {
          if (
            explicitIncludePatterns.some(
              (p) => p.startsWith('.') || p.includes('/.'),
            )
          ) {
            if (includeRegexes.some((r) => r.test(relativeEntryPath))) {
              allowDotEntry = true;
            }
          }
        }
        if (
          excludeRegexes.some(
            (r) =>
              r.test(relativeEntryPath) ||
              (entry.isDirectory() && r.test(relativeEntryPath + '/')),
          )
        ) {
          allowDotEntry = false;
        }
        if (!allowDotEntry) {
          continue;
        }
      }

      if (
        entry.isDirectory() &&
        excludeRegexes.some(
          (r) => r.test(relativeEntryPath) || r.test(relativeEntryPath + '/'),
        )
      ) {
        continue;
      }

      if (entry.isFile()) {
        if (excludeRegexes.some((r) => r.test(relativeEntryPath))) {
          continue;
        }
        if (
          includeRegexes.length > 0 &&
          !includeRegexes.some((r) => r.test(relativeEntryPath))
        ) {
          continue;
        }
        filesToConsider.add(absoluteEntryPath);
      } else if (entry.isDirectory() && isRecursiveMasterFlag) {
        await this._traverseDirectory(
          absoluteEntryPath, // Pass the already resolved and checked absolute path
          toolTargetDir,
          isRecursiveMasterFlag,
          includeRegexes,
          excludeRegexes,
          filesToConsider,
          skippedFiles,
          dotHandling,
          explicitIncludePatterns,
        );
      }
    }
  }

  async execute(params: ConcatenateFilesParams): Promise<ToolResult> {
    const validationError = this.validateParams(params);
    if (validationError) {
      return {
        llmContent: `Error: Invalid parameters for ${this.displayName}. Reason: ${validationError}`,
        returnDisplay: `## Parameter Error\n\n${validationError}`,
      };
    }

    const {
      paths: inputPathsFromParams, // Renamed to avoid confusion
      include = [],
      exclude = [],
      recursive = true,
      useDefaultExcludes = true,
      outputSeparatorFormat = '--- {filePath} ---',
      encoding = 'utf-8',
    } = params;

    // All operations are based out of this.targetDir
    const toolBaseDir = this.targetDir;

    const filesToConsider = new Set<string>();
    const skippedFiles: { path: string; reason: string }[] = [];
    const processedFilesRelativePaths: string[] = [];
    let concatenatedContent = '';

    const effectiveExcludes = useDefaultExcludes
      ? [...DEFAULT_EXCLUDES, ...exclude]
      : [...exclude];
    const includeRegexes = include.map((p) => this.globToRegex(p));
    const excludeRegexes = effectiveExcludes.map((p) => this.globToRegex(p));

    const dotHandlingStrategy:
      | 'skip'
      | 'include_if_pattern_starts_with_dot'
      | 'allow' = include.some((p) => p.startsWith('.') || p.includes('/.'))
      ? 'include_if_pattern_starts_with_dot'
      : !useDefaultExcludes && include.length === 0
        ? 'allow'
        : 'skip';

    for (const currentInputPathFromParams of inputPathsFromParams) {
      // Resolve the user-provided path against the tool's target directory
      const absoluteInputPath = path.resolve(
        toolBaseDir,
        currentInputPathFromParams,
      );

      // Security check: Ensure the resolved path is within the target directory
      if (!absoluteInputPath.startsWith(toolBaseDir)) {
        skippedFiles.push({
          path: currentInputPathFromParams, // Report the original problematic path
          reason: `Path is outside the allowed target directory. Base: ${toolBaseDir}, Attempted: ${absoluteInputPath}`,
        });
        continue;
      }

      try {
        const stats = await fs.stat(absoluteInputPath);
        // Relative path for matching should be relative to toolBaseDir
        const relativePathForMatching = path
          .relative(toolBaseDir, absoluteInputPath)
          .replace(/\\/g, '/');

        if (stats.isFile()) {
          // Dotfile check for top-level files needs to consider absoluteInputPath or entry name
          if (
            path.basename(absoluteInputPath).startsWith('.') &&
            dotHandlingStrategy === 'skip'
          ) {
            if (!includeRegexes.some((r) => r.test(relativePathForMatching))) {
              // unless explicitly included
              continue;
            }
          }
          if (excludeRegexes.some((r) => r.test(relativePathForMatching))) {
            continue;
          }
          if (
            includeRegexes.length > 0 &&
            !includeRegexes.some((r) => r.test(relativePathForMatching))
          ) {
            continue;
          }
          filesToConsider.add(absoluteInputPath);
        } else if (stats.isDirectory()) {
          if (
            excludeRegexes.some(
              (r) =>
                r.test(relativePathForMatching) ||
                r.test(relativePathForMatching + '/'),
            )
          ) {
            continue;
          }
          await this._traverseDirectory(
            absoluteInputPath, // This is already absolute and verified
            toolBaseDir,
            recursive,
            includeRegexes,
            excludeRegexes,
            filesToConsider,
            skippedFiles,
            dotHandlingStrategy,
            include,
          );
        }
      } catch (error) {
        skippedFiles.push({
          path: currentInputPathFromParams,
          reason: `Path error: ${getErrorMessage(error)}`,
        });
      }
    }

    const sortedFiles = Array.from(filesToConsider).sort();

    for (const filePath of sortedFiles) {
      // Relative path for output/display should be relative to toolBaseDir
      const relativePathForDisplay = path
        .relative(toolBaseDir, filePath)
        .replace(/\\/g, '/');
      try {
        // Security check (redundant if all additions to filesToConsider are vetted, but good for safety)
        if (!filePath.startsWith(toolBaseDir)) {
          skippedFiles.push({
            path: relativePathForDisplay,
            reason:
              'Internal error: Attempted to read file outside target directory.',
          });
          continue;
        }
        const contentBuffer = await fs.readFile(filePath);
        const sample = contentBuffer.subarray(
          0,
          Math.min(contentBuffer.length, 1024),
        );
        if (sample.includes(0)) {
          skippedFiles.push({
            path: relativePathForDisplay,
            reason: 'Skipped (appears to be binary)',
          });
          continue;
        }
        const fileContent = contentBuffer.toString(encoding);
        const separator = outputSeparatorFormat.replace(
          '{filePath}',
          relativePathForDisplay,
        );
        concatenatedContent += `${separator}\n\n${fileContent}\n\n`;
        processedFilesRelativePaths.push(relativePathForDisplay);
      } catch (error) {
        skippedFiles.push({
          path: relativePathForDisplay,
          reason: `Read error: ${getErrorMessage(error)}`,
        });
      }
    }

    let displayMessage = `### Concatenate Files Result (Target Dir: \`${this.targetDir}\`)\n\n`;
    if (processedFilesRelativePaths.length > 0) {
      displayMessage += `Successfully concatenated content from **${processedFilesRelativePaths.length} file(s)**.\n`;
      displayMessage += `\n**Processed Files (up to 10 shown):**\n`;
      processedFilesRelativePaths
        .slice(0, 10)
        .forEach((p) => (displayMessage += `- \`${p}\`\n`));
      if (processedFilesRelativePaths.length > 10) {
        displayMessage += `- ...and ${processedFilesRelativePaths.length - 10} more.\n`;
      }
    } else {
      displayMessage += `No files were concatenated based on the criteria.\n`;
    }

    if (skippedFiles.length > 0) {
      displayMessage += `\n**Skipped ${skippedFiles.length} item(s) (up to 5 shown):**\n`;
      skippedFiles
        .slice(0, 5)
        .forEach(
          (f) => (displayMessage += `- \`${f.path}\` (Reason: ${f.reason})\n`),
        );
      if (skippedFiles.length > 5) {
        displayMessage += `- ...and ${skippedFiles.length - 5} more.\n`;
      }
    }
    if (
      concatenatedContent.length === 0 &&
      processedFilesRelativePaths.length === 0
    ) {
      concatenatedContent =
        'No files matching the criteria were found or all were skipped.';
    }

    return {
      llmContent: concatenatedContent,
      returnDisplay: displayMessage,
    };
  }
}
