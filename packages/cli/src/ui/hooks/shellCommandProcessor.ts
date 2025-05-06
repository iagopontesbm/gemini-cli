/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { exec as _exec } from 'child_process';
import { useCallback } from 'react';
import { Config } from '@gemini-code/server';
import { type PartListUnion } from '@google/genai';
import { StreamingState } from '../types.js'; // Removed HistoryItem import
import { getCommandFromQuery } from '../utils/commandUtils.js';
import { UseHistoryManagerReturn } from './useHistoryManager.js'; // Import the type

// Remove local addHistoryItem helper

export const useShellCommandProcessor = (
  // Use functions from useHistoryManager
  addItemToHistory: UseHistoryManagerReturn['addItemToHistory'],
  _updateHistoryItem: UseHistoryManagerReturn['updateHistoryItem'], // Keep signature consistent
  setStreamingState: React.Dispatch<React.SetStateAction<StreamingState>>,
  setDebugMessage: React.Dispatch<React.SetStateAction<string>>,
  getNextMessageId: (baseTimestamp: number) => number, // Keep if needed for specific ID logic
  config: Config,
) => {
  const handleShellCommand = useCallback(
    (rawQuery: PartListUnion): boolean => {
      if (typeof rawQuery !== 'string') {
        return false; // Shell commands must be strings
      }

      const [symbol] = getCommandFromQuery(rawQuery);
      if (symbol !== '!' && symbol !== '$') {
        return false;
      }
      const trimmed = rawQuery.trim().slice(1).trimStart();

      if (!trimmed) {
        // Add user message even if command is empty, then show error
        const userMessageTimestamp = Date.now();
        addItemToHistory(
          { type: 'user', text: rawQuery },
          userMessageTimestamp,
        );
        addItemToHistory(
          { type: 'error', text: 'Empty shell command.' },
          getNextMessageId(userMessageTimestamp),
        );
        return true; // Handled (by showing error)
      }

      // Add user message *before* execution starts
      const userMessageTimestamp = Date.now();
      addItemToHistory({ type: 'user', text: rawQuery }, userMessageTimestamp);

      // Execute and capture output
      const targetDir = config.getTargetDir();
      setDebugMessage(`Executing shell command in ${targetDir}: ${trimmed}`);
      const execOptions = {
        cwd: targetDir,
      };

      setStreamingState(StreamingState.Responding);

      _exec(trimmed, execOptions, (error, stdout, stderr) => {
        const timestamp = getNextMessageId(userMessageTimestamp); // Use user message time as base
        if (error) {
          addItemToHistory({ type: 'error', text: error.message }, timestamp);
        } else {
          // Combine stdout and stderr into a single info message
          let output = '';
          if (stdout) output += stdout;
          if (stderr) output += (output ? '\n' : '') + stderr; // Add stderr if present

          addItemToHistory(
            { type: 'info', text: output || '(Command produced no output)' },
            timestamp,
          );
        }
        setStreamingState(StreamingState.Idle);
      });

      return true; // Command was handled
    },
    [
      config,
      setDebugMessage,
      addItemToHistory, // Updated dependency
      setStreamingState,
      getNextMessageId,
    ],
  );

  return { handleShellCommand };
};
