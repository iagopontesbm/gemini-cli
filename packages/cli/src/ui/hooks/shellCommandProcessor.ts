/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { exec as _exec } from 'child_process';
import { useCallback } from 'react';
import { Config } from '@gemini-code/server';
import { type PartListUnion } from '@google/genai';
import { StreamingState } from '../types.js';
import { getCommandFromQuery } from '../utils/commandUtils.js';
import { UseHistoryManagerReturn } from './useHistoryManager.js';

export const useShellCommandProcessor = (
  addItemToHistory: UseHistoryManagerReturn['addItemToHistory'],
  _updateHistoryItem: UseHistoryManagerReturn['updateHistoryItem'],
  setStreamingState: React.Dispatch<React.SetStateAction<StreamingState>>,
  setDebugMessage: React.Dispatch<React.SetStateAction<string>>,
  // Removed getNextMessageId
  config: Config,
) => {
  const handleShellCommand = useCallback(
    (rawQuery: PartListUnion): boolean => {
      if (typeof rawQuery !== 'string') {
        return false;
      }

      const [symbol] = getCommandFromQuery(rawQuery);
      if (symbol !== '!' && symbol !== '$') {
        return false;
      }
      const trimmed = rawQuery.trim().slice(1).trimStart();

      const userMessageTimestamp = Date.now();
      addItemToHistory({ type: 'user', text: rawQuery }, userMessageTimestamp);

      if (!trimmed) {
        addItemToHistory(
          { type: 'error', text: 'Empty shell command.' },
          userMessageTimestamp, // Use same base timestamp
        );
        return true;
      }

      const targetDir = config.getTargetDir();
      setDebugMessage(`Executing shell command in ${targetDir}: ${trimmed}`);
      const execOptions = {
        cwd: targetDir,
      };

      setStreamingState(StreamingState.Responding);

      _exec(trimmed, execOptions, (error, stdout, stderr) => {
        // Use addItemToHistory for all subsequent items
        if (error) {
          addItemToHistory(
            { type: 'error', text: error.message },
            userMessageTimestamp, // Use same base timestamp
          );
        } else {
          let output = '';
          if (stdout) output += stdout;
          if (stderr) output += (output ? '\n' : '') + stderr;

          addItemToHistory(
            { type: 'info', text: output || '(Command produced no output)' },
            userMessageTimestamp, // Use same base timestamp
          );
        }
        setStreamingState(StreamingState.Idle);
      });

      return true;
    },
    [
      config,
      setDebugMessage,
      addItemToHistory,
      setStreamingState,
      // Removed getNextMessageId
    ],
  );

  return { handleShellCommand };
};
