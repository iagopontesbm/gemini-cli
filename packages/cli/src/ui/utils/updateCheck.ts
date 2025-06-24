/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import updateNotifier from 'update-notifier';
import process from 'node:process';

export async function checkForUpdates(): Promise<string | null> {
  try {
    if (!process.env.CLI_NAME || !process.env.CLI_VERSION) {
      return null;
    }
    const notifier = updateNotifier({
      pkg: {
        name: process.env.CLI_NAME,
        version: process.env.CLI_VERSION,
      },
      // check every time
      updateCheckInterval: 0,
      // allow notifier to run in scripts
      shouldNotifyInNpmScript: true,
    });

    if (notifier.update) {
      return `Gemini CLI update available! ${notifier.update.current} → ${notifier.update.latest}\nRun npm install -g ${process.env.CLI_NAME} to update`;
    }

    return null;
  } catch (e) {
    console.warn('Failed to check for updates: ' + e);
    return null;
  }
}
