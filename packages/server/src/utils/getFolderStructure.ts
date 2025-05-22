/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { getErrorMessage, isNodeError } from './errors.js';

const MAX_ITEMS = 200;
const TRUNCATION_INDICATOR = '...';
const DEFAULT_IGNORED_FOLDERS = new Set(['node_modules', '.git', 'dist']);

// --- Interfaces ---

/** Options for customizing folder structure retrieval. */
interface FolderStructureOptions {
  /** Maximum number of files and folders combined to display. Defaults to 200. */
  maxItems?: number;
  /** Set of folder names to ignore completely. Case-sensitive. */
  ignoredFolders?: Set<string>;
  /** Optional regex to filter included files by name. */
  fileIncludePattern?: RegExp;
}

// Define a type for the merged options where fileIncludePattern remains optional
type MergedFolderStructureOptions = Required<
  Omit<FolderStructureOptions, 'fileIncludePattern'>
> & {
  fileIncludePattern?: RegExp;
};

/** Represents the full, unfiltered information about a folder and its contents. */
interface FullFolderInfo {
  name: string;
  path: string;
  files: string[];
  subFolders: FullFolderInfo[];
  totalChildren: number; // Number of files and subfolders included from this folder during BFS scan
  totalFiles: number; // Number of files included from this folder during BFS scan
  isIgnored?: boolean; // Flag to easily identify ignored folders later
  hasMoreFiles?: boolean; // Indicates if files were truncated for this specific folder
  hasMoreSubfolders?: boolean; // Indicates if subfolders were truncated for this specific folder
}

// --- Interfaces ---

// --- Helper Functions ---

async function readFullStructure(
  rootPath: string,
  options: MergedFolderStructureOptions,
): Promise<FullFolderInfo | null> {
  const rootName = path.basename(rootPath);
  const rootNode: FullFolderInfo = {
    name: rootName,
    path: rootPath,
    files: [],
    subFolders: [],
    totalChildren: 0,
    totalFiles: 0,
  };

  const queue: Array<{ folderInfo: FullFolderInfo; currentPath: string }> = [
    { folderInfo: rootNode, currentPath: rootPath },
  ];
  let currentItemCount = 0;
  // Count the root node itself as one item if we are not just listing its content

  const processedPaths = new Set<string>(); // To avoid processing same path if symlinks create loops

  while (queue.length > 0) {
    const { folderInfo, currentPath } = queue.shift()!;

    if (processedPaths.has(currentPath)) {
      continue;
    }
    processedPaths.add(currentPath);

    if (currentItemCount >= options.maxItems) {
      // If the root itself caused us to exceed, we can't really show anything.
      // Otherwise, this folder won't be processed further.
      // The parent that queued this would have set its own hasMoreSubfolders flag.
      continue;
    }

    let entries;
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch (error: unknown) {
      if (
        isNodeError(error) &&
        (error.code === 'EACCES' || error.code === 'ENOENT')
      ) {
        console.warn(
          `Warning: Could not read directory ${currentPath}: ${error.message}`,
        );
        // Mark as errored or simply skip. For now, skip.
        continue;
      }
      throw error; // Rethrow other errors
    }

    const filesInCurrentDir: string[] = [];
    const subFoldersInCurrentDir: FullFolderInfo[] = [];

    // Process files first in the current directory
    for (const entry of entries) {
      if (entry.isFile()) {
        if (currentItemCount >= options.maxItems) {
          folderInfo.hasMoreFiles = true;
          break;
        }
        const fileName = entry.name;
        if (
          !options.fileIncludePattern ||
          options.fileIncludePattern.test(fileName)
        ) {
          filesInCurrentDir.push(fileName);
          currentItemCount++;
          folderInfo.totalFiles++;
          folderInfo.totalChildren++;
        }
      }
    }
    folderInfo.files = filesInCurrentDir;

    // Then process directories and queue them
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (currentItemCount >= options.maxItems) {
          folderInfo.hasMoreSubfolders = true;
          break;
        }

        const subFolderName = entry.name;
        const subFolderPath = path.join(currentPath, subFolderName);

        if (options.ignoredFolders.has(subFolderName)) {
          const ignoredSubFolder: FullFolderInfo = {
            name: subFolderName,
            path: subFolderPath,
            files: [],
            subFolders: [],
            totalChildren: 0,
            totalFiles: 0,
            isIgnored: true,
          };
          subFoldersInCurrentDir.push(ignoredSubFolder);
          currentItemCount++; // Count the ignored folder itself
          folderInfo.totalChildren++; // Also counts towards parent's children
          continue;
        }

        const subFolderNode: FullFolderInfo = {
          name: subFolderName,
          path: subFolderPath,
          files: [],
          subFolders: [],
          totalChildren: 0,
          totalFiles: 0,
        };
        subFoldersInCurrentDir.push(subFolderNode);
        currentItemCount++;
        folderInfo.totalChildren++; // Counts towards parent's children

        // Add to queue for processing its children later
        queue.push({ folderInfo: subFolderNode, currentPath: subFolderPath });
      }
    }
    folderInfo.subFolders = subFoldersInCurrentDir;
  }

  // Recalculate totalChildren and totalFiles for rootNode based on its actual children
  // as the BFS processes level by level, these counts are built up from bottom-up in a DFS sense
  // but for BFS, we need to sum them up after the fact if we want accurate totals for parent nodes
  // based on *actually included* children.
  // However, the current item counting should reflect what's *added* to the structure.
  // The `totalChildren` and `totalFiles` on each node will reflect what *it* contains directly
  // or what was added from its children before truncation.

  // For now, the item count is the primary driver, and local totals are fine.

  return rootNode;
}

