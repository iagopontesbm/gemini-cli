import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import path from 'path';
// import helmet from 'helmet'; // For security headers - conceptual for now
import { getConfig } from './coreConfig';
import {
  GeminiChat,
  Turn,
  ChatConfig,
} from '@google/gemini-cli-core';

// --- Security Configuration ---
const WORKSPACE_ROOT = path.resolve(process.cwd(),
  process.env.NODE_ENV === 'test' ? 'user_workspace_test_files' : 'user_workspace'
);
fs.mkdir(WORKSPACE_ROOT, { recursive: true }).catch(console.error); // Ensure it exists
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit for file content - adjust as needed
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

const app = express();
const port = process.env.PORT || 3001;

// app.use(helmet()); // Use Helmet for security headers - conceptual
app.use(express.json({ limit: '1mb' })); // Limit request body size for JSON payloads

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  // In test environment, logging can be noisy. Optionally disable or reduce it.
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} from ${req.ip}`);
  }
  next();
});

// Helper function to resolve and validate user paths against WORKSPACE_ROOT
function resolveUserPath(userPath: string): string | null {
  if (typeof userPath !== 'string' || userPath.includes('\0') || !/^[\w\-. /]+$/.test(userPath)) {
    console.warn(`Invalid characters in user path: ${userPath}`);
    return null; // Invalid characters or null byte attack
  }
  const resolvedPath = path.resolve(WORKSPACE_ROOT, path.normalize(userPath));
  if (!resolvedPath.startsWith(WORKSPACE_ROOT + path.sep) && resolvedPath !== WORKSPACE_ROOT) {
    console.warn(`Path traversal attempt detected: ${userPath} resolved to ${resolvedPath} (WS_ROOT: ${WORKSPACE_ROOT})`);
    return null;
  }
  return resolvedPath;
}

// API Endpoints
app.post('/api/chat', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message: userInput, history = [], fileContexts = [] } = req.body;

    if (typeof userInput !== 'string' && userInput !== undefined) {
        return res.status(400).json({ error: 'Invalid message format.' });
    }
    if (!Array.isArray(history) || !Array.isArray(fileContexts)) {
        return res.status(400).json({ error: 'Invalid history or fileContexts format.' });
    }
    // Basic validation for fileContexts structure
    for (const fc of fileContexts) {
        if (typeof fc.fileName !== 'string' || typeof fc.content !== 'string') {
            return res.status(400).json({ error: 'Invalid fileContext item format.' });
        }
         // Basic check for content length, though server limit on request body is primary
        if (fc.content.length > MAX_FILE_SIZE_BYTES) { // Reuse MAX_FILE_SIZE_BYTES or a specific context limit
            return res.status(413).json({ error: `File context for ${fc.fileName} is too large.` });
        }
    }


    if (!userInput && fileContexts.length === 0) {
      return res.status(400).json({ error: 'Message or file context is required' });
    }

    const coreConfig = await getConfig();
    let augmentedUserInput = userInput || ""; // Ensure userInput is a string

    if (fileContexts.length > 0) {
      const fileContextString = fileContexts.map(fc =>
        `\n--- File: ${fc.fileName} ---\n${fc.content.substring(0, 20000)}...\n--- End File: ${fc.fileName} ---` // Truncate long contexts
      ).join('\n');
      augmentedUserInput = userInput
        ? `${fileContextString}\n\nUser query based on the files above:\n${userInput}`
        : fileContextString;
    }

    const chatSpecificConfig: Partial<ChatConfig> = {};
    const chat = new GeminiChat(coreConfig, chatSpecificConfig, history as Turn[]); // Cast history
    const responseTurn: Turn = await chat.sendMessage(augmentedUserInput);

    let assistantResponseText = 'Could not extract a text response from the model.';
    if (responseTurn && responseTurn.parts) {
        const textPart = responseTurn.parts.find(part => part.text !== undefined && part.text !== null);
        if (textPart && typeof textPart.text === 'string') {
            assistantResponseText = textPart.text;
        } else {
            if (responseTurn.parts.some(part => part.toolCall !== undefined)) {
                assistantResponseText = '[Model is attempting to use a tool. Tool handling not yet implemented in Web UI.]';
            } else if (responseTurn.parts.length > 0) {
                assistantResponseText = '[Model responded with non-text content.]';
            }
        }
    } else if (typeof responseTurn === 'string') {
        assistantResponseText = responseTurn;
    }

    res.json({
      reply: assistantResponseText,
      newHistory: chat.getHistory(),
    });

  } catch (error) {
    next(error); // Pass to global error handler
  }
});

// Session Management API (Placeholder)
app.get('/api/session', (req: Request, res: Response) => {
  res.json({ sessionId: 'mock-session-id', history: [] }); // Placeholder
});

app.post('/api/session', (req: Request, res: Response) => {
  res.json({ sessionId: 'mock-session-id', message: 'Session updated' }); // Placeholder
});

// Tools API (Placeholder)
app.post('/api/tools/:tool_name', (req: Request, res: Response) => {
  const { tool_name } = req.params;
  // TODO: Add input validation for tool_name and args
  console.log(`Tool call attempt: ${tool_name}`);
  res.status(501).json({ error: `Tool ${tool_name} not implemented.` });
});

// Authentication API (Placeholders)
app.get('/api/auth/status', (req: Request, res: Response) => {
  res.json({ isAuthenticated: false, user: null }); // Placeholder
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  res.status(501).json({ error: 'Login not implemented' }); // Placeholder
});

app.get('/api/auth/callback', (req: Request, res: Response) => {
  res.status(501).json({ error: 'Auth callback not implemented' }); // Placeholder
});

// File System API
app.get('/api/files/list', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const relativeUserPath = (req.query.path as string || '.').trim();
    const currentPath = resolveUserPath(relativeUserPath);

    if (!currentPath) {
      return res.status(403).json({ error: 'Access denied or invalid path.' });
    }

    const dirents = await fs.readdir(currentPath, { withFileTypes: true });
    const files = dirents
      .filter(dirent => !dirent.name.startsWith('.')) // Exclude hidden files
      .map(dirent => ({
        name: dirent.name,
        isDirectory: dirent.isDirectory(),
      }));

    const breadcrumbs = path.relative(WORKSPACE_ROOT, currentPath)
                              .split(path.sep)
                              .filter(p => p && p !== '.')
                              .map((name, index, arr) => ({
                                  name,
                                  path: arr.slice(0, index + 1).join(path.sep),
                              }));

    const breadcrumbBase = [{ name: path.basename(WORKSPACE_ROOT) || 'Workspace', path: '.' }];

    res.json({
      path: path.relative(WORKSPACE_ROOT, currentPath) || '.',
      files,
      breadcrumbs: breadcrumbBase.concat(breadcrumbs),
      workspaceRootName: path.basename(WORKSPACE_ROOT)
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/files/content', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const relativeFilePath = req.query.path as string;
    if (!relativeFilePath || typeof relativeFilePath !== 'string') {
      return res.status(400).json({ error: 'File path is required and must be a string.' });
    }

    const filePath = resolveUserPath(relativeFilePath.trim());
    if (!filePath) {
      return res.status(403).json({ error: 'Access denied or invalid file path.' });
    }

    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      return res.status(400).json({ error: 'Path is a directory, not a file.' });
    }
    if (stat.size > MAX_FILE_SIZE_BYTES) {
      return res.status(413).json({ error: `File is too large (max ${MAX_FILE_SIZE_BYTES / (1024*1024)}MB).` });
    }
    const content = await fs.readFile(filePath, 'utf-8');
    res.type('text/plain').send(content);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found.' });
    }
    next(error);
  }
});

// Global error handler - must be defined last
// istanbul ignore next
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err.message);
  console.error(err.stack); // Log stack for debugging

  // Avoid sending stack trace in non-development environments
  const errorResponse: { error: string; details?: string; stack?: string } = {
    error: 'An unexpected error occurred on the server.',
  };

  if (IS_DEVELOPMENT) {
    errorResponse.details = err.message;
    errorResponse.stack = err.stack;
  }

  // Ensure response is sent only once
  if (!res.headersSent) {
    res.status(500).json(errorResponse);
  }
});

// Conditional listen for testing
// istanbul ignore next
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Backend server is running on http://localhost:${port}`);
    console.log(`Workspace root is ${WORKSPACE_ROOT}`);
    console.log(`Development mode: ${IS_DEVELOPMENT}`);
    // Reminder for real projects:
    // console.log("Remember to run 'npm audit' regularly for security vulnerabilities.");
    // console.log("Consider using Helmet.js for security-related HTTP headers.");
  });
}

export { app }; // Export app for testing
