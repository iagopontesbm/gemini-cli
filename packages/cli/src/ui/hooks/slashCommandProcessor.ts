/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback } from 'react';
import { type PartListUnion } from '@google/genai';
import { getCommandFromQuery } from '../utils/commandUtils.js';
import { UseHistoryManagerReturn } from './useHistoryManager.js';

export interface SlashCommand {
  name: string;
  altName?: string;
  description: string;
  action: (value: PartListUnion) => void;
}

/**
 * Hook to define and process slash commands (e.g., /help, /clear).
 */
export const useSlashCommandProcessor = (
  addItemToHistory: UseHistoryManagerReturn['addItemToHistory'],
  _updateHistoryItem: UseHistoryManagerReturn['updateHistoryItem'], // Included for potential future use
  clearHistory: UseHistoryManagerReturn['clearHistory'],
  refreshStatic: () => void,
  setShowHelp: React.Dispatch<React.SetStateAction<boolean>>,
  setDebugMessage: React.Dispatch<React.SetStateAction<string>>,
  openThemeDialog: () => void,
) => {
  const slashCommands: SlashCommand[] = [
    {
      name: 'help',
      altName: '?',
      description: 'for help on gemini-code',
      action: (_value: PartListUnion) => {
        setDebugMessage('Opening help.');
        setShowHelp(true);
      },
    },
    {
      name: 'clear',
      description: 'clear the screen',
      action: (_value: PartListUnion) => {
        setDebugMessage('Clearing terminal.');
        clearHistory();
        refreshStatic();
      },
    },
    {
      name: 'theme',
      description: 'change the theme',
      action: (_value: PartListUnion) => {
        openThemeDialog();
      },
    },
    {
      name: 'quit',
      altName: 'exit',
      description: '',
      action: (_value: PartListUnion) => {
        setDebugMessage('Quitting. Good-bye.');
        getNextMessageId(Date.now());
        process.exit(0);
      },
    },
  ];

  /**
   * Checks if the query is a slash command and executes it if found.
   * Adds user query and potential error messages to history.
   * @returns True if the query was handled as a slash command (valid or invalid),
   *          false otherwise.
   */
  const handleSlashCommand = useCallback(
    (rawQuery: PartListUnion): boolean => {
      if (typeof rawQuery !== 'string') {
        return false;
      }

      const trimmed = rawQuery.trim();
      const [symbol, test] = getCommandFromQuery(trimmed);

      if (symbol !== '/' && symbol !== '?') {
        return false;
      }

      const userMessageTimestamp = Date.now();
      addItemToHistory({ type: 'user', text: trimmed }, userMessageTimestamp);

      for (const cmd of slashCommands) {
        if (
          test === cmd.name ||
          test === cmd.altName ||
          symbol === cmd.altName
        ) {
          cmd.action(trimmed);
          return true;
        }
      }

      // Unknown command: Add error message
      addItemToHistory(
        { type: 'error', text: `Unknown command: ${trimmed}` },
        userMessageTimestamp, // Use same base timestamp for related error
      );

      return true; // Indicate command was processed (even though invalid)
    },
    [
      setDebugMessage,
      addItemToHistory,
      slashCommands,
      setShowHelp,
      clearHistory,
      refreshStatic,
      openThemeDialog,
    ],
  );

  return { handleSlashCommand, slashCommands };
};
