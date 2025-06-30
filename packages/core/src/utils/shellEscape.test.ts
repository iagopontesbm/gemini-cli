/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { escapeShellArg, escapeGitCommitMessage } from './shellEscape.js';

describe('escapeShellArg', () => {
  it('should not escape simple alphanumeric strings', () => {
    expect(escapeShellArg('HelloWorld123')).toBe('HelloWorld123');
    expect(escapeShellArg('test-file_name.txt')).toBe('test-file_name.txt');
  });

  it('should escape empty strings', () => {
    expect(escapeShellArg('')).toBe("''");
  });

  it('should escape strings with spaces', () => {
    expect(escapeShellArg('hello world')).toBe("'hello world'");
  });

  it('should escape strings with backticks', () => {
    expect(escapeShellArg('Fix `bug` in code')).toBe("'Fix `bug` in code'");
    expect(escapeShellArg('Run `echo test`')).toBe("'Run `echo test`'");
  });

  it('should escape strings with command substitution', () => {
    expect(escapeShellArg('$(rm -rf /)')).toBe("'$(rm -rf /)'");
    expect(escapeShellArg('`rm -rf /`')).toBe("'`rm -rf /`'");
  });

  it('should escape strings with single quotes', () => {
    expect(escapeShellArg("don't")).toBe("'don'\\''t'");
    expect(escapeShellArg("it's a test")).toBe("'it'\\''s a test'");
  });

  it('should escape strings with special characters', () => {
    expect(escapeShellArg('test&test')).toBe("'test&test'");
    expect(escapeShellArg('test|test')).toBe("'test|test'");
    expect(escapeShellArg('test;test')).toBe("'test;test'");
    expect(escapeShellArg('test>test')).toBe("'test>test'");
    expect(escapeShellArg('test<test')).toBe("'test<test'");
  });

  it('should escape strings with newlines', () => {
    expect(escapeShellArg('line1\nline2')).toBe("'line1\nline2'");
  });

  it('should handle complex combinations', () => {
    expect(escapeShellArg("Fix `bug` in Mary's code")).toBe("'Fix `bug` in Mary'\\''s code'");
  });
});

describe('escapeGitCommitMessage', () => {
  it('should escape commit messages with backticks', () => {
    expect(escapeGitCommitMessage('Fix `ComponentName` rendering issue')).toBe("'Fix `ComponentName` rendering issue'");
  });

  it('should handle commit messages with potential command injection', () => {
    expect(escapeGitCommitMessage('Update code `rm -rf /` (example)')).toBe("'Update code `rm -rf /` (example)'");
  });

  it('should handle normal commit messages without special characters', () => {
    // Simple messages without special characters don't need escaping
    expect(escapeGitCommitMessage('Update-README.md')).toBe('Update-README.md');
    expect(escapeGitCommitMessage('Add-new-feature_123')).toBe('Add-new-feature_123');
  });
  
  it('should escape commit messages with spaces', () => {
    expect(escapeGitCommitMessage('Update README.md')).toBe("'Update README.md'");
    expect(escapeGitCommitMessage('Update README file')).toBe("'Update README file'");
  });
});