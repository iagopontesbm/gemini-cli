/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRef, useEffect } from 'react';
import { Logger } from '@gemini-code/server';

/**
 * Hook to manage the logger instance.
 */
export const useLogger = () => {
  const loggerRef = useRef<Logger | null>(null);

  useEffect(() => {
    if (!loggerRef.current) {
      const newLogger = new Logger();
      /**
       * Start async initialization, no need to await. Using await slows down the
       * time from launch to see the gemini-cli prompt and it's better to not save
       * messages than for the cli to hanging waiting for the logger to loading.
       */
      newLogger
        .initialize()
        .then(() => {
          loggerRef.current = newLogger;
        })
        .catch(() => { });
    }
  }, []);

  return loggerRef;
};
