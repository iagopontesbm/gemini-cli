/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text, useInput } from 'ink';
import { Colors } from '../colors.js';
import { RadioButtonSelect } from './shared/RadioButtonSelect.js';
import { LoadedSettings, SettingScope } from '../../config/settings.js';
import { AuthType } from '@gemini-cli/core';

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
  const authItems = [
    {
      label: 'Login w/Google: `gcloud application-default credentials`',
      value: AuthType.LOGIN_WITH_GOOGLE_APPLICATION_DEFAULT,
    },
    {
      label: 'Login w/Google: Personal Account',
      value: AuthType.LOGIN_WITH_GOOGLE_PERSONAL,
    },
    {
      label: 'Login w/Google: Work Account and a GCP project',
      value: AuthType.LOGIN_WITH_GOOGLE_ENTERPRISE,
    },
    { label: 'Gemini API Key', value: AuthType.USE_GEMINI },
    { label: 'Vertex AI', value: AuthType.USE_VERTEX_AI },
  ];

  let initialAuthIndex = authItems.findIndex(
    (item) => item.value === settings.merged.selectedAuthType,
  );

  if (initialAuthIndex === -1) {
    initialAuthIndex = 0;
  }

  const handleAuthSelect = (authMethod: string) => {
    onSelect(authMethod, SettingScope.User);
  };

  useInput((_input, key) => {
    if (key.escape) {
      onSelect(undefined, SettingScope.User);
    }
  });

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.Gray}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>Select Auth Method</Text>
      <RadioButtonSelect
        items={authItems}
        initialIndex={initialAuthIndex}
        onSelect={handleAuthSelect}
        onHighlight={onHighlight}
        isFocused={true}
      />
      <Box marginTop={1}>
        <Text color={Colors.Gray}>(Use Enter to select)</Text>
      </Box>
    </Box>
  );
}