/**
 * Reads the directory structure using BFS, respecting maxItems.
 * @param node The current node in the reduced structure.
 * @param indent The current indentation string.
 * @param isLast Sibling indicator.
 * @param builder Array to build the string lines.
 */
function formatStructure(
  node: FullFolderInfo,
  indent: string,
  isLast: boolean,
  isRoot: boolean,
  builder: string[],
): void {
  const connector = isLast ? '└───' : '├───';
  const linePrefix = indent + connector;

  // Don't print the root node's name directly, only its contents, unless it's an ignored root
  if (!isRoot || node.isIgnored) {
    builder.push(
      `${linePrefix}${node.name}/${node.isIgnored ? TRUNCATION_INDICATOR : ''}`,
    );
  }

  const childIndent = indent + (isLast || isRoot ? '    ' : '│   ');

  // Render files
  const fileCount = node.files.length;
  for (let i = 0; i < fileCount; i++) {
    const isLastFile =
      i === fileCount - 1 &&
      node.subFolders.length === 0 &&
      !node.hasMoreSubfolders;
    const fileConnector = isLastFile ? '└───' : '├───';
    builder.push(`${childIndent}${fileConnector}${node.files[i]}`);
  }
  if (node.hasMoreFiles) {
    const isLastFile = node.subFolders.length === 0 && !node.hasMoreSubfolders;
    const fileConnector = isLastFile ? '└───' : '├───';
    builder.push(`${childIndent}${fileConnector}${TRUNCATION_INDICATOR}`);
  }

  // Render subfolders
  const subFolderCount = node.subFolders.length;
  for (let i = 0; i < subFolderCount; i++) {
    const isLastSub = i === subFolderCount - 1 && !node.hasMoreSubfolders;
    formatStructure(node.subFolders[i], childIndent, isLastSub, false, builder);
  }
  if (node.hasMoreSubfolders) {
    // Create a dummy node for the truncation indicator to be formatted
    builder.push(`${childIndent}└───${TRUNCATION_INDICATOR}`);
  }
}

// --- Main Exported Function ---

/**
 * Generates a string representation of a directory's structure,
 * limiting the number of items displayed. Ignored folders are shown
 * followed by '...' instead of their contents.
 *
 * @param directory The absolute or relative path to the directory.
 * @param options Optional configuration settings.
 * @returns A promise resolving to the formatted folder structure string.
 */
export async function getFolderStructure(
  directory: string,
  options?: FolderStructureOptions,
): Promise<string> {
  const resolvedPath = path.resolve(directory);
  const mergedOptions: MergedFolderStructureOptions = {
    maxItems: options?.maxItems ?? MAX_ITEMS,
    ignoredFolders: options?.ignoredFolders ?? DEFAULT_IGNORED_FOLDERS,
    fileIncludePattern: options?.fileIncludePattern,
  };

  try {
    // 1. Read the structure using BFS, respecting maxItems
    const structureRoot = await readFullStructure(resolvedPath, mergedOptions);

    if (!structureRoot) {
      return `Error: Could not read directory "${resolvedPath}". Check path and permissions.`;
    }

    // 2. Format the structure into a string
    const structureLines: string[] = [];
    // Pass true for isRoot for the initial call
    formatStructure(structureRoot, '', true, true, structureLines);

    // 3. Build the final output string
    const displayPath = resolvedPath.replace(/\\/g, '/');

    let disclaimer = '';
    // Check if truncation occurred anywhere or if ignored folders are present.
    // A simple check: if any node indicates more files/subfolders, or is ignored.
    let truncationOccurred = false;
    function checkForTruncation(node: FullFolderInfo) {
      if (node.hasMoreFiles || node.hasMoreSubfolders || node.isIgnored) {
        truncationOccurred = true;
      }
      if (!truncationOccurred) {
        for (const sub of node.subFolders) {
          checkForTruncation(sub);
          if (truncationOccurred) break;
        }
      }
    }
    checkForTruncation(structureRoot);

    if (truncationOccurred) {
      disclaimer = `Folders or files indicated with ${TRUNCATION_INDICATOR} contain more items not shown, were ignored, or the display limit (${mergedOptions.maxItems} items) was reached.`;
    }

    // Count the number of items that will be displayed for the summary.
    // This should ideally match the number of lines generated by formatStructure, plus files inside displayed folders.
    // The `currentItemCount` from `readFullStructure` is the most accurate count of processed items.
    // For the summary, we can state we are showing *up to* maxItems.
    const summary =
      `Showing up to ${mergedOptions.maxItems} items (files + folders). ${disclaimer}`.trim();

    return `${summary}\n\n${displayPath}/\n${structureLines.join('\n')}`;
  } catch (error: unknown) {
    console.error(`Error getting folder structure for ${resolvedPath}:`, error);
    return `Error processing directory "${resolvedPath}": ${getErrorMessage(error)}`;
  }
}
