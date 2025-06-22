/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '@gemini-cli/core';

/**
 * Determines if cached tokens should be displayed for the current auth method.
 * OAuth users (Google Personal/Enterprise) don't have access to cached content
 * at this time, so we hide cached token counts to avoid confusion.
 */
export function shouldShowCachedTokens(authType?: AuthType): boolean {
  if (!authType) {
    return true; // Default to showing if unknown
  }

  // Hide cached tokens for OAuth users since Code Assist API doesn't support cached content at this time
  return (
    authType !== AuthType.LOGIN_WITH_GOOGLE_PERSONAL &&
    authType !== AuthType.LOGIN_WITH_GOOGLE_ENTERPRISE
  );
}

/**
 * Gets a human-readable description of the auth method for display purposes
 */
export function getAuthMethodDescription(authType?: AuthType): string {
  switch (authType) {
    case AuthType.LOGIN_WITH_GOOGLE_PERSONAL:
      return 'OAuth (Google Personal)';
    case AuthType.LOGIN_WITH_GOOGLE_ENTERPRISE:
      return 'OAuth (Google Enterprise)';
    case AuthType.USE_GEMINI:
      return 'Gemini API Key';
    case AuthType.USE_VERTEX_AI:
      return 'Vertex AI';
    default:
      return 'Unknown';
  }
}
