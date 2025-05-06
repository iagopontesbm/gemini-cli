/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback } from 'react';
import { type PartListUnion } from '@google/genai';
// Removed HistoryItem import
import { getCommandFromQuery } from '../utils/commandUtils.js';
import { UseHistoryManagerReturn } from './useHistoryManager.js'; // Import the type

export interface SlashCommand {
  name: string; // slash command
  altName?: string; // alternative name for the command
  description: string; // flavor text in UI
  action: (value: PartListUnion) => void;
}

// Remove local addHistoryItem helper

export const useSlashCommandProcessor = (
  // Use functions from useHistoryManager
  addItemToHistory: UseHistoryManagerReturn['addItemToHistory'],
  _updateHistoryItem: UseHistoryManagerReturn['updateHistoryItem'], // Keep signature consistent, even if unused
  clearHistory: UseHistoryManagerReturn['clearHistory'],
  refreshStatic: () => void,
  setShowHelp: React.Dispatch<React.SetStateAction<boolean>>,
  setDebugMessage: React.Dispatch<React.SetStateAction<string>>,
  getNextMessageId: (baseTimestamp: number) => number, // Keep if needed for specific ID logic, though addItemToHistory handles it
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
        // Use clearHistory from the hook
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
        // No history item needed for quit, just exit
        process.exit(0);
      },
    },
  ];

  // Checks if the query is a slash command and executes the command if it is.
  const handleSlashCommand = useCallback(
    (rawQuery: PartListUnion): boolean => {
      if (typeof rawQuery !== 'string') {
        return false;
      }

      const trimmed = rawQuery.trim();
      const [symbol, test] = getCommandFromQuery(trimmed);

      // Skip non slash commands
      if (symbol !== '/' && symbol !== '?') {
        return false;
      }

      for (const cmd of slashCommands) {
        if (
          test === cmd.name ||
          test === cmd.altName ||
          symbol === cmd.altName
        ) {
          // Add user message *before* execution using the hook function
          const userMessageTimestamp = Date.now();
          addItemToHistory(
            { type: 'user', text: trimmed },
            userMessageTimestamp,
          );
          cmd.action(trimmed);
          return true; // Command was handled
        }
      }

      // If no command matched, add an error message
      const userMessageTimestamp = Date.now();
      addItemToHistory({ type: 'user', text: trimmed }, userMessageTimestamp);
      addItemToHistory(
        { type: 'error', text: `Unknown command: ${trimmed}` },
        getNextMessageId(userMessageTimestamp), // Use next ID for error
      );

      return true; // Indicate command was processed (even if invalid)
    },
    [
      setDebugMessage,
      addItemToHistory, // Updated dependency
      getNextMessageId,
      slashCommands,
      setShowHelp, // Added missing dependency
      clearHistory, // Added missing dependency
      refreshStatic, // Added missing dependency
      openThemeDialog, // Added missing dependency
    ],
  );

  return { handleSlashCommand, slashCommands };
};
