/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthClient } from 'google-auth-library';
import { AuthType, ContentGenerator } from '../core/contentGenerator.js';
import { getOauthClient } from './oauth2.js';
import { setupUser } from './setup.js';
import { CodeAssistServer, HttpOptions } from './server.js';

export async function createCodeAssistContentGenerator(
  httpOptions: HttpOptions,
  authType: AuthType,
): Promise<ContentGenerator> {
  const authClient = await getAuthClient(authType);
  const projectId = await setupUser(authClient);
  return new CodeAssistServer(authClient, projectId, httpOptions);
}

async function getAuthClient(authType: AuthType): Promise<AuthClient> {
  if (
    authType === AuthType.LOGIN_WITH_GOOGLE_ENTERPRISE ||
    authType === AuthType.LOGIN_WITH_GOOGLE_PERSONAL
  ) {
    return await getOauthClient();
  }

  throw new Error(`Unsupported authType: ${authType}`);
}
