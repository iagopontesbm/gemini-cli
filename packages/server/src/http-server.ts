import express, { Request, Response } from 'express';
import http from 'http';
import dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { FunctionDeclaration, Part, PartListUnion } from '@google/genai';

// Import necessary components from the server package
import { loadEnvironment, createServerConfig } from './config/config.js';
import { GeminiClient } from './core/gemini-client.js';
import { GeminiEventType, ServerTool } from './core/turn.js';
import { ToolResult, ToolResultDisplay } from './tools/tools.js';
// Import the event type definition from turn.ts
import type { ServerGeminiStreamEvent, AwaitingConfirmationInfo } from './core/turn.js';
// Import tool logic classes (adjust imports as needed based on final structure)
import { ReadFileLogic } from './tools/read-file.js';
import { LSLogic } from './tools/ls.js';
import { GrepLogic } from './tools/grep.js';
import { GlobLogic } from './tools/glob.js';
import { EditLogic } from './tools/edit.js';
import { TerminalLogic } from './tools/terminal.js';
import { WriteFileLogic } from './tools/write-file.js';
import { WebFetchLogic } from './tools/web-fetch.js';
// Import ToolCallResultInfo for building the payload
import type { ToolCallResultInfo } from './core/turn.js';
// Import error utility
import { getErrorMessage } from './utils/errors.js';

// Update PendingConfirmation to store Promise resolvers
interface PendingConfirmation {
  callId: string;
  name: string;
  args: Record<string, unknown>;
  toolDefinition: ServerTool;
  sseResponseRef: Response;
  resolve: (result: ToolResult) => void; // Resolve function
  reject: (error: Error) => void; // Reject function
}

const pendingConfirmations = new Map<string, PendingConfirmation>();

// Define the structure for Server-Sent Events
interface SseEvent {
  type: 'content' | 'tool_call_request' | 'tool_call_result' | 'error' | 'done' | 'tool_confirmation_request';
  payload: any;
}

dotenv.config(); // Load environment variables from .env file

const app = express();
const port = process.env.PORT || 3000; // Default to port 3000 if not specified

// Middleware to parse JSON bodies
app.use(express.json());

// Helper function to send SSE data
const sendSseEvent = (res: Response, eventData: SseEvent) => {
  res.write(`data: ${JSON.stringify(eventData)}\n\n`);
};

// Basic health check endpoint
app.get('/healthz', (req: Request, res: Response) => {
  res.status(200).send('OK');
});

// --- Re-add Server Logging Setup ---
const logFilePathServer = path.resolve(process.cwd(), 'server-debug.log');
const logToServerFile = (message: string) => {
  try {
    fs.appendFileSync(logFilePathServer, `${new Date().toISOString()} - ${message}\n`, 'utf8');
  } catch (err) {
    console.error('Failed to write to server debug log file:', err);
  }
};
try {
  if (fs.existsSync(logFilePathServer)) {
    fs.unlinkSync(logFilePathServer);
  }
} catch (err) { /* ignore */ }
logToServerFile('Server process started.');
// --- End Logging Setup ---

