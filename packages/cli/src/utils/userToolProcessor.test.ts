/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { UserToolProcessor } from './userToolProcessor.js';
import { UserTool } from './userToolsLoader.js';

describe('UserToolProcessor', () => {
  describe('processUserToolCommand', () => {
    it('should process tool without additional instructions', () => {
      const tool: UserTool = {
        name: 'test-tool',
        description: 'Test tool',
        content: 'This is the tool template.',
        filePath: '/test/path/test-tool.md',
      };

      const result = UserToolProcessor.processUserToolCommand(tool, []);

      expect(result).toBe(
        `[This is the expanded content of the user-defined command '/user-test-tool' - the command has already been processed by the CLI]\n\n` +
          `This is the tool template.`,
      );
    });

    it('should append user instructions when provided', () => {
      const tool: UserTool = {
        name: 'git-log',
        description: 'Show git log',
        content: 'Please show the git commit history.',
        filePath: '/test/path/git-log.md',
      };

      const result = UserToolProcessor.processUserToolCommand(tool, [
        '--since="1 week ago"',
        '--author="John"',
      ]);

      expect(result).toBe(
        `[This is the expanded content of the user-defined command '/user-git-log' - the command has already been processed by the CLI]\n\n` +
          `Please show the git commit history.\n\n---\n` +
          `At the time of invoking this tool, the user provided these additional instructions:\n` +
          `--since="1 week ago" --author="John"`,
      );
    });

    it('should handle empty args array', () => {
      const tool: UserTool = {
        name: 'test',
        description: 'Test',
        content: 'Content',
        filePath: '/test/path/test.md',
      };

      const result = UserToolProcessor.processUserToolCommand(tool, []);

      expect(result).not.toContain('additional instructions');
    });

    it('should handle args with only whitespace', () => {
      const tool: UserTool = {
        name: 'test',
        description: 'Test',
        content: 'Content',
        filePath: '/test/path/test.md',
      };

      const result = UserToolProcessor.processUserToolCommand(tool, [
        '  ',
        '',
        '   ',
      ]);

      expect(result).not.toContain('additional instructions');
    });

    it('should preserve spacing in user instructions', () => {
      const tool: UserTool = {
        name: 'test',
        description: 'Test',
        content: 'Content',
        filePath: '/test/path/test.md',
      };

      const result = UserToolProcessor.processUserToolCommand(tool, [
        'arg1',
        'arg2   with   spaces',
        'arg3',
      ]);

      expect(result).toContain('arg1 arg2   with   spaces arg3');
    });
  });
});
