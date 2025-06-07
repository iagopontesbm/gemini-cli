/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn, execSync } from 'child_process';

interface DiffCommand {
  command: string;
  args: string[];
  isTerminalBased: boolean;
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
              '--diff',
              oldPath,
              newPath,
            ],
            isTerminalBased: false,
          },
        ]
      : []),
    // Terminal-based editors
    {
      name: 'vimdiff',
      command: 'vimdiff',
      args: (oldPath: string, newPath: string) => [oldPath, newPath],
      isTerminalBased: true,
    },
  ];

  for (const tool of diffTools) {
    if (commandExists(tool.command)) {
      return {
        command: tool.command,
        args: tool.args(oldPath, newPath),
        isTerminalBased: tool.isTerminalBased,
      };
    }
  }

  return null;
}

/**
 * Opens a diff tool to compare two files.
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

  if (diffCommand.isTerminalBased) {
    try {
      const command = `${diffCommand.command} ${diffCommand.args.map((arg) => `"${arg}"`).join(' ')}`;
      // This blocks the CLI until the editor exits.
      execSync(command, {
        stdio: 'inherit',
        encoding: 'utf8',
      });
    } catch (error) {
      console.error(error);
    }
  } else {
    const child = spawn(diffCommand.command, diffCommand.args, {
      stdio: 'ignore',
      detached: true,
    });
    child.unref();
  }
}
