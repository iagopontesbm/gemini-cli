import express, { Request, Response } from 'express';
import http from 'http';
import dotenv from 'dotenv';
import { FunctionDeclaration, Part } from '@google/genai';

// Import necessary components from the server package
import { loadEnvironment, createServerConfig } from './config/config.js';
import { GeminiClient } from './core/gemini-client.js';
import { GeminiEventType, ServerTool } from './core/turn.js';
import { ToolResult } from './tools/tools.js';
// Import tool logic classes (adjust imports as needed based on final structure)
import { ReadFileLogic } from './tools/read-file.js';
import { LSLogic } from './tools/ls.js';
import { GrepLogic } from './tools/grep.js';
import { GlobLogic } from './tools/glob.js';
import { EditLogic } from './tools/edit.js';
import { TerminalLogic } from './tools/terminal.js';
import { WriteFileLogic } from './tools/write-file.js';
import { WebFetchLogic } from './tools/web-fetch.js';

dotenv.config(); // Load environment variables from .env file

const app = express();
const port = process.env.PORT || 3000; // Default to port 3000 if not specified

// Middleware to parse JSON bodies
app.use(express.json());

// Basic health check endpoint
app.get('/healthz', (req: Request, res: Response) => {
  res.status(200).send('OK');
});

// Endpoint to handle user requests and generate responses via LLM
app.post('/api/generate', async (req: Request, res: Response) => {
  try {
    const userInput = req.body.prompt;

    if (!userInput || typeof userInput !== 'string') {
      return res
        .status(400)
        .json({
          error: 'Invalid request body. Expecting { "prompt": "string" }',
        });
    }

    console.log(`Received prompt: ${userInput}`);

    // Load environment variables
    loadEnvironment();

    const apiKey = process.env.GEMINI_API_KEY;
    // Use default if environment variable is missing
    const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest';
    // Use default if environment variable is missing
    const targetDir = process.env.TARGET_DIR || process.cwd();

    // Validate required environment variables
    if (!apiKey) {
      // API Key is still mandatory
      return res
        .status(500)
        .json({
          error: 'Internal Server Error',
          details: 'GEMINI_API_KEY environment variable is not set.',
        });
    }
    /* // Remove checks for model and targetDir as they now have defaults
    if (!model) {
      return res.status(500).json({ error: 'Internal Server Error', details: 'GEMINI_MODEL environment variable is not set.' });
    }
    if (!targetDir) {
      return res.status(500).json({ error: 'Internal Server Error', details: 'TARGET_DIR environment variable is not set.' });
    }
    */

    // Create server configuration (now uses potentially defaulted values)
    const config = createServerConfig(apiKey, model, targetDir);

    // Instantiate the Gemini client
    const geminiClient = new GeminiClient(apiKey, model);

    // Instantiate tools with correct arguments
    const tools = {
      readFile: new ReadFileLogic(config.getTargetDir()), // Pass targetDir
      ls: new LSLogic(config.getTargetDir()), // Pass targetDir
      grep: new GrepLogic(config.getTargetDir()), // Pass targetDir
      glob: new GlobLogic(config.getTargetDir()), // Pass targetDir
      edit: new EditLogic(config.getTargetDir()), // Pass targetDir
      terminal: new TerminalLogic(config.getTargetDir()), // Pass targetDir
      writeFile: new WriteFileLogic(config.getTargetDir()), // Pass targetDir
      webFetch: new WebFetchLogic(), // No arguments
    };

    // Prepare tool declarations and server tools for GeminiClient
    const toolInstances = Object.values(tools);

    const toolDeclarations: FunctionDeclaration[] = toolInstances
      .map((tool) => tool.schema as FunctionDeclaration)
      .filter((schema) => schema != null);

    const serverTools: ServerTool[] = toolInstances.map((tool) => ({
      name: tool.name,
      schema: tool.schema,
      execute: tool.execute.bind(tool) as unknown as (
        params: Record<string, unknown>,
      ) => Promise<ToolResult>,
    }));

    // Start the chat session
    const chat = await geminiClient.startChat(toolDeclarations);

    // Prepare the user message
    const requestParts: Part[] = [{ text: userInput }];

    // Send the message and process the stream
    let aggregatedResponse = '';
    const stream = geminiClient.sendMessageStream(
      chat,
      requestParts,
      serverTools,
    );

    for await (const event of stream) {
      if (event.type === GeminiEventType.Content) {
        aggregatedResponse += event.value;
      } else if (event.type === GeminiEventType.ToolCallRequest) {
        console.log(`[Server] Tool call requested: ${event.value.name}`);
      }
    }

    // Send the final aggregated response
    res.status(200).json({ response: aggregatedResponse });
  } catch (error: unknown) {
    console.error('[Server] Error processing /api/generate:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred';
    res
      .status(500)
      .json({ error: 'Internal Server Error', details: errorMessage });
  }
});

// Placeholder for other API routes
// Example: app.post('/apply', (req, res) => { /* ... logic ... */ });

// Create HTTP server instance
const server = http.createServer(app);

function startServer() {
  server.listen(port, () => {
    console.log(`HTTP server listening on port ${port}`);
  });
}

// Graceful shutdown
function shutdown() {
  console.log('Shutting down HTTP server...');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });

  // Force close after a timeout if graceful shutdown fails
  setTimeout(() => {
    console.error(
      'Could not close connections in time, forcefully shutting down',
    );
    process.exit(1);
  }, 10000); // 10 seconds timeout
}

// Handle termination signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the server
startServer();

// Export the app and server for potential testing or extension
export { app, server, startServer, shutdown };
