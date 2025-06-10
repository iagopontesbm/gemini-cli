/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { StatsDisplay } from './StatsDisplay.js';
import { type CumulativeStats } from '../contexts/SessionContext.js';

describe('<StatsDisplay />', () => {
  const mockStats: CumulativeStats = {
    turnCount: 10,
    promptTokenCount: 1000,
    candidatesTokenCount: 2000,
    totalTokenCount: 3500,
    cachedContentTokenCount: 500,
    toolUsePromptTokenCount: 200,
    thoughtsTokenCount: 300,
    apiTimeMs: 50234,
  };

  const mockLastTurnStats: CumulativeStats = {
    turnCount: 1,
    promptTokenCount: 100,
    candidatesTokenCount: 200,
    totalTokenCount: 350,
    cachedContentTokenCount: 50,
    toolUsePromptTokenCount: 20,
    thoughtsTokenCount: 30,
    apiTimeMs: 1234,
  };

  const mockDuration = '1h 23m 45s';

  it('renders correctly with given stats and duration', () => {
    const { lastFrame } = render(
      <StatsDisplay
        stats={mockStats}
        lastTurnStats={mockLastTurnStats}
        duration={mockDuration}
      />,
    );

    const output = lastFrame();

    // Check for main title and duration
    expect(output).toContain('Stats');
    expect(output).toContain('Total duration (wall)');
    expect(output).toContain(mockDuration);
    expect(output).toContain('Total duration (API)');
    expect(output).toContain('50.2s');

    // Check for column titles
    expect(output).toContain('Last Turn');
    expect(output).toContain('Cumulative (10 Turns)');

    // Check for some last turn stats
    expect(output).toContain('100'); // Last Turn Input Tokens
    expect(output).toContain('200'); // Last Turn Output Tokens
    expect(output).toContain('350'); // Last Turn Total Tokens
    expect(output).toContain('1.2s'); // Last Turn API Time

    // Check cumulative stats
    expect(output).toContain('Input Tokens');
    expect(output).toContain('1,000');
    expect(output).toContain('Output Tokens');
    expect(output).toContain('2,000');
    expect(output).toContain('Tool Use Tokens');
    expect(output).toContain('200');
    expect(output).toContain('Thoughts Tokens');
    expect(output).toContain('300');
    expect(output).toContain('Cached Tokens');
    // Check for percentage calculation
    expect(output).toContain('500 (14.3%)');
    expect(output).toContain('Total Tokens');
    expect(output).toContain('3,500');
  });

  it('renders zero state correctly', () => {
    const zeroStats: CumulativeStats = {
      turnCount: 0,
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      totalTokenCount: 0,
      cachedContentTokenCount: 0,
      toolUsePromptTokenCount: 0,
      thoughtsTokenCount: 0,
      apiTimeMs: 0,
    };

    const { lastFrame } = render(
      <StatsDisplay
        stats={zeroStats}
        lastTurnStats={zeroStats}
        duration="0s"
      />,
    );

    const output = lastFrame();

    expect(output).toContain('Cumulative (0 Turns)');
    expect(output).toContain('Total Tokens');
    expect(output).toContain('0');
    // Ensure percentage is not shown for cached tokens when total is zero
    expect(output).not.toContain('%');
  });
});
