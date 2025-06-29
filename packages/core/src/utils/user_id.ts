/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { GEMINI_DIR } from './paths.js';

const homeDir = os.homedir() ?? '';
const geminiDir = path.join(homeDir, GEMINI_DIR);
const installationIdFile = path.join(geminiDir, 'installation_id');

function ensureGeminiDirExists() {
  if (!fs.existsSync(geminiDir)) {
    fs.mkdirSync(geminiDir, { recursive: true });
  }
}

function readInstallationIdFromFile(): string | null {
  if (fs.existsSync(installationIdFile)) {
    const installationid = fs.readFileSync(installationIdFile, 'utf-8').trim();
    return installationid || null;
  }
  return null;
}

function writeInstallationIdToFile(installationId: string) {
  fs.writeFileSync(installationIdFile, installationId, 'utf-8');
}

/**
 * Retrieves the installation ID from a file, creating it if it doesn't exist.
 * This ID is used for unique user installation tracking.
 * @returns A UUID string for the user.
 */
export function getInstallationId(): string {
  try {
    ensureGeminiDirExists();
    let installationId = readInstallationIdFromFile();

    if (!installationId) {
      installationId = randomUUID();
      writeInstallationIdToFile(installationId);
    }

    return installationId;
  } catch (error) {
    console.error(
      'Error accessing installation ID file, generating ephemeral ID:',
      error,
    );
    return '123456789';
  }
}

/**
 * Retrieves the obfuscated GAIA ID for the currently authenticated user.
 * When OAuth is available, returns the user's cached GAIA ID. Otherwise, returns the installation ID.
 * @returns A string ID for the user (GAIA ID if available, otherwise installation ID).
 */
export function getObfuscatedGaiaId(): string {
  // Try to get cached GAIA ID first
  try {
    // Dynamically import to avoid circular dependencies
    // eslint-disable-next-line @typescript-eslint/no-require-imports, no-restricted-syntax
    const { getCachedGaiaId } = require('../code_assist/oauth2.js');
    const gaiaId = getCachedGaiaId();
    if (gaiaId) {
      return gaiaId;
    }
  } catch (_error) {
    // If there's any error accessing GAIA ID, fall back to installation ID
  }

  // Fall back to installation ID
  try {
    ensureGeminiDirExists();
    let userId = readInstallationIdFromFile();

    if (!userId) {
      userId = randomUUID();
      writeInstallationIdToFile(userId);
    }

    return userId;
  } catch (error) {
    console.error(
      'Error accessing unique user ID file, generating ephemeral ID:',
      error,
    );
    return '123456789';
  }
}
