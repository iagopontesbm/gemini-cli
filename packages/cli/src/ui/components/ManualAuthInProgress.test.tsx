/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from 'ink-testing-library';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ManualAuthInProgress } from './ManualAuthInProgress.js';

// Mock the URL shortener
vi.mock('../../utils/urlShortener.js', () => ({
  shortenUrlWithFallback: vi.fn((url: string) => Promise.resolve(url)),
}));

// Mock fetch for URL shortening
global.fetch = vi.fn();

describe('ManualAuthInProgress', () => {
  const wait = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));

  const mockProps = {
    authUrl:
      'https://accounts.google.com/oauth/authorize?client_id=test&redirect_uri=http://localhost:8080/oauth2callback',
    callbackUrl: 'http://localhost:8080/oauth2callback',
    onTimeout: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should display manual authentication instructions', () => {
    const { lastFrame } = render(<ManualAuthInProgress {...mockProps} />);

    const output = lastFrame();
    expect(output).toContain('Manual Login with Google');
    expect(output).toContain('Please complete the following steps:');
    expect(output).toContain(
      '1. Copy and paste the URL above into your browser',
    );
    expect(output).toContain('Authentication URL (click to select and copy):');
    expect(output).toContain('https://accounts.google.com/oauth/authorize'); // Just check part of URL
    expect(output).toContain('2. Set up port forwarding (if using SSH):');
    expect(output).toContain('ssh -L 8080:localhost:8080');
    expect(output).toContain('3. Complete the authentication in your browser');
    expect(output).toContain(
      '4. The browser will redirect to the callback URL',
    );
    expect(output).toContain('Waiting for authentication...');
    expect(output).toContain('(Press ESC to cancel)');
  });

  it('should show callback URL for port forwarding', () => {
    const { lastFrame } = render(<ManualAuthInProgress {...mockProps} />);

    const output = lastFrame();
    expect(output).toContain(mockProps.callbackUrl);
  });

  it('should handle escape key to cancel authentication', async () => {
    const onTimeout = vi.fn();
    const { stdin, unmount } = render(
      <ManualAuthInProgress {...mockProps} onTimeout={onTimeout} />,
    );
    await wait();

    // Simulate pressing escape key
    stdin.write('\u001b'); // ESC key
    await wait();

    expect(onTimeout).toHaveBeenCalledOnce();
    unmount();
  });

  it('should show timeout message after 3 minutes', async () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();

    const { lastFrame, unmount } = render(
      <ManualAuthInProgress {...mockProps} onTimeout={onTimeout} />,
    );

    // Fast-forward time by 3 minutes
    vi.advanceTimersByTime(180000);

    // Wait for React to update
    await vi.runAllTimersAsync();

    expect(lastFrame()).toContain(
      'Authentication timed out. Please try again.',
    );
    expect(onTimeout).toHaveBeenCalledOnce();

    vi.useRealTimers();
    unmount();
  }, 10000); // Increase timeout for this test

  it('should extract port number from callback URL correctly', () => {
    const propsWithDifferentPort = {
      ...mockProps,
      callbackUrl: 'http://localhost:3000/oauth2callback',
    };

    const { lastFrame } = render(
      <ManualAuthInProgress {...propsWithDifferentPort} />,
    );

    const output = lastFrame();
    expect(output).toContain('ssh -L 3000:localhost:3000');
  });

  it('should display formatted URLs properly', () => {
    const { lastFrame } = render(<ManualAuthInProgress {...mockProps} />);

    const output = lastFrame();

    // Check that URLs are displayed without wrapping issues
    expect(output).toContain('https://accounts.google.com/oauth/authorize');
    expect(output).toContain('localhost:8080/oauth2callback');
  });

  it('should display auth URL outside the instructions box for easy copying', () => {
    const { lastFrame } = render(<ManualAuthInProgress {...mockProps} />);

    const output = lastFrame();

    // Check that the auth URL is prominently displayed with a clear label
    expect(output).toContain('Authentication URL (click to select and copy):');
    expect(output).toContain('https://accounts.google.com/oauth/authorize'); // Check part of URL

    // Verify the structure includes both the instructions box and the separate URL
    expect(output).toContain('Manual Login with Google'); // In the box
    expect(output).toContain('Authentication URL (click to select and copy):'); // Outside the box

    // Verify the URL appears before the instructions box
    const lines = output?.split('\n') || [];
    const instructionsBoxStartIndex = lines.findIndex((line) =>
      line.includes('╭'),
    );
    const authUrlLabelIndex = lines.findIndex((line) =>
      line.includes('Authentication URL'),
    );
    expect(authUrlLabelIndex).toBeLessThan(instructionsBoxStartIndex);
  });
});
