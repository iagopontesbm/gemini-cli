/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn } from 'child_process';
import { HistoryItem } from '../types.js';
/**
 * Checks if a query string potentially represents an '@' command.
 * It triggers if the query starts with '@' or contains '@' preceded by whitespace
 * and followed by a non-whitespace character.
 *
 * @param query The input query string.
 * @returns True if the query looks like an '@' command, false otherwise.
 */
export const isAtCommand = (query: string): boolean =>
  // Check if starts with @ OR has a space, then @
  query.startsWith('@') || /\s@/.test(query);

/**
 * Checks if a query string potentially represents an '/' command.
 * It triggers if the query starts with '/'
 *
 * @param query The input query string.
 * @returns True if the query looks like an '/' command, false otherwise.
 */
export const isSlashCommand = (query: string): boolean => query.startsWith('/');

export const copyToClipboard = (text: string) => {
  let command: string;
  let args: string[] = [];

  switch (process.platform) {
    case 'win32':
      command = 'clip';
      break;
    case 'darwin':
      command = 'pbcopy';
      break;
    case 'linux':
      // Try xclip first, fallback to xsel
      command = 'xclip';
      args = ['-selection', 'clipboard'];
      break;
    default:
      console.error(`Unsupported platform: ${process.platform}`);
      return;
  }

  const child = spawn(command, args);

  // Handle fallback for Linux (xsel) if xclip fails
  child.on('error', (err) => {
    if (process.platform === 'linux' && command === 'xclip') {
      console.warn('xclip not found, trying xsel...');
      const fallbackChild = spawn('xsel', ['--clipboard', '--input']);
      fallbackChild.on('error', () => {
        console.error('xsel also not found. Clipboard not supported.');
      });
      fallbackChild.stdin.write(text);
      fallbackChild.stdin.end();
    } else {
      console.error(`Failed to run ${command}:`, err.message);
    }
  });

  child.stdin.write(text);
  child.stdin.end();
};

export const getLastResultOrSnippet = (history: HistoryItem[]) => {
    for (let i = history.length - 1; i >= 0; i--) {
      const item = history[i];
      if (item.type === 'gemini' || item.type === 'gemini_content') {
        return item.text.trim();
      }
      if (item.type === 'tool_group' && Array.isArray(item.tools)) {
        for (const toolCall of item.tools) {
          if (toolCall.resultDisplay) {
            return toolCall.resultDisplay.toString().trim();
          }
        }
      }
    }
    return null;
  };
