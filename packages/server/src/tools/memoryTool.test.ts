/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryTool } from './memoryTool.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('os');

const MEMORY_SECTION_HEADER = '## Gemini Added Memories'; // Match the constant in memoryTool.ts

describe('MemoryTool', () => {
  let memoryTool: MemoryTool;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  let mockMkdir: any;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  let mockReadFile: any;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  let mockWriteFile: any;
  const mockAbortSignal = new AbortController().signal;

  beforeEach(() => {
    memoryTool = new MemoryTool();
    mockMkdir = vi
      .spyOn(fs, 'mkdir')
      .mockResolvedValue(undefined as unknown as string);
    mockReadFile = vi.spyOn(fs, 'readFile'); // Will be configured per test
    mockWriteFile = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
    vi.mocked(os.homedir).mockReturnValue('/mock/home');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have correct name, displayName, description, and schema', () => {
    expect(memoryTool.name).toBe('saveMemory');
    expect(memoryTool.displayName).toBe('Save Memory');
    expect(memoryTool.description).toContain(
      'Saves a specific piece of information',
    );
    expect(memoryTool.schema).toBeDefined();
    expect(memoryTool.schema.name).toBe('saveMemory');
    expect(memoryTool.schema.parameters?.properties?.fact).toBeDefined();
  });

  describe('execute', () => {
    it('should create section and save a fact if file does not exist', async () => {
      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' }); // Simulate file not found
      const params = { fact: 'The sky is blue' };
      await memoryTool.execute(params, mockAbortSignal);

      const expectedFilePath = path.join('/mock/home', '.gemini', 'GEMINI.md');
      expect(fs.mkdir).toHaveBeenCalledWith(path.dirname(expectedFilePath), {
        recursive: true,
      });
      expect(fs.writeFile).toHaveBeenCalledOnce();

      const writeFileCall = vi.mocked(fs.writeFile).mock.calls[0];
      expect(writeFileCall[0]).toBe(expectedFilePath);
      const expectedContent = `${MEMORY_SECTION_HEADER}\n- ${params.fact}\n`; // Removed leading \n
      expect(writeFileCall[1]).toBe(expectedContent);
      expect(writeFileCall[2]).toBe('utf-8');
    });

    it('should create section and save a fact if file is empty', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(''); // Simulate empty file
      const params = { fact: 'The sky is blue' };
      await memoryTool.execute(params, mockAbortSignal);

      const writeFileCall = vi.mocked(fs.writeFile).mock.calls[0];
      const expectedContent = `${MEMORY_SECTION_HEADER}\n- ${params.fact}\n`; // No leading \n\n because ensureNewlineSeparation returns '' for empty content
      expect(writeFileCall[1]).toBe(expectedContent);
    });

    it('should add a fact to an existing section', async () => {
      const initialContent = `Some preamble.\n\n${MEMORY_SECTION_HEADER}\n- Existing fact 1\n`;
      vi.mocked(fs.readFile).mockResolvedValue(initialContent);
      const params = { fact: 'New fact 2' };
      await memoryTool.execute(params, mockAbortSignal);

      expect(fs.writeFile).toHaveBeenCalledOnce();
      const writeFileCall = vi.mocked(fs.writeFile).mock.calls[0];
      const expectedContent = `Some preamble.\n\n${MEMORY_SECTION_HEADER}\n- Existing fact 1\n- ${params.fact}\n`;
      expect(writeFileCall[1]).toBe(expectedContent);
    });

    it('should add a fact to an existing empty section', async () => {
      const initialContent = `Some preamble.\n\n${MEMORY_SECTION_HEADER}\n`; // Empty section
      vi.mocked(fs.readFile).mockResolvedValue(initialContent);
      const params = { fact: 'First fact in section' };
      await memoryTool.execute(params, mockAbortSignal);

      expect(fs.writeFile).toHaveBeenCalledOnce();
      const writeFileCall = vi.mocked(fs.writeFile).mock.calls[0];
      const expectedContent = `Some preamble.\n\n${MEMORY_SECTION_HEADER}\n- ${params.fact}\n`;
      expect(writeFileCall[1]).toBe(expectedContent);
    });

    it('should add a fact when other ## sections exist', async () => {
      const initialContent = `${MEMORY_SECTION_HEADER}\n- Fact 1\n\n## Another Section\nSome other text.`;
      vi.mocked(fs.readFile).mockResolvedValue(initialContent);
      const params = { fact: 'Fact 2' };
      await memoryTool.execute(params, mockAbortSignal);

      expect(fs.writeFile).toHaveBeenCalledOnce();
      const writeFileCall = vi.mocked(fs.writeFile).mock.calls[0];
      const expectedContent = `${MEMORY_SECTION_HEADER}\n- Fact 1\n- ${params.fact}\n\n## Another Section\nSome other text.\n`; // Added trailing \n
      expect(writeFileCall[1]).toBe(expectedContent);
    });

    it('should return an error if fact is empty', async () => {
      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });
      const params = { fact: ' ' }; // Empty fact
      const result = await memoryTool.execute(params, mockAbortSignal);
      const errorMessage = 'Parameter "fact" must be a non-empty string.';

      expect(result.llmContent).toBe(
        JSON.stringify({ success: false, error: errorMessage }),
      );
      expect(result.returnDisplay).toBe(`Error: ${errorMessage}`);
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle errors from fs.writeFile', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(''); // File exists but empty
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Disk full'));
      const params = { fact: 'This will fail' };
      const result = await memoryTool.execute(params, mockAbortSignal);

      const expectedErrorDetail =
        '[MemoryTool] Failed to add memory entry: Disk full';
      expect(result.llmContent).toBe(
        JSON.stringify({
          success: false,
          error: `Failed to save memory. Detail: ${expectedErrorDetail}`,
        }),
      );
      expect(result.returnDisplay).toBe(
        `Error saving memory: ${expectedErrorDetail}`,
      );
    });
  });
});
