/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from 'ink-testing-library';
import { describe, it, expect, vi } from 'vitest';
import { HistoryItemDisplay } from './HistoryItemDisplay.js';
import { HistoryItem, MessageType } from '../types.js';
import { CumulativeStats } from '../contexts/SessionContext.js';
import { Text } from 'ink';

// Mock child components
vi.mock('./messages/UserMessage.js', () => ({
  UserMessage: ({ text }: { text: string }) => <Text>UserMessage: {text}</Text>,
}));
vi.mock('./messages/UserShellMessage.js', () => ({
  UserShellMessage: ({ text }: { text: string }) => (
    <Text>UserShellMessage: {text}</Text>
  ),
}));
vi.mock('./messages/GeminiMessage.js', () => ({
  GeminiMessage: ({ text }: { text: string }) => (
    <Text>GeminiMessage: {text}</Text>
  ),
}));
vi.mock('./messages/InfoMessage.js', () => ({
  InfoMessage: ({ text }: { text: string }) => <Text>InfoMessage: {text}</Text>,
}));
vi.mock('./messages/ErrorMessage.js', () => ({
  ErrorMessage: ({ text }: { text: string }) => (
    <Text>ErrorMessage: {text}</Text>
  ),
}));
vi.mock('./AboutBox.js', () => ({
  AboutBox: () => <Text>AboutBox</Text>,
}));
vi.mock('./StatsDisplay.js', () => ({
  StatsDisplay: () => <Text>StatsDisplay</Text>,
}));
vi.mock('./messages/ToolGroupMessage.js', () => ({
  ToolGroupMessage: () => <Text>ToolGroupMessage</Text>,
}));

describe('<HistoryItemDisplay />', () => {
  const baseItem = {
    id: 1,
    timestamp: 12345,
    isPending: false,
    availableTerminalHeight: 100,
  };

  it('renders UserMessage for "user" type', () => {
    const item: HistoryItem = {
      ...baseItem,
      type: MessageType.USER,
      text: 'Hello',
    };
    const { lastFrame } = render(
      <HistoryItemDisplay {...baseItem} item={item} />,
    );
    expect(lastFrame()).toContain('UserMessage: Hello');
  });

  it('renders StatsDisplay for "stats" type', () => {
    const stats: CumulativeStats = {
      turnCount: 1,
      promptTokenCount: 10,
      candidatesTokenCount: 20,
      totalTokenCount: 30,
      cachedContentTokenCount: 5,
      toolUsePromptTokenCount: 2,
      thoughtsTokenCount: 3,
      apiTimeMs: 123,
    };
    const item: HistoryItem = {
      ...baseItem,
      type: MessageType.STATS,
      stats,
      lastTurnStats: stats,
      duration: '1s',
    };
    const { lastFrame } = render(
      <HistoryItemDisplay {...baseItem} item={item} />,
    );
    expect(lastFrame()).toContain('StatsDisplay');
  });

  it('renders AboutBox for "about" type', () => {
    const item: HistoryItem = {
      ...baseItem,
      type: MessageType.ABOUT,
      cliVersion: '1.0.0',
      osVersion: 'test-os',
      sandboxEnv: 'test-env',
      modelVersion: 'test-model',
    };
    const { lastFrame } = render(
      <HistoryItemDisplay {...baseItem} item={item} />,
    );
    expect(lastFrame()).toContain('AboutBox');
  });
});
