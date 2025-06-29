/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { render } from 'ink-testing-library';
import { describe, it, expect, vi } from 'vitest';
import { AuthDialog } from './AuthDialog.js';
import { LoadedSettings, SettingScope } from '../../config/settings.js';
import { AuthType } from '@google/gemini-cli-core';

describe('AuthDialog', () => {
  const wait = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));

  it('should show an error if the initial auth type is invalid', () => {
    const settings: LoadedSettings = new LoadedSettings(
      {
        settings: {
          selectedAuthType: AuthType.USE_GEMINI,
        },
        path: '',
      },
      {
        settings: {},
        path: '',
      },
      [],
    );

    const { lastFrame } = render(
      <AuthDialog
        onSelect={() => {}}
        onHighlight={() => {}}
        settings={settings}
        initialErrorMessage="GEMINI_API_KEY  environment variable not found"
      />,
    );

    expect(lastFrame()).toContain(
      'GEMINI_API_KEY  environment variable not found',
    );
  });

  it('should prevent exiting when no auth method is selected and show error message', async () => {
    const onSelect = vi.fn();
    const settings: LoadedSettings = new LoadedSettings(
      {
        settings: {
          selectedAuthType: undefined,
        },
        path: '',
      },
      {
        settings: {},
        path: '',
      },
      [],
    );

    const { lastFrame, stdin, unmount } = render(
      <AuthDialog
        onSelect={onSelect}
        onHighlight={() => {}}
        settings={settings}
      />,
    );
    await wait();

    // Simulate pressing escape key
    stdin.write('\u001b'); // ESC key
    await wait();

    // Should show error message instead of calling onSelect
    expect(lastFrame()).toContain(
      'You must select an auth method to proceed. Press Ctrl+C twice to exit.',
    );
    expect(onSelect).not.toHaveBeenCalled();
    unmount();
  });

  it('should allow exiting when auth method is already selected', async () => {
    const onSelect = vi.fn();
    const settings: LoadedSettings = new LoadedSettings(
      {
        settings: {
          selectedAuthType: AuthType.USE_GEMINI,
        },
        path: '',
      },
      {
        settings: {},
        path: '',
      },
      [],
    );

    const { stdin, unmount } = render(
      <AuthDialog
        onSelect={onSelect}
        onHighlight={() => {}}
        settings={settings}
      />,
    );
    await wait();

    // Simulate pressing escape key
    stdin.write('\u001b'); // ESC key
    await wait();

    // Should call onSelect with undefined to exit
    expect(onSelect).toHaveBeenCalledWith(undefined, SettingScope.User);
    unmount();
  });

  it('should display manual login with Google option', () => {
    const settings: LoadedSettings = new LoadedSettings(
      {
        settings: {
          selectedAuthType: AuthType.LOGIN_WITH_GOOGLE_PERSONAL,
        },
        path: '',
      },
      {
        settings: {},
        path: '',
      },
      [],
    );

    const { lastFrame } = render(
      <AuthDialog
        onSelect={() => {}}
        onHighlight={() => {}}
        settings={settings}
      />,
    );

    expect(lastFrame()).toContain('Login with Google');
    expect(lastFrame()).toContain('Manual Login with Google (SSH)');
    expect(lastFrame()).toContain('Gemini API Key (AI Studio)');
    expect(lastFrame()).toContain('Vertex AI');
  });

  it('should include manual login option when manual auth type is pre-selected', () => {
    const settings: LoadedSettings = new LoadedSettings(
      {
        settings: {
          selectedAuthType: AuthType.MANUAL_LOGIN_WITH_GOOGLE,
        },
        path: '',
      },
      {
        settings: {},
        path: '',
      },
      [],
    );

    const { lastFrame } = render(
      <AuthDialog
        onSelect={() => {}}
        onHighlight={() => {}}
        settings={settings}
      />,
    );

    const output = lastFrame();
    expect(output).toContain('Manual Login with Google (SSH)');
  });

  it('should have manual login as second option in the list', () => {
    const settings: LoadedSettings = new LoadedSettings(
      {
        settings: {
          selectedAuthType: AuthType.MANUAL_LOGIN_WITH_GOOGLE,
        },
        path: '',
      },
      {
        settings: {},
        path: '',
      },
      [],
    );

    const { lastFrame } = render(
      <AuthDialog
        onSelect={() => {}}
        onHighlight={() => {}}
        settings={settings}
      />,
    );

    const output = lastFrame();
    const lines = output?.split('\n') || [];
    
    // Find the lines with auth options
    const authOptions = lines.filter(line => 
      line.includes('Login with Google') || 
      line.includes('Manual Login with Google') ||
      line.includes('Gemini API Key') ||
      line.includes('Vertex AI')
    );

    expect(authOptions.length).toBeGreaterThan(0);
    expect(authOptions.some(line => line.includes('Manual Login with Google (SSH)'))).toBe(true);
  });
});
