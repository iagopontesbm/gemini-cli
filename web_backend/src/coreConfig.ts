import { Config, type GeminiConfig } from '@google/gemini-cli-core';
import { homedir } from 'node:os';
import { join } from 'node:path';

// sessionId is typically unique per user session or application instance
const sessionId = `webui-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

// Basic configuration for the backend.
// Many of these settings might need to be adjusted or made configurable.
const geminiBackendConfig: Partial<GeminiConfig> = {
  // Assuming API key is set via environment variable
  // GEMINI_API_KEY will be picked up by the core library if set
  // selectedAuthType: AuthType.USE_GEMINI, // This might be set if GEMINI_API_KEY is present

  // Paths - these might not be directly relevant in a pure backend API context
  // unless tools that operate on local files are used.
  // For now, let's use some defaults that are unlikely to cause issues.
  workspaceRoot: process.cwd(), // Or a specific workspace for the backend
  configDir: join(homedir(), '.gemini-webui'), // A dedicated config dir for the web UI backend

  // Tool configurations - to be refined in later steps
  allowlistedTools: [], // Start with no tools allowed by default for safety
  excludeTools: [],
  extraTools: [],
  overrideTools: false,

  // Model configuration
  // model: DEFAULT_GEMINI_MODEL, // Will use default from core library

  // Other settings
  debugMode: process.env.NODE_ENV === 'development',
  nonInteractive: true, // Backend should generally be non-interactive
  approvalMode: 'auto', // Or 'yolo' for non-interactive, 'cli' would require input
  showSpinner: false,
  showProgress: false,
  showPrompts: process.env.NODE_ENV === 'development', // For debugging
  checkpointingEnabled: false, // May not be directly applicable or needs careful thought for web
  contextFileName: ['GEMINI.md', '.gemini.md'], // Default context file names
  maxTokens: undefined, // Use default
  maxToolRetries: 3,
  maxToolRoundTrips: 10,
  confirmLargeFileReads: false, // Assume non-interactive confirmation
  largeFileReadThresholdBytes: 1024 * 1024 * 1, // 1MB, needs adjustment
  autoConfigureMaxOldSpaceSize: false, // Not relevant for server usually
  hideToolErrors: false,
  // extensions: [], // Assuming no extensions initially
  // mcpServers: [],
  // sandbox: undefined, // Sandbox config for tools, needs careful design for web
};

let configInstance: Config | null = null;

export async function getConfig(): Promise<Config> {
  if (configInstance) {
    return configInstance;
  }

  // The core Config constructor or a factory function might take these arguments.
  // This is an educated guess based on typical CLI patterns.
  // The actual instantiation might differ and may require looking into
  // how `loadCliConfig` in `packages/cli/src/gemini.tsx` works internally.
  // For now, we assume Config can be instantiated somewhat directly or with a factory.
  try {
    // Assuming Config class can be directly instantiated or has a static factory.
    // The actual parameters for Config might be different.
    // We'll need to adjust if Config expects extensions, specific settings objects etc.
    // For now, passing the partial config and a session ID.
    // The core library's `Config` constructor might load further settings from files or env vars.
    configInstance = new Config(sessionId, geminiBackendConfig as GeminiConfig);

    // Initialize services if needed (example from CLI)
    // configInstance.getFileService(); // This might be needed if tools use it
    // await configInstance.getGitService(); // If git features are used

    // It's crucial that the API key is available.
    // The core library likely checks for GEMINI_API_KEY environment variable.
    // We might need to explicitly initialize auth if that's not automatic.
    // e.g. await configInstance.refreshAuth(AuthType.USE_GEMINI); if API key is set.
    // This step will be refined when auth is fully implemented.

    console.log('Core Config initialized for backend.');
  } catch (error) {
    console.error('Failed to initialize Core Config:', error);
    // This is a critical error, the application might not function correctly.
    // Depending on the error, we might want to throw or exit.
    throw new Error('Core Config initialization failed. Backend cannot start.');
  }

  return configInstance;
}

// Helper to get the Gemini API client from the config
export async function getGeminiClient() {
  const config = await getConfig();
  // The method to get the actual client might be named differently, e.g., .getApiClient(), .geminiClient
  // This assumes a method like getGeminiClient() exists on Config that returns the configured client.
  const client = config.getGeminiClient(); // This is a guess, need to verify
  if (!client) {
    throw new Error('Gemini client not available from core config. Check API key and initialization.');
  }
  return client;
}
