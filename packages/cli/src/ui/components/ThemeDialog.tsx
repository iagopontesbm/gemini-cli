/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { Colors } from '../colors.js';
import { themeManager, DEFAULT_THEME } from '../themes/theme-manager.js';
import { RadioButtonSelect } from './shared/RadioButtonSelect.js';
import { DiffRenderer } from './messages/DiffRenderer.js';
import { colorizeCode } from '../utils/CodeColorizer.js';
import { LoadedSettings, SettingScope } from '../../config/settings.js';

interface ThemeDialogProps {
  /** Callback function when a theme is selected */
  onSelect: (themeName: string | undefined, scope: SettingScope) => void;

  /** Callback function when a theme is highlighted */
  onHighlight: (themeName: string | undefined) => void;

  /** The settings object */
  settings: LoadedSettings;
  availableTerminalHeight?: number;
  terminalWidth: number;
}

export function ThemeDialog({
  onSelect,
  settings,
  availableTerminalHeight,
  terminalWidth,
}: ThemeDialogProps): React.JSX.Element {
  const [selectedScope, setSelectedScope] = useState<SettingScope>(
    SettingScope.User,
  );

  // Generate theme items
  // Ensure custom themes are loaded before rendering
  useEffect(() => {
    themeManager.loadCustomThemes(settings.merged.customThemes);
  }, [settings.merged.customThemes]);

  const availableThemes = themeManager.getAvailableThemes();
  const themeItems = availableThemes.map((theme) => {
    const typeString = theme.type.charAt(0).toUpperCase() + theme.type.slice(1);
    const label = theme.isCustom ? `[Custom] ${theme.name}` : theme.name;
    return {
      label,
      value: theme.name, // Use theme name as value
      themeNameDisplay: theme.name,
      themeTypeDisplay: typeString,
      isCustom: theme.isCustom,
    };
  });

  const [selectInputKey, setSelectInputKey] = useState(Date.now());

  // Determine which radio button should be initially selected in the themes list
  // This should reflect the theme *saved* for the selected scope, or the default
  const initialThemeIndex = themeItems.findIndex(
    (item) => item.value === (settings.merged.theme || DEFAULT_THEME.name),
  );

  const scopeItems = [
    { label: 'User Settings', value: SettingScope.User },
    { label: 'Workspace Settings', value: SettingScope.Workspace },
  ];

  const handleThemeSelect = (themeName: string) => {
    onSelect(themeName, selectedScope);
  };

  const handleScopeHighlight = (scope: SettingScope) => {
    setSelectedScope(scope);
    setSelectInputKey(Date.now());
  };

  const handleScopeSelect = (scope: SettingScope) => {
    handleScopeHighlight(scope);
    setFocusedSection('theme'); // Reset focus to theme section
  };

  // Remove state and logic for 'create' focus section
  // const [focusedSection, setFocusedSection] = useState<'theme' | 'create' | 'scope'>('theme');
  const [focusedSection, setFocusedSection] = useState<'theme' | 'scope'>(
    'theme',
  );
  const [selectedThemeIndex, setSelectedThemeIndex] = useState(
    initialThemeIndex >= 0 ? initialThemeIndex : 0,
  );

  // Add a handler for navigation
  useInput((input, key) => {
    if (key.tab) {
      if (focusedSection === 'theme') {
        setFocusedSection('scope');
      } else {
        setFocusedSection('theme');
      }
      return;
    }
    if (key.return) {
      if (focusedSection === 'theme') {
        handleThemeSelect(themeItems[selectedThemeIndex].value);
      } else if (focusedSection === 'scope') {
        // No-op for now
      }
      return;
    }
    if (key.escape) {
      onSelect(undefined, selectedScope);
    }
  });

  let otherScopeModifiedMessage = '';
  const otherScope =
    selectedScope === SettingScope.User
      ? SettingScope.Workspace
      : SettingScope.User;
  if (settings.forScope(otherScope).settings.theme !== undefined) {
    otherScopeModifiedMessage =
      settings.forScope(selectedScope).settings.theme !== undefined
        ? `(Also modified in ${otherScope})`
        : `(Modified in ${otherScope})`;
  }

  // Constants for calculating preview pane layout.
  // These values are based on the JSX structure below.
  const PREVIEW_PANE_WIDTH_PERCENTAGE = 0.55;
  // A safety margin to prevent text from touching the border.
  // This is a complete hack unrelated to the 0.9 used in App.tsx
  const PREVIEW_PANE_WIDTH_SAFETY_MARGIN = 0.9;
  // Combined horizontal padding from the dialog and preview pane.
  const TOTAL_HORIZONTAL_PADDING = 4;
  const colorizeCodeWidth = Math.max(
    Math.floor(
      (terminalWidth - TOTAL_HORIZONTAL_PADDING) *
      PREVIEW_PANE_WIDTH_PERCENTAGE *
      PREVIEW_PANE_WIDTH_SAFETY_MARGIN,
    ),
    1,
  );

  const DAILOG_PADDING = 2;
  const selectThemeHeight = themeItems.length + 1;
  const SCOPE_SELECTION_HEIGHT = 4; // Height for the scope selection section + margin.
  const SPACE_BETWEEN_THEME_SELECTION_AND_APPLY_TO = 1;
  const TAB_TO_SELECT_HEIGHT = 2;
  availableTerminalHeight = availableTerminalHeight ?? Number.MAX_SAFE_INTEGER;
  availableTerminalHeight -= 2; // Top and bottom borders.
  availableTerminalHeight -= TAB_TO_SELECT_HEIGHT;

  let totalLeftHandSideHeight =
    DAILOG_PADDING +
    selectThemeHeight +
    SCOPE_SELECTION_HEIGHT +
    SPACE_BETWEEN_THEME_SELECTION_AND_APPLY_TO;

  let showScopeSelection = true;
  let includePadding = true;

  // Remove content from the LHS that can be omitted if it exceeds the available height.
  if (totalLeftHandSideHeight > availableTerminalHeight) {
    includePadding = false;
    totalLeftHandSideHeight -= DAILOG_PADDING;
  }

  if (totalLeftHandSideHeight > availableTerminalHeight) {
    // First, try hiding the scope selection
    totalLeftHandSideHeight -= SCOPE_SELECTION_HEIGHT;
    showScopeSelection = false;
  }

  // Don't focus the scope selection if it is hidden due to height constraints.
  const currenFocusedSection = !showScopeSelection ? 'theme' : focusedSection;

  // Vertical space taken by elements other than the two code blocks in the preview pane.
  // Includes "Preview" title, borders, and margin between blocks.
  const PREVIEW_PANE_FIXED_VERTICAL_SPACE = 8;

  // The right column doesn't need to ever be shorter than the left column.
  availableTerminalHeight = Math.max(
    availableTerminalHeight,
    totalLeftHandSideHeight,
  );
  const availableTerminalHeightCodeBlock =
    availableTerminalHeight -
    PREVIEW_PANE_FIXED_VERTICAL_SPACE -
    (includePadding ? 2 : 0) * 2;
  // Give slightly more space to the code block as it is 3 lines longer.
  const diffHeight = Math.floor(availableTerminalHeightCodeBlock / 2) - 1;
  const codeBlockHeight = Math.ceil(availableTerminalHeightCodeBlock / 2) + 1;

  // useEffect for previewing theme
  useEffect(() => {
    const previewThemeObj = themeManager.findThemeByName(
      themeItems[selectedThemeIndex]?.value,
    );
    if (previewThemeObj) {
      themeManager.setActiveTheme(previewThemeObj.name);
    }
  }, [selectedThemeIndex, themeItems]);

  let themeInstructions = '';
  if (focusedSection === 'theme') {
    themeInstructions = 'Press Enter to select.';
  }

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.Gray}
      flexDirection="column"
      paddingTop={includePadding ? 1 : 0}
      paddingBottom={includePadding ? 1 : 0}
      paddingLeft={1}
      paddingRight={1}
      width="100%"
    >
      <Box flexDirection="row">
        {/* Left Column: Selection */}
        <Box flexDirection="column" width="45%" paddingRight={2}>
          <Text bold={focusedSection === 'theme'} wrap="truncate">
            {focusedSection === 'theme' ? '> ' : '  '}Select Theme{' '}
            <Text color={Colors.Gray}>{otherScopeModifiedMessage}</Text>
          </Text>
          <RadioButtonSelect
            key={selectInputKey}
            items={themeItems}
            initialIndex={selectedThemeIndex}
            onSelect={handleThemeSelect}
            onHighlight={(themeName) => {
              const idx = themeItems.findIndex(
                (item) => item.value === themeName,
              );
              if (idx !== -1) setSelectedThemeIndex(idx);
              // Optionally preview theme here if needed
              if (themeName) themeManager.setActiveTheme(themeName);
            }}
            isFocused={currenFocusedSection === 'theme'}
          />
          <Box marginTop={1}>
            <Text color={Colors.Gray}>{themeInstructions}</Text>
          </Box>
          {/* Scope Selection */}
          {showScopeSelection && (
            <Box marginTop={1} flexDirection="column">
              <Text bold={focusedSection === 'scope'} wrap="truncate">
                {focusedSection === 'scope' ? '> ' : '  '}Apply To
              </Text>
              <RadioButtonSelect
                items={scopeItems}
                initialIndex={0} // Default to User Settings
                onSelect={handleScopeSelect}
                onHighlight={handleScopeHighlight}
                isFocused={currenFocusedSection === 'scope'}
              />
            </Box>
          )}
        </Box>

        {/* Right Column: Preview */}
        <Box flexDirection="column" width="55%" paddingLeft={2}>
          <Text bold>Preview</Text>
          <Box
            borderStyle="single"
            borderColor={Colors.Gray}
            paddingTop={includePadding ? 1 : 0}
            paddingBottom={includePadding ? 1 : 0}
            paddingLeft={1}
            paddingRight={1}
            flexDirection="column"
          >
            {colorizeCode(
              `# function\ndef fibonacci(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a`,
              'python',
              codeBlockHeight,
              colorizeCodeWidth,
            )}
            <Box marginTop={1} />
            <DiffRenderer
              diffContent={`--- a/old_file.txt\n+++ b/new_file.txt\n@@ -1,4 +1,5 @@\n This is a context line.\n-This line was deleted.\n+This line was added.\n`}
              availableTerminalHeight={diffHeight}
              terminalWidth={colorizeCodeWidth}
            />
          </Box>
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text color={Colors.Gray} wrap="truncate">
          (Use Enter to select
          {showScopeSelection ? ', Tab to change focus' : ''})
        </Text>
      </Box>
    </Box>
  );
}
