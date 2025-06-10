/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClientMetadata, OnboardUserRequest } from './types.js';
import { CcpaServer } from './ccpa.js';
import {loginWithOauth} from './login.js';

export async function doSetup(projectId?: string): Promise<void> {
  const oAuth2Client = await loginWithOauth()
  const ccpaServer: CcpaServer = new CcpaServer(oAuth2Client, projectId);
  const clientMetadata: ClientMetadata = {
    ideType: 'IDE_UNSPECIFIED',
    platform: 'PLATFORM_UNSPECIFIED',
    pluginType: 'GEMINI',
  };
  if (process.env.GOOGLE_CLOUD_PROJECT) {
    clientMetadata.duetProject = process.env.GOOGLE_CLOUD_PROJECT;
  }

  // TODO: Support Free Tier user without projectId.
  const loadRes = await ccpaServer.loadCodeAssist({
    cloudaicompanionProject: process.env.GOOGLE_CLOUD_PROJECT,
    metadata: clientMetadata,
  });

  const onboardRes: OnboardUserRequest = {
    tierId: 'legacy-tier',
    cloudaicompanionProject: loadRes.cloudaicompanionProject || '',
    metadata: clientMetadata,
  };

  // Poll onboardUser until long running operation is complete.
  let lroRes = await ccpaServer.onboardUser(onboardRes);
  while (!lroRes.done) {
    await new Promise((f) => setTimeout(f, 5000));
    lroRes = await ccpaServer.onboardUser(onboardRes);
  }
}
