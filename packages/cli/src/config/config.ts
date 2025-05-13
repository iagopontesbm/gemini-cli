/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs'; // For synchronous checks like existsSync
import * as path from 'path';
import { homedir } from 'os';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import process from 'node:process';
import {
  Config,
  loadEnvironment,
  createServerConfig,
} from '@gemini-code/server';
import { Settings } from './settings.js';
import { readPackageUp } from 'read-package-up';

// Simple console logger for now - replace with actual logger if available
const logger = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug: (...args: any[]) => console.debug('[DEBUG]', ...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (...args: any[]) => console.error('[ERROR]', ...args),
};

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-pro-preview-05-06';
const GEMINI_MD_FILENAME = 'GEMINI.md';
const GEMINI_CONFIG_DIR = '.gemini';

// Keep CLI-specific argument parsing
interface CliArgs {
  model: string | undefined;
  sandbox: boolean | string | undefined;
  debug_mode: boolean | undefined;
  question: string | undefined;
  full_context: boolean | undefined;
}

async function parseArguments(): Promise<CliArgs> {
  const argv = await yargs(hideBin(process.argv))
    .option('model', {
      alias: 'm',
      type: 'string',
      description: `The Gemini model to use. Defaults to ${DEFAULT_GEMINI_MODEL}.`,
      default: process.env.GEMINI_CODE_MODEL || DEFAULT_GEMINI_MODEL,
    })
    .option('sandbox', {
      alias: 's',
      type: 'boolean', // Keep as boolean for yargs parsing, handle string later if needed
      description: 'Whether to run in sandbox mode. Defaults to false.',
    })
    .option('debug_mode', {
      alias: 'z',
      type: 'boolean',
      description: 'Whether to run in debug mode. Defaults to false.',
      default: false,
    })
    .option('question', {
      alias: 'q',
      type: 'string',
      description:
        'The question to pass to the command when using piped input.',
    })
    .option('full_context', {
      alias: 'f',
      type: 'boolean',
      description:
        'Recursively include all files within the current directory as context.',
      default: false,
    })
    .help()
    .alias('h', 'help')
    .strict().argv;

  // Explicitly cast sandbox if needed, though createServerConfig handles boolean | string
  const finalArgv: CliArgs = {
    ...argv,
    // yargs parses boolean, but allow env var or future string values?
    // For now, stick to boolean from yargs. createServerConfig handles it.
    sandbox: argv.sandbox,
  };

  return finalArgv;
}

/**
 * Finds the root of the project containing the given directory.
 * Project root is defined as the closest ancestor directory containing a '.git' folder.
 * Returns null if no '.git' directory is found up to the filesystem root.
 */
async function findProjectRoot(startDir: string): Promise<string | null> {
  let currentDir = path.resolve(startDir);
  while (true) {
    const gitPath = path.join(currentDir, '.git');
    try {
      // Use fsSync for potentially faster check if async overhead is noticeable
      // Although spec implies async, this is often sync in practice. Sticking to async fs.
      const stats = await fs.stat(gitPath);
      if (stats.isDirectory()) {
        return currentDir;
      }
    } catch (error: unknown) {
      // Use 'unknown' type for caught errors
      // Check if it's a file system error with a code property
      if (typeof error === 'object' && error !== null && 'code' in error) {
        const fsError = error as { code: string; message: string };
        if (fsError.code !== 'ENOENT') {
          // Log unexpected errors, but don't stop the process
          logger.warn(
            `Error checking for .git directory at ${gitPath}: ${fsError.message}`,
          );
        }
      } else {
        // Log if it's not a standard FS error
        logger.warn(
          `Non-standard error checking for .git directory at ${gitPath}: ${String(error)}`,
        );
      }
      // Continue searching if it's just a "not found" error or other handled error
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached filesystem root
      return null;
    }
    currentDir = parentDir;
  }
}

