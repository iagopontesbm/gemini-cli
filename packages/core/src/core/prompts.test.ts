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
  // Store original env vars that we modify
  let originalSandboxEnv: string | undefined;

  beforeEach(() => {
    // Store original value before each test
    originalSandboxEnv = process.env.SANDBOX;
  });

  afterEach(() => {
    // Restore original value after each test
    if (originalSandboxEnv === undefined) {
      delete process.env.SANDBOX;
    } else {
      process.env.SANDBOX = originalSandboxEnv;
    }
  });

  it('should return the base prompt when no userMemory is provided', () => {
    delete process.env.SANDBOX; // Ensure default state for snapshot
    const prompt = getCoreSystemPrompt();
    expect(prompt).not.toContain('---\n\n'); // Separator should not be present
    expect(prompt).toContain('You are an interactive CLI agent'); // Check for core content
    expect(prompt).toMatchSnapshot(); // Use snapshot for base prompt structure
  });

  it('should return the base prompt when userMemory is empty string', () => {
    delete process.env.SANDBOX;
    const prompt = getCoreSystemPrompt('');
    expect(prompt).not.toContain('---\n\n');
    expect(prompt).toContain('You are an interactive CLI agent');
    expect(prompt).toMatchSnapshot();
  });

  it('should return the base prompt when userMemory is whitespace only', () => {
    delete process.env.SANDBOX;
    const prompt = getCoreSystemPrompt('   \n  \t ');
    expect(prompt).not.toContain('---\n\n');
    expect(prompt).toContain('You are an interactive CLI agent');
    expect(prompt).toMatchSnapshot();
  });

  it('should append userMemory with separator when provided', () => {
    delete process.env.SANDBOX;
    const memory = 'This is custom user memory.\nBe extra polite.';
    const expectedMemorySectionSuffix = `\n\n---\n\n# Memory

      - **User-Provided Context:** The user may provide you with information through a tool called a "memory". This information is intended to be a piece of context that you should use for the current conversation.
      - **Not part of conversation history:** Memories should not be affected by conversation history unless this is explicitly mentioned as part of the memory text. Memories are simply pieces of additional context that you should be aware of and you should ignore them if they are not relevant to your goals as the Gemini CLI agent.
      - **Can be modified:** The user can modify the memory at any time. When this happens, you will be provided with the new memory. You should then use the new memory for the rest of the conversation and avoid referring to old memories that may be a part of the conversation history.

      ---

      ## Memories
      ${memory.trim()}`;
    const prompt = getCoreSystemPrompt(memory);

    expect(prompt.endsWith(expectedMemorySectionSuffix)).toBe(true);
    expect(prompt).toContain('You are an interactive CLI agent'); // Ensure base prompt follows
    expect(prompt).toMatchSnapshot(); // Snapshot the combined prompt
  });

  it('should include sandbox-specific instructions when SANDBOX env var is set', () => {
    process.env.SANDBOX = 'true'; // Generic sandbox value
    const prompt = getCoreSystemPrompt();
    expect(prompt).toContain('# Sandbox');
    expect(prompt).not.toContain('# MacOS Seatbelt');
    expect(prompt).not.toContain('# Outside of Sandbox');
    expect(prompt).toMatchSnapshot();
  });

  it('should include seatbelt-specific instructions when SANDBOX env var is "sandbox-exec"', () => {
    process.env.SANDBOX = 'sandbox-exec';
    const prompt = getCoreSystemPrompt();
    expect(prompt).toContain('# MacOS Seatbelt');
    expect(prompt).not.toContain('# Sandbox');
    expect(prompt).not.toContain('# Outside of Sandbox');
    expect(prompt).toMatchSnapshot();
  });

  it('should include non-sandbox instructions when SANDBOX env var is not set', () => {
    delete process.env.SANDBOX; // Ensure it's not set
    const prompt = getCoreSystemPrompt();
    expect(prompt).toContain('# Outside of Sandbox');
    expect(prompt).not.toContain('# Sandbox');
    expect(prompt).not.toContain('# MacOS Seatbelt');
    expect(prompt).toMatchSnapshot();
  });
});
