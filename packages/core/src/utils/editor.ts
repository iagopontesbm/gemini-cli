/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from 'child_process';

interface DiffCommand {
  command: string;
  args: string[];
}

/**
 * Finds the best available diff tool on the system.
 * Currently supported: vimdiff, vscode.
 * Note that vscode might not work properly in sandbox mode.
 */
export function getBestDiffCommand(
  oldPath: string,
  newPath: string,
): DiffCommand | null {
  const commandExists = (cmd: string): boolean => {
    try {
      execSync(`which ${cmd}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  };

  const isSandbox = !!process.env.SANDBOX;
  const diffTools = [
    // GUI editors
    ...(!isSandbox
      ? [
          {
            name: 'vscode',
            command: 'code',
            args: (oldPath: string, newPath: string) => [
              '--wait',
              '--diff',
              oldPath,
              newPath,
            ],
          },
        ]
      : []),
    // Terminal-based editors
    {
      name: 'vimdiff',
      command: 'vimdiff',
      args: (oldPath: string, newPath: string) => [oldPath, newPath],
    },
  ];

  for (const tool of diffTools) {
    if (commandExists(tool.command)) {
      return {
        command: tool.command,
        args: tool.args(oldPath, newPath),
      };
    }
  }

  return null;
}

/**
 * Opens a diff tool to compare two files.
 * Terminal-based editors by default blocks parent process until the editor exits.
 * GUI-based editors requires args such as "--wait" to block parent process.
 */
export async function openDiff(
  oldPath: string,
  newPath: string,
): Promise<void> {
  const diffCommand = getBestDiffCommand(oldPath, newPath);
  if (!diffCommand) {
    console.error('No diff tool available. Install vimdiff or vscode.');
    return;
  }

  try {
    const command = `${diffCommand.command} ${diffCommand.args.map((arg) => `"${arg}"`).join(' ')}`;
    execSync(command, {
      stdio: 'inherit',
      encoding: 'utf8',
    });
  } catch (error) {
    console.error(error);
  }
}
