/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { exec } from 'node:child_process';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'path';

export function useGitBranchName(cwd: string): string | undefined {
  const [branchName, setBranchName] = useState<string | undefined>(undefined);

  const fetchBranchName = useCallback(
    () =>
      exec(
        'git rev-parse --abbrev-ref HEAD',
        { cwd },
        (error, stdout, _stderr) => {
          if (error) {
            setBranchName(undefined);
            return;
          }
          const branch = stdout.toString().trim();
          if (branch && branch !== 'HEAD') {
            setBranchName(branch);
          } else {
            exec(
              'git rev-parse --short HEAD',
              { cwd },
              (error, stdout, _stderr) => {
                if (error) {
                  setBranchName(undefined);
                  return;
                }
                setBranchName(stdout.toString().trim());
              },
            );
          }
        },
      ),
    [cwd, setBranchName],
  );

  useEffect(() => {
    fetchBranchName(); // Initial fetch

    const gitLogsHeadPath = path.join(cwd, '.git', 'logs', 'HEAD');
    let watcher: fs.FSWatcher | undefined;

    const setupWatcher = async () => {
      try {
        // Check if .git/logs/HEAD exists, as it might not in a new repo or orphaned head
        await fsPromises.access(gitLogsHeadPath, fs.constants.F_OK);
        watcher = fs.watch(gitLogsHeadPath, (eventType: string) => {
          // Changes to .git/logs/HEAD (appends) indicate HEAD has likely changed
          if (eventType === 'change' || eventType === 'rename') {
            // Handle rename just in case
            fetchBranchName();
          }
        });

        // Handle runtime errors from the watcher (e.g., EPERM, file deletion, etc.)
        watcher.on('error', (error: NodeJS.ErrnoException) => {
          // Silently ignore watcher runtime errors (e.g. permissions, file deletion),
          // similar to how exec errors are handled.
          // The branch name will simply not update automatically.
          console.warn('Git branch watcher error (continuing without file watching):', error.code || error.message);
          
          // Close the watcher to prevent further errors
          try {
            watcher?.close();
          } catch (_closeError) {
            // Ignore close errors
          }
          watcher = undefined;
        });
      } catch (_watchError) {
        // Silently ignore watcher setup errors (e.g. permissions or file not existing),
        // similar to how exec errors are handled.
        // The branch name will simply not update automatically.
      }
    };

    setupWatcher();

    return () => {
      watcher?.close();
    };
  }, [cwd, fetchBranchName]);

  return branchName;
}
