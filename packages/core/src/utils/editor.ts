/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from 'child_process';

type EditorType = 'vscode' | 'vimdiff';

interface DiffCommand {
  command: string;
  args: string[];
}

export function checkHasEditor(editor: 'vscode' | 'vimdiff'): boolean {
  const commandExists = (cmd: string): boolean => {
    try {
      execSync(`which ${cmd}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  };

  if (editor === 'vscode') {
    return commandExists('code');
  } else if (editor === 'vimdiff') {
    return commandExists('vimdiff');
  }
  return false;
}

/**
 * Get the diff command for a specific editor.
 */
export function getDiffCommand(
  oldPath: string,
  newPath: string,
  editor: EditorType,
): DiffCommand | null {
  switch (editor) {
    case 'vscode':
      return {
        command: 'code',
        args: ['--wait', '--diff', oldPath, newPath],
      };
    case 'vimdiff':
      return {
        command: 'vimdiff',
        args: [
          // skip viminfo file to avoid E138 errors
          '-i',
          'NONE',
          // make the left window read-only and the right window editable
          '-c',
          'wincmd h | set readonly | wincmd l',
          // Show helpful message in status line
          '-c',
          'set statusline=\\ :wqa(save+quit)\\ \\|\\ :qa!(quit)\\ \\|\\ i/esc(toggle\\ edit\\ mode)',
          oldPath,
          newPath,
        ],
      };
    default:
      return null;
  }
}

/**
 * Opens a diff tool to compare two files.
 * Terminal-based editors by default blocks parent process until the editor exits.
 * GUI-based editors requires args such as "--wait" to block parent process.
 */
export async function openDiff(
  oldPath: string,
  newPath: string,
  editor: EditorType,
): Promise<void> {
  const diffCommand = getDiffCommand(oldPath, newPath, editor);
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
