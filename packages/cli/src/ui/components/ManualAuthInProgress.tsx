/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { Colors } from '../colors.js';

interface ManualAuthInProgressProps {
  authUrl: string;
  callbackUrl: string;
  onTimeout: () => void;
}

export function ManualAuthInProgress({
  authUrl,
  callbackUrl,
  onTimeout,
}: ManualAuthInProgressProps): React.JSX.Element {
  const [timedOut, setTimedOut] = useState(false);

  useInput((_, key) => {
    if (key.escape) {
      onTimeout();
    }
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setTimedOut(true);
      onTimeout();
    }, 180000);

    return () => clearTimeout(timer);
  }, [onTimeout]);

  if (timedOut) {
    return (
      <Box
        borderStyle="round"
        borderColor={Colors.Gray}
        flexDirection="column"
        padding={1}
        width="100%"
      >
        <Text color={Colors.AccentRed}>
          Authentication timed out. Please try again.
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width="100%">
      {/* Instructions box */}
      <Box
        borderStyle="round"
        borderColor={Colors.Gray}
        flexDirection="column"
        padding={1}
        width="100%"
      >
        <Text bold>Manual Login with Google</Text>
        <Box marginTop={1}>
          <Text>Please complete the following steps:</Text>
        </Box>
        
        <Box marginTop={1}>
          <Text bold>1. Copy and paste the URL below into your browser</Text>
        </Box>

        <Box marginTop={1}>
          <Text bold>2. Set up port forwarding (if using SSH):</Text>
        </Box>
        <Box marginLeft={3} marginTop={1}>
          <Text color={Colors.AccentGreen}>
            ssh -L {new URL(callbackUrl).port}:localhost:{new URL(callbackUrl).port} &lt;your-ssh-connection&gt;
          </Text>
        </Box>
        <Box marginLeft={3}>
          <Text color={Colors.Gray}>
            Or access: {callbackUrl}
          </Text>
        </Box>

        <Box marginTop={1}>
          <Text bold>3. Complete the authentication in your browser</Text>
        </Box>
        
        <Box marginTop={1}>
          <Text bold>4. The browser will redirect to the callback URL</Text>
        </Box>

        <Box marginTop={2}>
          <Text color={Colors.AccentYellow}>
            Waiting for authentication... (Press ESC to cancel)
          </Text>
        </Box>
      </Box>

      {/* Auth URL displayed outside box for easy copying */}
      <Box marginTop={1}>
        <Text bold color={Colors.AccentBlue}>Authentication URL (click to select and copy):</Text>
      </Box>
      <Box marginTop={1} paddingX={1}>
        <Text color={Colors.AccentBlue} wrap="wrap">
          {authUrl}
        </Text>
      </Box>
    </Box>
  );
}