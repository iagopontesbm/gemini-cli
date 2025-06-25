/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import spinners, { SpinnerName } from 'cli-spinners';
import React, { useEffect, useState } from 'react';
import { Text } from 'ink';

interface SpinnerProps {
  type?: SpinnerName;
}

export const Spinner: React.FC<SpinnerProps> = ({ type = 'dots' }) => {
  const [frame, setFrame] = useState(0);
  const spinner = spinners[type];
  // Use slower interval instead of default to reduce re-renders
  const interval = 1000;

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((previousFrame) => {
        const isLastFrame = previousFrame === spinner.frames.length - 1;
        return isLastFrame ? 0 : previousFrame + 1;
      });
    }, interval);

    return () => {
      clearInterval(timer);
    };
  }, [spinner]);

  return <Text>{spinner.frames[frame]}</Text>;
};
