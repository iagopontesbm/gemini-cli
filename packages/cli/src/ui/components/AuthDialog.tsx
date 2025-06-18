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
    { label: 'gcloud application-default credentials', value: 'gcloud' },
    { label: 'OAuth with a personal account', value: 'oauth-personal' },
    {
      label: 'OAuth with a enterprise/work account and a GCP project',
      value: 'oauth-enterprise',
    },
    { label: 'Gemini API Key', value: 'gemini-api-key' },
    { label: 'Vertex AI', value: 'vertex-ai' },
  ];

  let initialAuthIndex = authItems.findIndex(
    (item) => item.value === settings.merged.auth,
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
