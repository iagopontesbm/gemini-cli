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

interface ClientAndProjectId {
  client: AuthClient;
  projectId?: string;
}

export async function createCodeAssistContentGenerator(
  httpOptions: HttpOptions,
): Promise<ContentGenerator> {
  const cp = await getClientAndProject();
  const projectId = await setupUser(
    cp.client,
    cp.projectId || process.env.GOOGLE_CLOUD_PROJECT,
  );
  return new CodeAssistServer(cp.client, projectId, httpOptions);
}

async function getClientAndProject(): Promise<ClientAndProjectId> {
  try {
    return await getGoogleAuthClient(OAUTH_SCOPE);
  } catch (_) {
    // No Application Default Credentials so try Oauth.
    const oauthClient = await getOauthClient(OAUTH_SCOPE);
    return {
      client: oauthClient,
      projectId: oauthClient.projectId || undefined,
    };
  }
}

/**
 * @returns a valid auth client.
 * @throws error if there are no Application Default Credentials.
 */
async function getGoogleAuthClient(
  scopes: string[],
): Promise<ClientAndProjectId> {
  const googleAuth = new GoogleAuth({ scopes });
  return {
    client: await googleAuth.getClient(),
    projectId: await googleAuth.getProjectId(),
  };
}
