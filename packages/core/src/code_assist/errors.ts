/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GaxiosError } from 'gaxios';

/**
 * Error thrown when a user needs to re-authenticate.
 */
export class ReauthNeededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReauthNeededError';
  }
}

export function isAuthError(error: unknown): boolean {
  return (
    error instanceof GaxiosError && error.response?.data?.error?.code === 401
  );
}
