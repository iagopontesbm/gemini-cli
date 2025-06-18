/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import { Colors } from '../colors.js';

export const ReauthDialog = () => {
  return (
    <Box
      borderStyle="round"
      borderColor={Colors.AccentRed}
      paddingX={1}
      marginY={1}
      flexDirection="column"
    >
      <Text color={Colors.AccentRed}>Authentication error: Your session has expired.</Text>
      <Text>Please restart the CLI to log in again.</Text>
    </Box>
  );
};
