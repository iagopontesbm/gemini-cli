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

export const useSlashCommandProcessor = (
  addItemToHistory: UseHistoryManagerReturn['addItemToHistory'],
  _updateHistoryItem: UseHistoryManagerReturn['updateHistoryItem'],
  clearHistory: UseHistoryManagerReturn['clearHistory'],
  refreshStatic: () => void,
  setShowHelp: React.Dispatch<React.SetStateAction<boolean>>,
  setDebugMessage: React.Dispatch<React.SetStateAction<string>>,
  // Removed getNextMessageId
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
        process.exit(0);
      },
    },
  ];

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

      for (const cmd of slashCommands) {
        if (
          test === cmd.name ||
          test === cmd.altName ||
          symbol === cmd.altName
        ) {
          const userMessageTimestamp = Date.now();
          addItemToHistory(
            { type: 'user', text: trimmed },
            userMessageTimestamp,
          );
          cmd.action(trimmed);
          return true;
        }
      }

      // Unknown command: Add user message and error message
      const userMessageTimestamp = Date.now();
      addItemToHistory({ type: 'user', text: trimmed }, userMessageTimestamp);
      // Use addItemToHistory for the error message, relying on its internal ID generation
      addItemToHistory(
        { type: 'error', text: `Unknown command: ${trimmed}` },
        userMessageTimestamp, // Use same base timestamp
      );

      return true;
    },
    [
      setDebugMessage,
      addItemToHistory,
      // Removed getNextMessageId
      slashCommands,
      setShowHelp,
      clearHistory,
      refreshStatic,
      openThemeDialog,
    ],
  );

  return { handleSlashCommand, slashCommands };
};
