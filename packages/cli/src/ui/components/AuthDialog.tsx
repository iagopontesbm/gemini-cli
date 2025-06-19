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
import { AuthType } from '@gemini-cli/core';
import { loadEnvironment } from '../../config/config.js';

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const authItems = [
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

  const validateAuthMethod = (authMethod: string): string | null => {
    if (authMethod === AuthType.LOGIN_WITH_GOOGLE_PERSONAL) {
      return null;
    }

    if (authMethod === AuthType.LOGIN_WITH_GOOGLE_ENTERPRISE) {
      if (!process.env.GOOGLE_CLOUD_PROJECT) {
        return 'GOOGLE_CLOUD_PROJECT environment variable not found. Add that to ~/.env and try again, no reload needed!';
      }
      return null;
    }

    if (authMethod === AuthType.USE_GEMINI) {
      if (!process.env.GEMINI_API_KEY) {
        return 'GEMINI_API_KEY environment variable not found. Add that to ~/.env and try again, no reload needed!';
      }
      return null;
    }

    if (authMethod === AuthType.USE_VERTEX_AI) {
      if (!process.env.GOOGLE_API_KEY) {
        return 'GOOGLE_API_KEY environment variable must be set.';
      }
      if (!process.env.GOOGLE_CLOUD_PROJECT) {
        return 'GOOGLE_CLOUD_PROJECT environment variable must be set.';
      }
      if (!process.env.GOOGLE_CLOUD_LOCATION) {
        return 'GOOGLE_CLOUD_LOCATION environment variable must be set.';
      }
      return null;
    }

    return 'Invalid auth method selected.';
  };

  const handleAuthSelect = (authMethod: string) => {
    loadEnvironment()
    const error = validateAuthMethod(authMethod);
    if (error) {
      setErrorMessage(error);
    } else {
      setErrorMessage(null);
      onSelect(authMethod, SettingScope.User);
    }
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
      {errorMessage && (
        <Box marginTop={1}>
          <Text color={Colors.AccentRed}>{errorMessage}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text color={Colors.Gray}>(Use Enter to select)</Text>
      </Box>
    </Box>
  );
}
