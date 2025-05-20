/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { GeminiClient, Config } from '@gemini-code/server'; // Updated import
import { loadA2AServerConfig } from './config.js'; // Import the new config loader

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3001;

// Load configuration once when the server starts
let serverConfig: Config;

async function initializeConfig() {
  try {
    serverConfig = await loadA2AServerConfig();
    console.log('A2A Server configuration loaded successfully.');
  } catch (error) {
    console.error('Failed to load A2A Server configuration:', error);
    process.exit(1); // Exit if configuration fails
  }
}

initializeConfig().then(() => {
  wss.on('connection', (ws: WebSocket) => {
    console.log('Client connected');

    // Each connection gets its own GeminiClient, initialized with the shared serverConfig
    // If per-connection config variations are needed, this could be adjusted
    const geminiClient = new GeminiClient(serverConfig);
    let chat: ReturnType<typeof geminiClient.startChat> extends Promise<infer T> ? T : never;

    geminiClient.startChat().then(newChat => {
      chat = newChat;
      console.log('New chat session started for client.');
      ws.send('Chat session initialized.'); // Optional: notify client
    }).catch(error => {
      console.error('Failed to start chat session:', error);
      ws.send(JSON.stringify({ error: 'Failed to initialize chat session' }));
      ws.close(); // Close connection if chat fails to start
      return;
    });

    ws.on('message', async (message: WebSocket.RawData) => {
      if (!chat) {
        console.log('Chat not initialized yet, ignoring message.');
        ws.send(JSON.stringify({ error: 'Chat not ready, please wait.' }));
        return;
      }
      try {
        const userMessage = message.toString();
        console.log('Received message:', userMessage);

        // Process the message using the chat instance
        const stream = geminiClient.sendMessageStream(chat, [{ text: userMessage }]);
        for await (const event of stream) {
          // Assuming ServerGeminiStreamEvent has a structure that can be sent to the client
          // You might need to format this event or extract relevant data
          ws.send(JSON.stringify(event));
        }
      } catch (error) {
        console.error('Error processing message:', error);
        ws.send(JSON.stringify({ error: 'Failed to process message' }));
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected');
      // TODO: Clean up any resources associated with this client/GeminiClient instance
    });

    ws.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
      // TODO: Handle WebSocket errors
    });

    ws.send('Welcome to the A2A server!');
  }); // Close wss.on('connection')

  server.listen(PORT, () => {
    console.log(`A2A Server is listening on port ${PORT}`);
  });

  // Handle server errors
  server.on('error', (error: Error) => {
    console.error('Server error:', error);
    // Potentially exit or attempt to restart if critical
  });

}).catch(error => {
  // This catch is for errors during initializeConfig itself
  console.error("Critical error during server initialization:", error);
  process.exit(1);
});
