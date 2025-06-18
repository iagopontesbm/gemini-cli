/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Colors } from '../colors.js';
import { RadioButtonSelect } from './shared/RadioButtonSelect.js';
import { LoadedSettings, SettingScope } from '../../config/settings.js';

interface AuthDialogProps {
  onSelect: (authMethod: string | undefined, scope: SettingScope) => void;
  onHighlight: (authMethod: string | undefined) => void;
  settings: LoadedSettings;
}

export function AuthDialog({
  onSelect,
  onHighlight,
  settings,
}: AuthDialogProps): React.JSX.Element {
  const [selectedScope, setSelectedScope] = useState<SettingScope>(
    SettingScope.User,
  );

  const authItems = [
    { label: 'gcloud application-default credentials', value: 'gcloud' },
    { label: 'OAuth with a personal account', value: 'oauth-personal' },
    {
      label: 'OAuth with a enterprise/work account and a GCP project',
      value: 'oauth-enterprise',
    },
    { label: 'Gemini API Key', value: 'gemini-api-key' },
  ];
  const [selectInputKey, setSelectInputKey] = useState(Date.now());

  const initialAuthIndex = authItems.findIndex(
    (item) => item.value === settings.merged.auth,
  );

  const scopeItems = [
    { label: 'User Settings', value: SettingScope.User },
    { label: 'Workspace Settings', value: SettingScope.Workspace },
  ];

  const handleAuthSelect = (authMethod: string) => {
    onSelect(authMethod, selectedScope);
  };

  const handleScopeHighlight = (scope: SettingScope) => {
    setSelectedScope(scope);
    setSelectInputKey(Date.now());
  };

  const handleScopeSelect = (scope: SettingScope) => {
    handleScopeHighlight(scope);
    setFocusedSection('auth');
  };

  const [focusedSection, setFocusedSection] = useState<'auth' | 'scope'>(
    'auth',
  );

  useInput((input, key) => {
    if (key.tab) {
      setFocusedSection((prev) => (prev === 'auth' ? 'scope' : 'auth'));
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
  if (settings.forScope(otherScope).settings.auth !== undefined) {
    otherScopeModifiedMessage =
      settings.forScope(selectedScope).settings.auth !== undefined
        ? `(Also modified in ${otherScope})`
        : `(Modified in ${otherScope})`;
  }

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.Gray}
      flexDirection="row"
      padding={1}
      width="100%"
    >
      <Box flexDirection="column" width="100%" paddingRight={2}>
        <Text bold={focusedSection === 'auth'}>
          {focusedSection === 'auth' ? '> ' : '  '}Select Auth Method{' '}
          <Text color={Colors.Gray}>{otherScopeModifiedMessage}</Text>
        </Text>
        <RadioButtonSelect
          key={selectInputKey}
          items={authItems}
          initialIndex={initialAuthIndex}
          onSelect={handleAuthSelect}
          onHighlight={onHighlight}
          isFocused={focusedSection === 'auth'}
        />

        <Box marginTop={1} flexDirection="column">
          <Text bold={focusedSection === 'scope'}>
            {focusedSection === 'scope' ? '> ' : '  '}Apply To
          </Text>
          <RadioButtonSelect
            items={scopeItems}
            initialIndex={0}
            onSelect={handleScopeSelect}
            onHighlight={handleScopeHighlight}
            isFocused={focusedSection === 'scope'}
          />
        </Box>

        <Box marginTop={1}>
          <Text color={Colors.Gray}>
            (Use Enter to select, Tab to change focus)
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