/**
 * Identifies all applicable GEMINI.md files from global to local.
 * Order: Global -> Project Root -> ... -> CWD
 */
async function getGeminiMdFilePaths(
  currentWorkingDirectory: string,
  userHomePath: string,
  debugMode: boolean,
): Promise<string[]> {
  const resolvedCwd = path.resolve(currentWorkingDirectory);
  const resolvedHome = path.resolve(userHomePath);
  const globalMemoryPath = path.join(
    resolvedHome,
    GEMINI_CONFIG_DIR,
    GEMINI_MD_FILENAME,
  );
  const paths: string[] = [];

  if (debugMode)
    logger.debug(`Searching for GEMINI.md starting from CWD: ${resolvedCwd}`);
  if (debugMode) logger.debug(`User home directory: ${resolvedHome}`);

  // 1. Add Global Memory File (if exists and readable)
  try {
    await fs.access(globalMemoryPath, fsSync.constants.R_OK); // Use fsSync constants
    paths.push(globalMemoryPath);
    if (debugMode)
      logger.debug(`Found readable global GEMINI.md: ${globalMemoryPath}`);
  } catch {
    if (debugMode)
      logger.debug(
        `Global GEMINI.md not found or not readable: ${globalMemoryPath}`,
      );
    // Doesn't exist or not readable, skip
  }

  // 2. Find Project Root
  const projectRoot = await findProjectRoot(resolvedCwd);
  if (debugMode)
    logger.debug(`Determined project root: ${projectRoot ?? 'None'}`);

  // 3. Traverse from CWD up to Project Root (or home/fs root)
  const localPaths: string[] = [];
  let currentDir = resolvedCwd;
  // Determine the directory to stop searching upwards
  // If in a project, stop *before* the project root's parent.
  // If not in a project, stop *before* the home directory (don't re-evaluate global).
  // Always stop at the filesystem root.
  const stopDir = projectRoot ? path.dirname(projectRoot) : resolvedHome;

  while (
    currentDir &&
    currentDir !== stopDir &&
    currentDir !== path.dirname(currentDir) /* stop at fs root */
  ) {
    if (debugMode) logger.debug(`Checking for GEMINI.md in: ${currentDir}`);
    // Optimization: Don't check inside the global .gemini dir again if CWD is within it somehow
    if (currentDir === path.join(resolvedHome, GEMINI_CONFIG_DIR)) {
      if (debugMode)
        logger.debug(`Skipping check inside global config dir: ${currentDir}`);
      break;
    }

    const potentialPath = path.join(currentDir, GEMINI_MD_FILENAME);
    try {
      await fs.access(potentialPath, fsSync.constants.R_OK); // Use fsSync constants
      // Add to the beginning because we are traversing upwards
      localPaths.unshift(potentialPath);
      if (debugMode)
        logger.debug(`Found readable local GEMINI.md: ${potentialPath}`);
    } catch {
      if (debugMode)
        logger.debug(
          `Local GEMINI.md not found or not readable in: ${currentDir}`,
        );
      // Doesn't exist or not readable, skip
    }

    // Move to parent directory
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      if (debugMode)
        logger.debug(`Reached filesystem root, stopping upward search.`);
      break; // Reached root
    }
    currentDir = parentDir;
  }

  // Combine global and local paths (localPaths are already in correct order due to unshift)
  paths.push(...localPaths);

  if (debugMode)
    logger.debug(
      `Final ordered GEMINI.md paths to read: ${JSON.stringify(paths)}`,
    );
  return paths;
}

/**
 * Reads the content of multiple GEMINI.md files.
 */
async function readGeminiMdFiles(
  filePaths: string[],
  debugMode: boolean,
): Promise<Array<string | null>> {
  const contents: Array<string | null> = [];
  for (const filePath of filePaths) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      contents.push(content);
      if (debugMode)
        logger.debug(
          `Successfully read: ${filePath} (Length: ${content.length})`,
        );
    } catch (error: unknown) {
      // Log warning, but continue execution as per spec
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(
        `Warning: Could not read GEMINI.md file at ${filePath}. Error: ${message}`,
      );
      contents.push(null); // Add null for unreadable/missing files
      if (debugMode) logger.debug(`Failed to read: ${filePath}`);
    }
  }
  return contents;
}

