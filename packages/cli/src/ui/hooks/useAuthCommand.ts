/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect } from 'react';
import { LoadedSettings, SettingScope } from '../../config/settings.js';
import { HistoryItem, MessageType } from '../types.js';
import { AuthType, Config } from '@gemini-cli/core';

async function performAuthFlow(
  authMethod: AuthType,
  addItem: (item: HistoryItem, timestamp: number) => void,
  config: Config,
) {
  await config.refreshAuth(authMethod);
  addItem(
    {
      type: MessageType.INFO,
      text: `Authentication via "${authMethod}".`,
      id: Date.now(),
    },
    Date.now(),
  );
}

export const useAuthCommand = (
  settings: LoadedSettings,
  setAuthError: (error: string | null) => void,
  addItem: (item: HistoryItem, timestamp: number) => void,
  config: Config,
) => {
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(
    settings.merged.selectedAuthType === undefined
  );

  useEffect(() => {
    if (!isAuthDialogOpen) {
      performAuthFlow(
        settings.merged.selectedAuthType as AuthType,
        addItem,
        config,
      );
    }
  }, [isAuthDialogOpen, settings, addItem, config]);

  const openAuthDialog = useCallback(() => {
    setIsAuthDialogOpen(true);
  }, []);

  const handleAuthSelect = useCallback(
    (authMethod: string | undefined, scope: SettingScope) => {
      if (authMethod) {
        settings.setValue(scope, 'selectedAuthType', authMethod);
        performAuthFlow(authMethod as AuthType, addItem, config);
      }
      setIsAuthDialogOpen(false);
      setAuthError(null);
    },
    [settings, addItem, setAuthError, config],
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
