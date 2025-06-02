/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { themeManager } from '../themes/theme-manager.js';
import { LoadedSettings, SettingScope } from '../../config/settings.js'; // Import LoadedSettings, AppSettings, MergedSetting

interface UseThemeCommandReturn {
  isThemeDialogOpen: boolean;
  openThemeDialog: () => void;
  handleThemeSelect: (
    themeName: string | undefined,
    scope: SettingScope,
  ) => void; // Added scope
  handleThemeHighlight: (themeName: string | undefined) => void;
}

export const useThemeCommand = (
  loadedSettings: LoadedSettings,
  setThemeError: (error: string | null) => void,
): UseThemeCommandReturn => {
  // Determine the effective theme
  const effectiveTheme = loadedSettings.merged.theme;

  // Initial state: Open dialog if no theme is set in either user or workspace settings
  const [isThemeDialogOpen, setIsThemeDialogOpen] = useState(false);
  // TODO: refactor how theme's are accessed to avoid requiring a forced render.
  const [, setForceRender] = useState(0);
  const initialLoadDoneRef = useRef(false);

  // Apply initial theme on component mount
  useEffect(() => {
    const themeIsSetAndValid = themeManager.setActiveTheme(effectiveTheme);
    if (!themeIsSetAndValid) {
      setThemeError(
        effectiveTheme
          ? `Theme "${effectiveTheme}" not found.`
          : 'No theme is set.',
      );
      if (!initialLoadDoneRef.current) {
        setIsThemeDialogOpen(true);
      }
    } else {
      setThemeError(null); // Clear any previous theme error on success
    }
    initialLoadDoneRef.current = true;
  }, [effectiveTheme, setThemeError]); // Re-run if effectiveTheme or setThemeError changes

  const openThemeDialog = useCallback(() => {
    setIsThemeDialogOpen(true);
  }, []);

  const applyTheme = useCallback(
    (themeName: string | undefined) => {
      if (!themeManager.setActiveTheme(themeName)) {
        // If theme is not found, set error message
        setThemeError(`Theme "${themeName}" not found.`);
      } else {
        setForceRender((v) => v + 1); // Trigger potential re-render
        setThemeError(null); // Clear any previous theme error on success
      }
    },
    [setThemeError],
  );

  const handleThemeHighlight = useCallback(
    (themeName: string | undefined) => {
      applyTheme(themeName);
    },
    [applyTheme],
  );

  const handleThemeSelect = useCallback(
    (themeName: string | undefined, scope: SettingScope) => {
      // Added scope parameter
      try {
        loadedSettings.setValue(scope, 'theme', themeName); // Update the merged settings
        applyTheme(loadedSettings.merged.theme); // Apply the current theme
      } finally {
        setIsThemeDialogOpen(false); // Close the dialog
      }
    },
    [applyTheme, loadedSettings],
  );

  return {
    isThemeDialogOpen,
    openThemeDialog,
    handleThemeSelect,
    handleThemeHighlight,
  };
};
