/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import { Colors } from '../colors.js';

export interface AuthStatusMessageProps {
  message: string;
  isSuccess?: boolean;
}

export const AuthStatusMessage = ({ message, isSuccess = false }: AuthStatusMessageProps) => (
  <Box marginTop={1} marginBottom={1}>
    <Text color={isSuccess ? Colors.AccentGreen : Colors.AccentRed}>
      {message}
    </Text>
  </Box>
);