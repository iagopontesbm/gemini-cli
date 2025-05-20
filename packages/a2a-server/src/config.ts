/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs'; // For synchronous checks like existsSync
import * as path from 'path';
import { homedir } from 'os';
import process from 'node:process';
import {
  Config,
  loadEnvironment as loadServerEnvironment, // Renamed to avoid conflict
  createServerConfig,
  GEMINI_CONFIG_DIR,
  GEMINI_MD_FILENAME,
  MCPServerConfig, // Added MCPServerConfig
} from '@gemini-code/server';
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
const DEFAULT_IGNORE_DIRECTORIES = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  'coverage',
  '.vscode',
  '.idea',
  '.DS_Store',
];

// For a2a-server, we might not parse CLI arguments in the same way.
// This function can be simplified or adapted if needed.
// For now, it provides default values similar to CLI.
function getA2AServerArgs() {
  return {
    model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    sandbox: process.env.A2A_SANDBOX ?? false, // Example: A2A specific env var or default
    debug: process.env.A2A_DEBUG === 'true' || false,
    prompt: '', // A2A server likely gets prompt via WebSocket
    all_files: false, // Default to not including all files
  };
}

async function findProjectRoot(startDir: string): Promise<string | null> {
  let currentDir = path.resolve(startDir);
  while (true) {
    const gitPath = path.join(currentDir, '.git');
    try {
      const stats = await fs.stat(gitPath);
      if (stats.isDirectory()) {
        return currentDir;
      }
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error) {
        const fsError = error as { code: string; message: string };
        if (fsError.code !== 'ENOENT') {
          logger.warn(
            `Error checking for .git directory at ${gitPath}: ${fsError.message}`
          );
        }
      } else {
        logger.warn(
          `Non-standard error checking for .git directory at ${gitPath}: ${String(
            error
          )}`
        );
      }
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }
    currentDir = parentDir;
  }
}

