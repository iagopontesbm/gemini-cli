/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect } from 'react';
import { LoadedSettings, SettingScope } from '../../config/settings.js';
import { AuthType, Config } from '@gemini-cli/core';

async function performAuthFlow(
  authMethod: AuthType,
  config: Config,
) {
  await config.refreshAuth(authMethod);
  console.error(`Authenticated via "${authMethod}".`);
}

export const useAuthCommand = (
  settings: LoadedSettings,
  setAuthError: (error: string | null) => void,
  config: Config,
) => {
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(
    settings.merged.selectedAuthType === undefined,
  );

  useEffect(() => {
    if (!isAuthDialogOpen) {
      performAuthFlow(
        settings.merged.selectedAuthType as AuthType,
        config,
      );
    }
  }, [isAuthDialogOpen, settings, config]);

  const openAuthDialog = useCallback(() => {
    setIsAuthDialogOpen(true);
  }, []);

  const handleAuthSelect = useCallback(
    (authMethod: string | undefined, scope: SettingScope) => {
      if (authMethod) {
        settings.setValue(scope, 'selectedAuthType', authMethod);
        performAuthFlow(authMethod as AuthType, config);
      }
      setIsAuthDialogOpen(false);
      setAuthError(null);
    },
    [settings, setAuthError, config],
  );

  const handleAuthHighlight = useCallback((_authMethod: string | undefined) => {
    // For now, we don't do anything on highlight.
  }, []);

  return {
    isAuthDialogOpen,
    openAuthDialog,
    handleAuthSelect,
    handleAuthHighlight,
  };
};
