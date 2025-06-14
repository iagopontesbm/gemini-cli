/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserTool } from './userToolsLoader.js';

export class UserToolProcessor {
  /**
   * Process a user tool command and prepare it for execution
   * @param tool The user tool definition
   * @param args Arguments passed to the command
   * @returns The processed prompt to send to Gemini
   */
  static processUserToolCommand(tool: UserTool, args: string[]): string {
    let prompt = `[This is the expanded content of the user-defined command '/user-${tool.name}' - the command has already been processed by the CLI]\n\n`;
    prompt += tool.content;

    // If user provided any arguments/instructions, append them to the prompt
    const userInstructions = args.join(' ').trim();
    if (userInstructions) {
      prompt += '\n\n---\n';
      prompt +=
        'At the time of invoking this tool, the user provided these additional instructions:\n';
      prompt += userInstructions;
    }

    return prompt;
  }
}
