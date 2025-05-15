/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useMemo } from 'react';
import { type PartListUnion } from '@google/genai';
// import { getCommandFromQuery } from '../utils/commandUtils.js';
import { UseHistoryManagerReturn } from './useHistoryManager.js';
import { Config } from '@gemini-code/server'; // Import Config
import { Message, MessageType, HistoryItemWithoutId } from '../types.js'; // Import Message types
import {
  createShowMemoryAction,
  // SHOW_MEMORY_COMMAND_NAME, // Removed as unused due to backward compatibility removal
} from './useShowMemoryCommand.js';
// import { REFRESH_MEMORY_COMMAND_NAME } from './useRefreshMemoryCommand.js'; // Removed as unused
import {
  addMemoryEntry,
  deleteLastMemoryEntry,
  deleteAllAddedMemoryEntries,
} from '../../config/memoryUtils.js';

export interface SlashCommand {
  name: string;
  altName?: string;
  description: string;
  // Arguments: mainCommand, subCommand, further arguments string
  action: (mainCommand: string, subCommand?: string, args?: string) => void;
}

/**
 * Hook to define and process slash commands (e.g., /help, /clear).
 */
export const useSlashCommandProcessor = (
  config: Config | null, // Add config here
  addItem: UseHistoryManagerReturn['addItem'],
  clearItems: UseHistoryManagerReturn['clearItems'],
  refreshStatic: () => void,
  setShowHelp: React.Dispatch<React.SetStateAction<boolean>>,
  onDebugMessage: (message: string) => void,
  openThemeDialog: () => void,
  performMemoryRefresh: () => Promise<void>, // Add performMemoryRefresh prop
) => {
  const addMessage = useCallback(
    (message: Message) => {
      // Convert Message to HistoryItemWithoutId
      const historyItemContent: HistoryItemWithoutId = {
        type: message.type, // MessageType enum should be compatible with HistoryItemWithoutId string literal types
        text: message.content,
      };
      addItem(historyItemContent, message.timestamp.getTime());
    },
    [addItem],
  );

  const showMemoryAction = useCallback(async () => {
    const actionFn = createShowMemoryAction(config, addMessage);
    await actionFn();
  }, [config, addMessage]);

  // Define actions for memory commands
  const addMemoryAction = useCallback(
    async (_mainCommand: string, _subCommand?: string, args?: string) => {
      if (!args || args.trim() === '') {
        addMessage({
          type: MessageType.ERROR,
          content: 'Usage: /memory add <text to remember>',
          timestamp: new Date(),
        });
        return;
      }
      try {
        await addMemoryEntry(args);
        addMessage({
          type: MessageType.INFO,
          content: `Successfully added to memory: "${args}"`,
          timestamp: new Date(),
        });
        await performMemoryRefresh(); // Refresh memory to reflect changes
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        addMessage({
          type: MessageType.ERROR,
          content: `Failed to add memory: ${errorMessage}`,
          timestamp: new Date(),
        });
      }
    },
    [addMessage, performMemoryRefresh],
  );

  const deleteLastMemoryAction = useCallback(async () => {
    try {
      const deleted = await deleteLastMemoryEntry();
      if (deleted) {
        addMessage({
          type: MessageType.INFO,
          content: 'Successfully deleted the last added memory entry.',
          timestamp: new Date(),
        });
        await performMemoryRefresh();
      } else {
        addMessage({
          type: MessageType.INFO,
          content: 'No added memory entries found to delete.',
          timestamp: new Date(),
        });
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      addMessage({
        type: MessageType.ERROR,
        content: `Failed to delete last memory entry: ${errorMessage}`,
        timestamp: new Date(),
      });
    }
  }, [addMessage, performMemoryRefresh]);

  const deleteAllAddedMemoryAction = useCallback(async () => {
    try {
      const count = await deleteAllAddedMemoryEntries();
      if (count > 0) {
        addMessage({
          type: MessageType.INFO,
          content: `Successfully deleted ${count} added memory entries.`,
          timestamp: new Date(),
        });
        await performMemoryRefresh();
      } else {
        addMessage({
          type: MessageType.INFO,
          content: 'No added memory entries found to delete.',
          timestamp: new Date(),
        });
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      addMessage({
        type: MessageType.ERROR,
        content: `Failed to delete all added memory entries: ${errorMessage}`,
        timestamp: new Date(),
      });
    }
  }, [addMessage, performMemoryRefresh]);

  const slashCommands: SlashCommand[] = useMemo(
    () => [
      {
        name: 'help',
        altName: '?',
        description: 'for help on gemini-code',
        action: (_mainCommand, _subCommand, _args) => {
          onDebugMessage('Opening help.');
          setShowHelp(true);
        },
      },
      {
        name: 'clear',
        description: 'clear the screen',
        action: (_mainCommand, _subCommand, _args) => {
          onDebugMessage('Clearing terminal.');
          clearItems();
          console.clear();
          refreshStatic();
        },
      },
      {
        name: 'theme',
        description: 'change the theme',
        action: (_mainCommand, _subCommand, _args) => {
          openThemeDialog();
        },
      },
      {
        name: 'memory',
        description:
          'Manage memory. Usage: /memory <show|refresh|add|delete_last|delete_all_added> [text for add]',
        action: (mainCommand, subCommand, args) => {
          switch (subCommand) {
            case 'show':
              showMemoryAction();
              break;
            case 'refresh':
              performMemoryRefresh();
              break;
            case 'add':
              addMemoryAction(mainCommand, subCommand, args);
              break;
            case 'delete_last':
              deleteLastMemoryAction();
              break;
            case 'delete_all_added':
              deleteAllAddedMemoryAction();
              break;
            default:
              addMessage({
                type: MessageType.ERROR,
                content: `Unknown /memory command: ${subCommand}. Available: show, refresh, add, delete_last, delete_all_added`,
                timestamp: new Date(),
              });
          }
        },
      },
      {
        name: 'quit',
        altName: 'exit',
        description: 'exit the cli',
        action: (_mainCommand, _subCommand, _args) => {
          onDebugMessage('Quitting. Good-bye.');
          process.exit(0);
        },
      },
    ],
    [
      onDebugMessage,
      setShowHelp,
      refreshStatic,
      openThemeDialog,
      clearItems,
      performMemoryRefresh,
      showMemoryAction,
      addMemoryAction,
      deleteLastMemoryAction,
      deleteAllAddedMemoryAction,
      addMessage, // addMessage is used by memory actions
    ],
  );

  const handleSlashCommand = useCallback(
    (rawQuery: PartListUnion): boolean => {
      if (typeof rawQuery !== 'string') {
        return false;
      }

      const trimmed = rawQuery.trim();

      if (!trimmed.startsWith('/') && !trimmed.startsWith('?')) {
        return false;
      }

      const userMessageTimestamp = Date.now();

      addItem({ type: MessageType.USER, text: trimmed }, userMessageTimestamp);

      let subCommand: string | undefined;
      let args: string | undefined;

      const commandToMatch = (() => {
        if (trimmed.startsWith('?')) {
          return 'help'; // No subCommand or args for '?' acting as help
        }
        // For other slash commands like /memory add foo
        const parts = trimmed.substring(1).trim().split(/\s+/);
        if (parts.length > 1) {
          subCommand = parts[1];
        }
        if (parts.length > 2) {
          args = parts.slice(2).join(' ');
        }
        return parts[0]; // This is the main command name
      })();

      const mainCommand = commandToMatch;

      for (const cmd of slashCommands) {
        if (mainCommand === cmd.name || mainCommand === cmd.altName) {
          cmd.action(mainCommand, subCommand, args);
          return true;
        }
      }

      addMessage({
        type: MessageType.ERROR,
        content: `Unknown command: ${trimmed}`,
        timestamp: new Date(),
      });

      return true;
    },
    [
      addItem,
      slashCommands,
      addMessage,
      // performMemoryRefresh, // Removed based on lint suggestion and backward compat removal
      // showMemoryAction,     // Removed based on lint suggestion and backward compat removal
    ],
  );

  return { handleSlashCommand, slashCommands };
};
