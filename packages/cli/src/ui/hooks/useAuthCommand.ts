/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect } from 'react';
import { LoadedSettings, SettingScope } from '../../config/settings.js';
import {
  AuthType,
  Config,
  clearCachedCredentialFile,
  getErrorMessage,
} from '@google/gemini-cli-core';

async function performAuthFlow(authMethod: AuthType, config: Config) {
  await config.refreshAuth(authMethod);
  console.log(`Authenticated via "${authMethod}".`);
}

async function performManualAuthFlow(
  authMethod: AuthType,
  config: Config,
  setManualAuthInfo: (info: { authUrl: string; callbackUrl: string }) => void,
) {
  // For manual auth, we need to get the URLs first before starting the auth flow
  const { getManualOauthInfo } = await import('@google/gemini-cli-core');
  
  try {
    const manualInfo = await getManualOauthInfo();
    setManualAuthInfo({
      authUrl: manualInfo.authUrl,
      callbackUrl: manualInfo.callbackUrl,
    });
    
    // Wait for the manual auth to complete
    await manualInfo.loginCompletePromise;
    console.log(`Authenticated via "${authMethod}".`);
  } catch (error) {
    if (error instanceof Error && error.message === 'Already authenticated') {
      // User already has cached credentials, proceed with normal flow
      await performAuthFlow(authMethod, config);
      return;
    }
    throw error;
  }
}

export const useAuthCommand = (
  settings: LoadedSettings,
  setAuthError: (error: string | null) => void,
  config: Config,
) => {
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(
    settings.merged.selectedAuthType === undefined,
  );

  const openAuthDialog = useCallback(() => {
    setIsAuthDialogOpen(true);
  }, []);

  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [manualAuthInfo, setManualAuthInfo] = useState<{
    authUrl: string;
    callbackUrl: string;
  } | null>(null);

  useEffect(() => {
    const authFlow = async () => {
      if (isAuthDialogOpen || !settings.merged.selectedAuthType) {
        return;
      }

      try {
        setIsAuthenticating(true);
        const authType = settings.merged.selectedAuthType as AuthType;
        
        if (authType === AuthType.MANUAL_LOGIN_WITH_GOOGLE) {
          await performManualAuthFlow(authType, config, setManualAuthInfo);
        } else {
          await performAuthFlow(authType, config);
        }
      } catch (e) {
        setAuthError(`Failed to login. Message: ${getErrorMessage(e)}`);
        openAuthDialog();
      } finally {
        setIsAuthenticating(false);
        setManualAuthInfo(null);
      }
    };

    void authFlow();
  }, [isAuthDialogOpen, settings, config, setAuthError, openAuthDialog]);

  const handleAuthSelect = useCallback(
    async (authMethod: string | undefined, scope: SettingScope) => {
      if (authMethod) {
        await clearCachedCredentialFile();
        settings.setValue(scope, 'selectedAuthType', authMethod);
      }
      setIsAuthDialogOpen(false);
      setAuthError(null);
    },
    [settings, setAuthError],
  );

  const handleAuthHighlight = useCallback((_authMethod: string | undefined) => {
    // For now, we don't do anything on highlight.
  }, []);

  const cancelAuthentication = useCallback(() => {
    setIsAuthenticating(false);
    setManualAuthInfo(null);
  }, []);

  return {
    isAuthDialogOpen,
    openAuthDialog,
    handleAuthSelect,
    handleAuthHighlight,
    isAuthenticating,
    manualAuthInfo,
    cancelAuthentication,
  };
};
