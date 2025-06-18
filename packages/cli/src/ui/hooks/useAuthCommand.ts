/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';
import { LoadedSettings, SettingScope } from '../../config/settings.js';
import { HistoryItem, MessageType } from '../types.js';

export const useAuthCommand = (
  settings: LoadedSettings,
  setAuthError: (error: string | null) => void,
  addItem: (item: HistoryItem, timestamp: number) => void,
) => {
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(
    !settings.merged.auth,
  );

  const openAuthDialog = useCallback(() => {
    setIsAuthDialogOpen(true);
  }, []);

  const handleAuthSelect = useCallback(
    (authMethod: string | undefined, scope: SettingScope) => {
      if (authMethod) {
        settings.setValue(scope, 'auth', authMethod);
        addItem(
          {
            type: MessageType.INFO,
            text: `Authentication method set to "${authMethod}" in ${scope} settings.`,
            id: Date.now(),
          },
          Date.now(),
        );
      }
      setIsAuthDialogOpen(false);
      setAuthError(null);
    },
    [settings, addItem, setAuthError],
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
