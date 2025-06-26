/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';

const TERMINAL_PADDING_X = 8;

export function useTerminalSize(): { columns: number; rows: number } {
  const [size, setSize] = useState({
    columns: (process.stdout.columns || 60) - TERMINAL_PADDING_X,
    rows: process.stdout.rows || 20,
  });

  useEffect(() => {
    function updateSize() {
      setSize({
        columns: (process.stdout.columns || 60) - TERMINAL_PADDING_X,
        rows: process.stdout.rows || 20,
      });
    }

    function handleStdoutError(err: Error) {
      // Log but don't crash on stdout errors
      console.error('process.stdout error in useTerminalSize:', err.message);
    }

    process.stdout.on('resize', updateSize);
    process.stdout.on('error', handleStdoutError);
    
    return () => {
      process.stdout.off('resize', updateSize);
      process.stdout.off('error', handleStdoutError);
    };
  }, []);

  return size;
}
