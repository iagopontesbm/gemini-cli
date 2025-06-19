/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text, useInput } from 'ink';
import { useState, useCallback } from 'react';
import { Config, refreshAuth } from '@gemini-cli/core';
import open from 'open';
import { Colors } from '../colors.js';

interface ReauthDialogProps {
  config: Config;
  onAuthSuccess: () => void;
}

export const ReauthDialog = ({ config, onAuthSuccess }: ReauthDialogProps) => {
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleConfirm = useCallback(async () => {
    if (isAuthenticating) return;

    const authProcess = await refreshAuth(
      config.getGeminiClient().getContentGenerator(),
    );
    setAuthUrl(authProcess.authUrl);
    setIsAuthenticating(true);
    await open(authProcess.authUrl);
    await authProcess.loginCompletePromise;
    onAuthSuccess();
  }, [config, onAuthSuccess, isAuthenticating]);

  useInput((_input, key) => {
    if (key.return) {
      handleConfirm();
    }
  });

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.AccentRed}
      paddingX={1}
      marginY={1}
      flexDirection="column"
    >
      <Text color={Colors.AccentRed}>
        Authentication error: Your session has expired.
      </Text>
      {!isAuthenticating && <Text>Press Enter to log in again.</Text>}
      {authUrl && (
        <Box flexDirection="column" marginTop={1}>
          <Text>
            Please open the following URL in your browser to continue:
          </Text>
          <Text color={Colors.AccentBlue}>{authUrl}</Text>
        </Box>
      )}
      {isAuthenticating && (
        <Text color={Colors.AccentYellow}>Waiting for authentication...</Text>
      )}
    </Box>
  );
};
