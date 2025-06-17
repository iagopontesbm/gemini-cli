/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleAuth, AuthClient } from 'google-auth-library';
import { ContentGenerator } from '../core/contentGenerator.js';
import { getOauthClient } from './oauth2.js';
import { setupUser } from './setup.js';
import { CodeAssistServer, HttpOptions } from './server.js';

// OAuth Scopes for Cloud Code authorization.
const OAUTH_SCOPE = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

export async function createCodeAssistContentGenerator(
  httpOptions: HttpOptions,
): Promise<ContentGenerator> {
  const authClient = await getAuthClient();
  const projectId = await setupUser(authClient);
  return new CodeAssistServer(authClient, projectId, httpOptions);
}

async function getAuthClient(): Promise<AuthClient> {
  try {
    return await getGoogleAuthClient(OAUTH_SCOPE);
  } catch (_) {
    // No Application Default Credentials so try Oauth.
    return await getOauthClient(OAUTH_SCOPE);
  }
}

/**
 * @returns a valid auth client.
 * @throws error if there are no Application Default Credentials.
 */
async function getGoogleAuthClient(scopes: string[]): Promise<AuthClient> {
  const googleAuth = new GoogleAuth({ scopes });
  return await googleAuth.getClient();
}
