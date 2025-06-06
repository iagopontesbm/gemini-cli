/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Config, ChatSession } from '@gemini-code/core';

export async function runNonInteractive(
  config: Config,
  input: string,
): Promise<void> {
  const chatSession = new ChatSession(config);

  try {
    for await (const event of chatSession.sendMessage(input)) {
      switch (event.type) {
        case 'text':
          process.stdout.write(event.content);
          break;
        case 'tool_code':
          // In non-interactive mode, we can just print the tool code.
          console.log(`\nTool Call:\n${event.content}`);
          break;
        case 'tool_result':
          console.log(`\nTool Result (${event.name}):\n${event.content}`);
          break;
      }
    }
    process.stdout.write('\n');
  } catch (error) {
    console.error('Error processing input:', error);
    process.exit(1);
  }
}