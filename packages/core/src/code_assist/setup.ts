/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClientMetadata, OnboardUserRequest } from './types.js';
import { CodeAssistServer } from './server.js';
import { GoogleAuth, OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';

/**
 * Validates that the project exists and that the Gemini API is enabled.
 * @param projectId The ID of the project to validate.
 */
async function validateProject(projectId: string) {
  const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/cloud-platform',
  });
  const client = await auth.getClient();
  const serviceUsage = google.serviceusage({ version: 'v1', auth: client });
  try {
    // Check if the project exists.
    await google
      .cloudresourcemanager({ version: 'v1', auth: client })
      .projects.get({ projectId });
  } catch (_e) {
    throw new Error(
      `The project specified in GOOGLE_CLOUD_PROJECT (${projectId}) does not exist or you do not have permission to access it.`,
    );
  }
  try {
    // Check if the Gemini API is enabled.
    const res = await serviceUsage.services.get({
      name: `projects/${projectId}/services/cloudaicompanion.googleapis.com`,
    });
    if (res.data.state !== 'ENABLED') {
      throw new Error(); // Will be caught and re-thrown with a more specific message.
    }
  } catch (_e) {
    throw new Error(
      `The Gemini for Google Cloud API is not enabled for the project specified in GOOGLE_CLOUD_PROJECT (${projectId}). Please enable it at https://console.cloud.google.com/apis/library/cloudaicompanion.googleapis.com`,
    );
  }
}

/**
 *
 * @param projectId the user's project id, if any
 * @returns the user's actual project id
 */
export async function setupUser(authClient: OAuth2Client): Promise<string> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  if (projectId) {
    await validateProject(projectId);
  }
  const caServer = new CodeAssistServer(authClient, projectId);

  const clientMetadata: ClientMetadata = {
    ideType: 'IDE_UNSPECIFIED',
    platform: 'PLATFORM_UNSPECIFIED',
    pluginType: 'GEMINI',
    duetProject: projectId,
  };

  // TODO: Support Free Tier user without projectId.
  const loadRes = await caServer.loadCodeAssist({
    cloudaicompanionProject: projectId,
    metadata: clientMetadata,
  });

  const onboardTier: string =
    loadRes.allowedTiers?.find((tier) => tier.isDefault)?.id ?? 'legacy-tier';

  const onboardReq: OnboardUserRequest = {
    tierId: onboardTier,
    cloudaicompanionProject: loadRes.cloudaicompanionProject || projectId || '',
    metadata: clientMetadata,
  };
  try {
    // Poll onboardUser until long running operation is complete.
    let lroRes = await caServer.onboardUser(onboardReq);
    while (!lroRes.done) {
      await new Promise((f) => setTimeout(f, 5000));
      lroRes = await caServer.onboardUser(onboardReq);
    }
    return lroRes.response?.cloudaicompanionProject?.id || '';
  } catch (_e) {
    console.log(
      '\n\nError onboarding with Code Assist.\n' +
        'Google Workspace Account (e.g. your-name@your-company.com)' +
        ' must specify a GOOGLE_CLOUD_PROJECT environment variable.\n\n',
    );
    throw _e;
  }
}
