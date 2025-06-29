/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { Colors } from '../colors.js';
import { shortenUrlWithFallback } from '../../utils/urlShortener.js';

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
  const [displayUrl, setDisplayUrl] = useState(authUrl);
  const [isUrlShortening, setIsUrlShortening] = useState(false);

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

  // Shorten the URL when component mounts
  useEffect(() => {
    const shortenAuthUrl = async () => {
      setIsUrlShortening(true);
      try {
        const shortened = await shortenUrlWithFallback(authUrl);
        setDisplayUrl(shortened);
      } catch (error) {
        // If shortening fails, keep the original URL
        console.warn('Failed to shorten auth URL:', error);
        setDisplayUrl(authUrl);
      } finally {
        setIsUrlShortening(false);
      }
    };

    shortenAuthUrl();
  }, [authUrl]);

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
            {(() => {
              try {
                const port = new URL(callbackUrl).port;
                return `ssh -L ${port}:localhost:${port} <your-ssh-connection>`;
              } catch {
                return 'Invalid callback URL. Cannot generate SSH command.';
              }
            })()}
          </Text>
        </Box>
        <Box marginLeft={3}>
          <Text color={Colors.Gray}>Or access: {callbackUrl}</Text>
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
        <Text bold color={Colors.AccentBlue}>
          {isUrlShortening
            ? 'Shortening authentication URL...'
            : 'Authentication URL (click to select and copy):'}
        </Text>
      </Box>

      {/* Show shortened URL if available */}
      {displayUrl !== authUrl && !isUrlShortening && (
        <Box marginTop={1}>
          <Text bold color={Colors.AccentGreen}>
            Shortened URL:
          </Text>
          <Box marginTop={1}>
            <Text color={Colors.AccentBlue} wrap="wrap">
              {displayUrl}
            </Text>
          </Box>
        </Box>
      )}

      {/* Always show original URL */}
      <Box marginTop={1}>
        <Text bold color={Colors.AccentBlue}>
          {displayUrl !== authUrl && !isUrlShortening ? 'Original URL:' : ''}
        </Text>
        <Box marginTop={displayUrl !== authUrl && !isUrlShortening ? 1 : 0}>
          <Text
            color={
              displayUrl !== authUrl && !isUrlShortening
                ? Colors.Gray
                : Colors.AccentBlue
            }
            wrap="wrap"
          >
            {displayUrl !== authUrl && !isUrlShortening
              ? authUrl
              : isUrlShortening
                ? 'Shortening...'
                : displayUrl}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
