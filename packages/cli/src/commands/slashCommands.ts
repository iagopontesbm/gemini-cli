/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { PartListUnion } from '@google/genai';
import { HistoryItem, StreamingState } from './types.js';
import { Config } from '@gemini-code/server';
import { exec as _exec } from 'child_process';
import { Dispatch, SetStateAction } from 'react';

interface SlashCommand {
  name: string; // slash command
  description: string; // flavor text in UI
  action: (value: PartListUnion) => void;
}

export const createSlashCommands = (
  setHistory: Dispatch<SetStateAction<HistoryItem[]>>,
  getNextMessageId: (baseTimestamp: number) => number,
  setDebugMessage: Dispatch<SetStateAction<string>>,
  config: Config,
  setStreamingState: Dispatch<SetStateAction<StreamingState>>,
) => {
  const addHistoryItem = (
    itemData: Omit<HistoryItem, 'id'>,
    id: number,
  ) => {
    setHistory((prevHistory) => [
      ...prevHistory,
      { ...itemData, id } as HistoryItem,
    ]);
  };

  const slashCommands: SlashCommand[] = [
    {
      name: 'clear',
      description: 'clear the screen',
      action: (_value: PartListUnion) => {
        // This just clears the *UI* history, not the model history.
        setDebugMessage('Clearing terminal.');
        setHistory((_) => []);
      },
    },
    {
      name: 'exit',
      description: 'Exit gemini-code',
      action: (_value: PartListUnion) => {
        setDebugMessage('Exiting. Good-bye.');
        const timestamp = getNextMessageId(Date.now());
        addHistoryItem(
          { type: 'info', text: 'good-bye!' },
          timestamp,
        );
        process.exit(0);
      },
    },
    {
      // TODO: dedup with exit by adding altName or cmdRegex.
      name: 'quit',
      description: 'Quit gemini-code',
      action: (_value: PartListUnion) => {
        setDebugMessage('Quitting. Good-bye.');
        const timestamp = getNextMessageId(Date.now());
        addHistoryItem(
          { type: 'info', text: 'good-bye!' },
          timestamp,
        );
        process.exit(0);
      },
    },
    {
      name: 'help',
      description: 'show help',
      action: (_value: PartListUnion) => {
        const helpText = 'I am an interactive CLI tool assistant designed to ' +
            'help with software engineering tasks. I can use tools to read ' +
            'and write files, search code, execute bash commands, and more ' +
            'to assist with development workflows. I will explain commands ' +
            'and ask for permission before running them and will not ' +
            'commit changes unless explicitly instructed.';
        const timestamp = getNextMessageId(Date.now());
        addHistoryItem({ type: 'info', text: helpText }, timestamp);
      },
    },
  ];

  return { slashCommands };
};

export type { SlashCommand };
