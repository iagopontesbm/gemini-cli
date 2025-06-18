/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Error thrown when a user needs to re-authenticate.
 */
export class ReauthNeededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReauthNeededError';
  }
}