/**
 * Concatenates instruction strings, separated by double newlines.
 */
function concatenateInstructions(
  instructionContents: Array<string | null>,
): string {
  // Filter out null/undefined and trim whitespace before checking length
  const validContents = instructionContents
    .filter((content): content is string => typeof content === 'string')
    .map((content) => content.trim())
    .filter((content) => content.length > 0);

  return validContents.join('\n\n');
}

/**
 * Loads hierarchical memory instructions from GEMINI.md files.
 */
export async function loadHierarchicalGeminiMemory(
  currentWorkingDirectory: string,
  debugMode: boolean,
): Promise<string> {
  if (debugMode)
    logger.debug(
      `Loading hierarchical memory for CWD: ${currentWorkingDirectory}`,
    );
  const userHomePath = homedir();
  const filePaths = await getGeminiMdFilePaths(
    currentWorkingDirectory,
    userHomePath,
    debugMode,
  );
  if (filePaths.length === 0) {
    if (debugMode) logger.debug('No GEMINI.md files found in hierarchy.');
    return ''; // Return empty string if no files found
  }
  const contents = await readGeminiMdFiles(filePaths, debugMode);
  const combinedInstructions = concatenateInstructions(contents);
  if (debugMode)
    logger.debug(
      `Combined instructions length: ${combinedInstructions.length}`,
    );
  if (debugMode && combinedInstructions.length > 0)
    logger.debug(
      `Combined instructions (snippet): ${combinedInstructions.substring(0, 200)}...`,
    );
  return combinedInstructions;
}

// Renamed function for clarity
export async function loadCliConfig(settings: Settings): Promise<Config> {
  // Load .env file using logic from server package
  loadEnvironment();

  // Check API key (CLI responsibility)
  if (!process.env.GEMINI_API_KEY) {
    // Use logger instead of console.log directly
    logger.error(
      'GEMINI_API_KEY is not set. See https://ai.google.dev/gemini-api/docs/api-key to obtain one. ' +
        'Please set it in your .env file or as an environment variable.',
    );
    process.exit(1);
  }

  // Parse CLI arguments
  const argv = await parseArguments();
  const debugMode = argv.debug_mode || false; // Determine debug mode early

  // Load hierarchical memory
  const userMemory = await loadHierarchicalGeminiMemory(
    process.cwd(),
    debugMode,
  );

  const userAgent = await createUserAgent();

  // Create config using factory from server package, passing userMemory
  return createServerConfig(
    process.env.GEMINI_API_KEY,
    argv.model || DEFAULT_GEMINI_MODEL,
    argv.sandbox ?? settings.sandbox ?? false, // Use loaded settings as fallback for sandbox
    process.cwd(),
    debugMode, // Pass determined debugMode
    argv.question || '',
    argv.full_context || false,
    settings.toolDiscoveryCommand,
    settings.toolCallCommand,
    settings.mcpServerCommand,
    userAgent,
    userMemory, // Pass the loaded memory
  );
}

async function createUserAgent(): Promise<string> {
  try {
    // Ensure cwd points to this file's directory context if needed, or rely on default behavior
    const packageJsonInfo = await readPackageUp({ cwd: import.meta.url });
    const cliVersion = packageJsonInfo?.packageJson.version || 'unknown';
    return `GeminiCLI/${cliVersion} Node.js/${process.version} (${process.platform}; ${process.arch})`;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(
      `Could not determine package version for User-Agent: ${message}`,
    );
    return `GeminiCLI/unknown Node.js/${process.version} (${process.platform}; ${process.arch})`;
  }
}
