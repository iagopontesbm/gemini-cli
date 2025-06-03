/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCoreSystemPrompt } from './prompts.js'; // Adjust import path
import * as process from 'node:process';

// Mock tool names if they are dynamically generated or complex
vi.mock('../tools/ls', () => ({ LSTool: { Name: 'list_directory' } }));
vi.mock('../tools/edit', () => ({ EditTool: { Name: 'replace' } }));
vi.mock('../tools/glob', () => ({ GlobTool: { Name: 'glob' } }));
vi.mock('../tools/grep', () => ({ GrepTool: { Name: 'search_file_content' } }));
vi.mock('../tools/read-file', () => ({ ReadFileTool: { Name: 'read_file' } }));
vi.mock('../tools/read-many-files', () => ({
  ReadManyFilesTool: { Name: 'read_many_files' },
}));
vi.mock('../tools/shell', () => ({
  ShellTool: { Name: 'execute_bash_command' },
}));
vi.mock('../tools/write-file', () => ({
  WriteFileTool: { Name: 'write_file' },
}));

describe('Core System Prompt (prompts.ts)', () => {
  afterEach(() => {
    delete process.env.SANDBOX;
    delete process.env.SANDBOX_PROMPT;
  });

  it('should return the base prompt when no userMemory is provided', () => {
    const prompt = getCoreSystemPrompt();
    expect(prompt).not.toContain('---\n\n');
    expect(prompt).toContain('You are an interactive CLI agent');
    expect(prompt).toMatchSnapshot();
  });

  it('should return the base prompt when userMemory is empty string', () => {
    const prompt = getCoreSystemPrompt('');
    expect(prompt).not.toContain('---\n\n');
    expect(prompt).toContain('You are an interactive CLI agent');
    expect(prompt).toMatchSnapshot();
  });

  it('should return the base prompt when userMemory is whitespace only', () => {
    const prompt = getCoreSystemPrompt('   \n  \t ');
    expect(prompt).not.toContain('---\n\n');
    expect(prompt).toContain('You are an interactive CLI agent');
    expect(prompt).toMatchSnapshot();
  });

  it('should append userMemory with separator when provided', () => {
    const memory = 'This is custom user memory.\nBe extra polite.';
    const expectedSuffix = `\n\n---\n\n${memory}`;
    const prompt = getCoreSystemPrompt(memory);
    expect(prompt.endsWith(expectedSuffix)).toBe(true);
    expect(prompt).toContain('You are an interactive CLI agent');
    expect(prompt).toMatchSnapshot();
  });

  it('should include SANDBOX_PROMPT text when the environment variable is set', () => {
    const customSandboxText =
      '### MY CUSTOM SANDBOX INSTRUCTIONS ###\nThis is a test.';
    process.env.SANDBOX_PROMPT = customSandboxText;
    const prompt = getCoreSystemPrompt();
    expect(prompt).toContain(customSandboxText);
    expect(prompt).not.toContain('# Outside of Sandbox');
    expect(prompt).toMatchSnapshot();
  });

  it('should include non-sandbox instructions when SANDBOX_PROMPT is not set', () => {
    // SANDBOX_PROMPT is deleted by beforeEach
    const prompt = getCoreSystemPrompt();
    expect(prompt).toContain('# Outside of Sandbox');
    expect(prompt).not.toContain('### MY CUSTOM SANDBOX INSTRUCTIONS ###');
    expect(prompt).toMatchSnapshot();
  });
});