async function collectDownwardGeminiFiles(
  directory: string,
  debugMode: boolean,
  ignoreDirs: string[],
): Promise<string[]> {
  if (debugMode) logger.debug(`Recursively scanning downward in: ${directory}`);
  const collectedPaths: string[] = [];
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (ignoreDirs.includes(entry.name)) {
          if (debugMode)
            logger.debug(`Skipping ignored directory: ${fullPath}`);
          continue;
        }
        const subDirPaths = await collectDownwardGeminiFiles(
          fullPath,
          debugMode,
          ignoreDirs,
        );
        collectedPaths.push(...subDirPaths);
      } else if (entry.isFile() && entry.name === GEMINI_MD_FILENAME) {
        try {
          await fs.access(fullPath, fsSync.constants.R_OK);
          collectedPaths.push(fullPath);
          if (debugMode)
            logger.debug(`Found readable downward GEMINI.md: ${fullPath}`);
        } catch {
          if (debugMode)
            logger.debug(
              `Downward GEMINI.md not readable, skipping: ${fullPath}`
            );
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Error scanning directory ${directory}: ${message}`);
    if (debugMode) logger.debug(`Failed to scan directory: ${directory}`);
  }
  return collectedPaths;
}

export async function getGeminiMdFilePaths(
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

  try {
    await fs.access(globalMemoryPath, fsSync.constants.R_OK);
    paths.push(globalMemoryPath);
    if (debugMode)
      logger.debug(`Found readable global GEMINI.md: ${globalMemoryPath}`);
  } catch {
    if (debugMode)
      logger.debug(
        `Global GEMINI.md not found or not readable: ${globalMemoryPath}`
      );
  }

  const projectRoot = await findProjectRoot(resolvedCwd);
  if (debugMode)
    logger.debug(`Determined project root: ${projectRoot ?? 'None'}`);

  const upwardPaths: string[] = [];
  let currentDir = resolvedCwd;
  const stopDir = projectRoot ? path.dirname(projectRoot) : resolvedHome;

  while (
    currentDir &&
    currentDir !== stopDir &&
    currentDir !== path.dirname(currentDir)
  ) {
    if (debugMode)
      logger.debug(`Checking for GEMINI.md in (upward scan): ${currentDir}`);
    if (currentDir === path.join(resolvedHome, GEMINI_CONFIG_DIR)) {
      if (debugMode)
        logger.debug(`Skipping check inside global config dir: ${currentDir}`);
      break;
    }
    const potentialPath = path.join(currentDir, GEMINI_MD_FILENAME);
    try {
      await fs.access(potentialPath, fsSync.constants.R_OK);
      upwardPaths.unshift(potentialPath); // Add to the beginning to maintain order
      if (debugMode)
        logger.debug(`Found readable upward GEMINI.md: ${potentialPath}`);
    } catch {
      if (debugMode)
        logger.debug(
          `Upward GEMINI.md not found or not readable in: ${currentDir}`
        );
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      if (debugMode)
        logger.debug(`Reached filesystem root, stopping upward search.`);
      break;
    }
    currentDir = parentDir;
  }
  paths.push(...upwardPaths);

  if (debugMode)
    logger.debug(`Starting downward scan from CWD: ${resolvedCwd}`);
  const downwardPaths = await collectDownwardGeminiFiles(
    resolvedCwd,
    debugMode,
    DEFAULT_IGNORE_DIRECTORIES,
  );
  downwardPaths.sort();
  if (debugMode && downwardPaths.length > 0)
    logger.debug(
      `Found downward GEMINI.md files (sorted): ${JSON.stringify(downwardPaths)}`
    );
  for (const dPath of downwardPaths) {
    if (!paths.includes(dPath)) {
      paths.push(dPath);
    }
  }

  if (debugMode)
    logger.debug(
      `Final ordered GEMINI.md paths to read: ${JSON.stringify(paths)}`
    );
  return paths;
}

interface GeminiFileContent {
  filePath: string;
  content: string | null;
}

async function readGeminiMdFiles(
  filePaths: string[],
  debugMode: boolean,
): Promise<GeminiFileContent[]> {
  const results: GeminiFileContent[] = [];
  for (const filePath of filePaths) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      results.push({ filePath, content });
      if (debugMode)
        logger.debug(
          `Successfully read: ${filePath} (Length: ${content.length})`
        );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(
        `Warning: Could not read GEMINI.md file at ${filePath}. Error: ${message}`
      );
      results.push({ filePath, content: null }); // Still include it with null content
      if (debugMode) logger.debug(`Failed to read: ${filePath}`);
    }
  }
  return results;
}

function concatenateInstructions(
  instructionContents: GeminiFileContent[],
): string {
  return instructionContents
    .filter(item => typeof item.content === 'string')
    .map(item => {
      const trimmedContent = (item.content as string).trim();
      if (trimmedContent.length === 0) {
        return null; // Filter out empty content after trimming
      }
      const displayPath = path.isAbsolute(item.filePath)
        ? path.relative(process.cwd(), item.filePath)
        : item.filePath;
      return `--- Context from: ${displayPath} ---\n${trimmedContent}\n--- End of Context from: ${displayPath} ---`;
    })
    .filter((block): block is string => block !== null)
    .join('\n\n');
}

export async function loadHierarchicalGeminiMemory(
  currentWorkingDirectory: string,
  debugMode: boolean,
): Promise<{ memoryContent: string; fileCount: number }> {
  if (debugMode)
    logger.debug(
      `Loading hierarchical memory for CWD: ${currentWorkingDirectory}`
    );
  const userHomePath = homedir();
  const filePaths = await getGeminiMdFilePaths(
    currentWorkingDirectory,
    userHomePath,
    debugMode,
  );
  if (filePaths.length === 0) {
    if (debugMode) logger.debug('No GEMINI.md files found in hierarchy.');
    return { memoryContent: '', fileCount: 0 };
  }
  const contentsWithPaths = await readGeminiMdFiles(filePaths, debugMode);
  const combinedInstructions = concatenateInstructions(contentsWithPaths);
  if (debugMode)
    logger.debug(
      `Combined instructions length: ${combinedInstructions.length}`
    );
  if (debugMode && combinedInstructions.length > 0)
    logger.debug(
      `Combined instructions (snippet): ${combinedInstructions.substring(0,500)}...`
    );
  return { memoryContent: combinedInstructions, fileCount: filePaths.length };
}

async function createUserAgent(): Promise<string> {
  try {
    // For a2a-server, we might need to adjust how the version is found,
    // or use a fixed version string if it doesn't have its own package.json in the same way.
    // Assuming a2a-server has its own package.json or we use a generic agent.
    const packageJsonInfo = await readPackageUp({ cwd: __dirname }); // Use __dirname
    const cliVersion = packageJsonInfo?.packageJson.version || 'a2a-unknown';
    return `GeminiA2AServer/${cliVersion} Node.js/${process.version} (${process.platform}; ${process.arch})`;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(
      `Could not determine package version for User-Agent: ${message}`
    );
    return `GeminiA2AServer/unknown Node.js/${process.version} (${process.platform}; ${process.arch})`;
  }
}

export async function loadA2AServerConfig(): Promise<Config> {
  // Load .env file using logic from server package
  loadServerEnvironment();

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const googleApiKey = process.env.GOOGLE_API_KEY;
  const googleCloudProject = process.env.GOOGLE_CLOUD_PROJECT;
  const googleCloudLocation = process.env.GOOGLE_CLOUD_LOCATION;

  const hasGeminiApiKey = !!geminiApiKey;
  const hasGoogleApiKey = !!googleApiKey;
  const hasVertexProjectLocationConfig =
    !!googleCloudProject && !!googleCloudLocation;

  if (!hasGeminiApiKey && !hasGoogleApiKey && !hasVertexProjectLocationConfig) {
    logger.error(
      'No valid API authentication configuration found. Please set ONE of the following combinations in your environment variables or .env file:\n' +
        '1. GEMINI_API_KEY (for Gemini API access).\n' +
        '2. GOOGLE_API_KEY (for Gemini API or Vertex AI Express Mode access).\n' +
        '3. GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION (for Vertex AI access).\n\n' +
        'For Gemini API keys, visit: https://ai.google.dev/gemini-api/docs/api-key\n' +
        'For Vertex AI authentication, visit: https://cloud.google.com/vertex-ai/docs/start/authentication\n' +
        'The GOOGLE_GENAI_USE_VERTEXAI environment variable can also be set to true/false to influence service selection when ambiguity exists.',
    );
    // Instead of process.exit, we should throw an error or handle it gracefully
    throw new Error("Missing API authentication configuration for a2a-server.");
  }

  const args = getA2AServerArgs(); // Using simplified args for server
  const debugMode = args.debug;

  // For a2a-server, CWD might be the root of the a2a-server package or the overall project root.
  // This needs to be determined based on where a2a-server is run from.
  // Assuming process.cwd() is appropriate for now.
  const currentWorkingDirectory = process.cwd();

  const { memoryContent, fileCount } = await loadHierarchicalGeminiMemory(
    currentWorkingDirectory,
    debugMode,
  );

  const userAgent = await createUserAgent();
  const apiKeyForServer = geminiApiKey || googleApiKey || '';

  // These settings might come from a different source for a2a-server,
  // e.g., a dedicated config file or environment variables.
  // Using undefined or defaults for now.
  const settings = {
    coreTools: undefined, // Or load from a2a-specific settings
    toolDiscoveryCommand: undefined,
    toolCallCommand: undefined,
    mcpServerCommand: undefined,
    mcpServers: undefined,
    alwaysSkipModificationConfirmation: false, // Default
  };

  return createServerConfig(
    apiKeyForServer,
    args.model,
    args.sandbox,
    currentWorkingDirectory, // targetDir
    debugMode,
    args.prompt, // question - likely to be overridden per request
    args.all_files, // fullContext
    settings.coreTools,
    settings.toolDiscoveryCommand,
    settings.toolCallCommand,
    settings.mcpServerCommand,
    settings.mcpServers as Record<string, MCPServerConfig> | undefined, // Cast needed
    userAgent,
    memoryContent,
    fileCount,
    settings.alwaysSkipModificationConfirmation,
  );
}