// Change POST to GET for SSE endpoint, pass prompt as query param
app.get('/api/generate', async (req: Request, res: Response) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // Flush headers to establish SSE connection

  // Get prompt from query parameter
  const userInput = req.query.prompt as string | undefined;

  if (!userInput || typeof userInput !== 'string') {
    sendSseEvent(res, { type: 'error', payload: 'Invalid request. Expecting ?prompt=... query parameter.' });
    res.end();
    return;
  }

  // Keep track of connection status
  let isClosed = false;
  req.on('close', () => {
    isClosed = true;
    // TODO: Potentially signal GeminiClient to abort?
  });

  try {
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
      sendSseEvent(res, { type: 'error', payload: 'GEMINI_API_KEY environment variable is not set.' });
      res.end();
      return;
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

    // Prepare server tools, including the confirmation flag
    const serverTools: ServerTool[] = toolInstances.map((tool) => ({
      name: tool.name,
      schema: tool.schema,
      // Copy the flag if it exists on the instance
      requiresConfirmation: (tool as any).requiresConfirmation ?? false,
      execute: tool.execute.bind(tool) as unknown as (
        params: Record<string, unknown>,
      ) => Promise<ToolResult>,
    }));

    // Start the chat session
    let chat = await geminiClient.startChat(toolDeclarations);
    let currentRequestParts: PartListUnion = [{ text: userInput }];
    let turnCount = 0; // Prevent infinite loops
    const MAX_TURNS = 10;

    // Loop to handle potential subsequent turns after confirmation
    while (turnCount < MAX_TURNS) {
        turnCount++;
        logToServerFile(`[Generate Handler] Starting Turn ${turnCount} with request: ${JSON.stringify(currentRequestParts)}`);
        const stream: AsyncGenerator<ServerGeminiStreamEvent> = geminiClient.sendMessageStream(chat, currentRequestParts, serverTools);
        let awaitingConfirmation = false;
        let needsNextTurn = false;

        for await (const event of stream) {
          if (isClosed) break;

          if (event.type === GeminiEventType.Content) {
            sendSseEvent(res, { type: 'content', payload: event.value });
          } else if (event.type === GeminiEventType.ToolCallRequest) {
            sendSseEvent(res, { type: 'tool_call_request', payload: event.value });
          } else if (event.type === GeminiEventType.ToolCallResult) {
            sendSseEvent(res, { type: 'tool_call_result', payload: event.value });
            needsNextTurn = true; // Tool results mean we need to send FunctionResponse back
          } else if (event.type === GeminiEventType.AwaitingConfirmation) {
            const payload: AwaitingConfirmationInfo = event.value;
            const toolDefinition = Object.values(tools).find(t => t.name === payload.name);
            if (!toolDefinition) { /* ... handle missing tool ... */ continue; }

            awaitingConfirmation = true;
            needsNextTurn = true; // Confirmation also implies needing a next turn

            // Create the promise and store details
            const confirmationPromise = new Promise<ToolResult>((resolve, reject) => {
                 pendingConfirmations.set(payload.callId, {
                   ...payload,
                   toolDefinition: toolDefinition as unknown as ServerTool,
                   sseResponseRef: res,
                   resolve, // Store resolve
                   reject, // Store reject
                 });
            });

            // Send request to client
            sendSseEvent(res, { type: 'tool_confirmation_request', payload: payload });
            logToServerFile(`[Generate Handler] Stored pending confirmation for ${payload.callId}, awaiting promise...`);

            try {
                 // Wait for the confirmation response
                 const confirmedToolResult = await confirmationPromise;
                 logToServerFile(`[Generate Handler] Confirmation promise resolved for ${payload.callId}`);
                 // Prepare FunctionResponse for next turn
                 currentRequestParts = [{
                    functionResponse: {
                        name: payload.name,
                        id: payload.callId,
                        response: { output: confirmedToolResult.llmContent ?? '' }
                    }
                 }];

            } catch (confirmationError) {
                 logToServerFile(`[Generate Handler] Confirmation promise rejected for ${payload.callId}: ${confirmationError}`);
                 // Prepare FunctionResponse with error for next turn
                 currentRequestParts = [{
                     functionResponse: {
                         name: payload.name,
                         id: payload.callId,
                         response: { error: `Tool denied or failed: ${getErrorMessage(confirmationError)}` }
                     }
                 }];
            }
            // Important: Break the inner stream loop to start the next turn
            break;
          }
        } // End for await (stream)

        if (isClosed) break; // Break outer loop if client disconnected

        // If we were awaiting confirmation and broke the inner loop, continue outer loop for next turn
        if (awaitingConfirmation) {
             logToServerFile(`[Generate Handler] Proceeding to next turn after confirmation handling for Turn ${turnCount}`);
             continue;
        }

        // If tools were executed immediately (not awaiting confirmation), check if we need another turn
        const turn = (stream as any)._turn; // Hacky way to access turn instance if needed
        const fnResponses = turn ? turn.getFunctionResponses() : [];
        if (fnResponses.length > 0 && needsNextTurn) {
            logToServerFile(`[Generate Handler] Proceeding to next turn with ${fnResponses.length} function responses for Turn ${turnCount}`);
            currentRequestParts = fnResponses;
            continue;
        }

        // If no more confirmations and no function responses needed, break the outer loop
        logToServerFile(`[Generate Handler] No more turns needed after Turn ${turnCount}.`);
        break;

    } // End while (turnCount)

    if (turnCount >= MAX_TURNS) {
         logToServerFile('[Generate Handler] Reached max turn limit.');
         // Optionally send a timeout error via SSE
    }

    if (!isClosed) {
      sendSseEvent(res, { type: 'done', payload: null });
    }

  } catch (error: unknown) {
    console.error('[Server] Error processing /api/generate stream:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred';
    if (!isClosed) {
      sendSseEvent(res, { type: 'error', payload: errorMessage });
    }
  } finally {
    console.log(`SSE stream processing finished for prompt: ${userInput}. Connection may remain open for confirmations.`);
  }
});

