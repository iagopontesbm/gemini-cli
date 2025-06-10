/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { StatsDisplay } from './StatsDisplay.js';
import { type CumulativeStats } from '../contexts/SessionContext.js';

describe('<StatsDisplay />', () => {
  const mockStats: CumulativeStats = {
    turnCount: 10,
    promptTokenCount: 1000,
    candidatesTokenCount: 2000,
    totalTokenCount: 3500, // Adjusted to be a realistic sum
    cachedContentTokenCount: 500,
    toolUsePromptTokenCount: 200,
    thoughtsTokenCount: 300,
  };

  const mockDuration = '1h 23m 45s';

  it('renders correctly with given stats and duration', () => {
    const { lastFrame } = render(
      <StatsDisplay stats={mockStats} duration={mockDuration} />,
    );

    const output = lastFrame();

    // Check for main title and duration
    expect(output).toContain('Stats');
    expect(output).toContain('Total duration (wall)');
    expect(output).toContain(mockDuration);

    // Check for column titles
    expect(output).toContain('Last Turn');
    expect(output).toContain('Cumulative (10 Turns)');

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
    };

    const { lastFrame } = render(
      <StatsDisplay stats={zeroStats} duration="0s" />,
    );

    const output = lastFrame();

    expect(output).toContain('Cumulative (0 Turns)');
    expect(output).toContain('Total Tokens');
    expect(output).toContain('0');
    // Ensure percentage is not shown for cached tokens when total is zero
    expect(output).not.toContain('%');
  });
});