// --- Endpoint: Handle Confirmation Decision (Updated) ---
app.post('/api/confirmTool', async (req: Request, res: Response) => {
  const { callId, confirmed } = req.body;

  if (typeof callId !== 'string' || typeof confirmed !== 'boolean') {
    return res.status(400).json({ error: 'Invalid request body. Expecting { callId: string, confirmed: boolean }' });
  }

  const pendingRequest = pendingConfirmations.get(callId);

  if (!pendingRequest) {
    console.warn(`[confirmTool] Confirmation received for unknown or expired callId: ${callId}`);
    return res.status(404).json({ error: 'Tool call ID not found or already handled.' });
  }

  // Remove from map immediately
  pendingConfirmations.delete(callId);
  console.log(`[confirmTool] Handling decision for ${callId}: ${confirmed}`);

  const { resolve, reject, sseResponseRef } = pendingRequest;
  let toolResult: ToolResult | null = null;
  let executionError: Error | null = null;
  let resultStatus: 'success' | 'error' = 'success';

  if (confirmed) {
    try {
      console.log(`[confirmTool] Executing confirmed tool: ${pendingRequest.name}`);
      toolResult = await pendingRequest.toolDefinition.execute(pendingRequest.args);
      console.log(`[confirmTool] Execution success for ${callId}`);
    } catch (error) {
      console.error(`[confirmTool] Execution error for ${callId}:`, error);
      executionError = error instanceof Error ? error : new Error(String(error));
      resultStatus = 'error';
    }
  } else {
    console.log(`[confirmTool] Execution denied by user for ${callId}`);
    executionError = new Error('Tool execution denied by user.');
    // Override toolResult for denial message
    toolResult = { llmContent: `Tool call ${pendingRequest.name} denied by user.`, returnDisplay: 'Denied by user.' };
    resultStatus = 'error'; // Treat denial as an error status for display
  }

  // Send ToolCallResult SSE *before* resolving/rejecting the promise
  const resultPayload: ToolCallResultInfo = {
    callId: pendingRequest.callId,
    name: pendingRequest.name,
    status: resultStatus,
    resultDisplay: toolResult?.returnDisplay,
    errorMessage: executionError?.message,
  };
  if (sseResponseRef && !sseResponseRef.writableEnded) {
      try {
         console.log(`[confirmTool] Sending tool_call_result SSE for ${callId}`);
         sendSseEvent(sseResponseRef, { type: 'tool_call_result', payload: resultPayload });
      } catch (sseError) {
          console.error(`[confirmTool] Failed to send SSE result for ${callId}:`, sseError);
      }
  } else {
    console.warn(`[confirmTool] SSE connection for ${callId} already closed. Cannot send result.`);
  }

  // Resolve or reject the promise awaited by the /api/generate handler
  if (executionError) {
    console.log(`[confirmTool] Rejecting promise for ${callId}`);
    reject(executionError);
  } else if (toolResult) {
    console.log(`[confirmTool] Resolving promise for ${callId}`);
    resolve(toolResult);
  }

  res.status(200).json({ message: `Confirmation for ${callId} processed.` });
});
// --- END Endpoint ---

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

