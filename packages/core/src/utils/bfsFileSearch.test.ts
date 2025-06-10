/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import * as gitUtils from './gitUtils.js';
import { bfsFileSearch } from './bfsFileSearch.js';

vi.mock('fs/promises');
vi.mock('./gitUtils.js');

describe('bfsFileSearch', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should find a file in the root directory', async () => {
    const mockFs = vi.mocked(fs);
    mockFs.readdir.mockResolvedValue([
      { name: 'file1.txt', isFile: () => true, isDirectory: () => false },
      { name: 'file2.txt', isFile: () => true, isDirectory: () => false },
    ] as any);

    const result = await bfsFileSearch('/test', { fileName: 'file1.txt' });
    expect(result).toEqual(['/test/file1.txt']);
  });

  it('should find a file in a subdirectory', async () => {
    const mockFs = vi.mocked(fs);
    mockFs.readdir.mockImplementation(async (dir) => {
      if (dir === '/test') {
        return [
          { name: 'subdir', isFile: () => false, isDirectory: () => true },
        ] as any;
      }
      if (dir === '/test/subdir') {
        return [
          { name: 'file1.txt', isFile: () => true, isDirectory: () => false },
        ] as any;
      }
      return [];
    });

    const result = await bfsFileSearch('/test', { fileName: 'file1.txt' });
    expect(result).toEqual(['/test/subdir/file1.txt']);
  });

  it('should ignore specified directories', async () => {
    const mockFs = vi.mocked(fs);
    mockFs.readdir.mockImplementation(async (dir) => {
      if (dir === '/test') {
        return [
          { name: 'subdir1', isFile: () => false, isDirectory: () => true },
          { name: 'subdir2', isFile: () => false, isDirectory: () => true },
        ] as any;
      }
      if (dir === '/test/subdir1') {
        return [
          { name: 'file1.txt', isFile: () => true, isDirectory: () => false },
        ] as any;
      }
      if (dir === '/test/subdir2') {
        return [
          { name: 'file1.txt', isFile: () => true, isDirectory: () => false },
        ] as any;
      }
      return [];
    });

    const result = await bfsFileSearch('/test', {
      fileName: 'file1.txt',
      ignoreDirs: ['subdir2'],
    });
    expect(result).toEqual(['/test/subdir1/file1.txt']);
  });

  it('should respect maxDirs limit', async () => {
    const mockFs = vi.mocked(fs);
    mockFs.readdir.mockImplementation(async (dir) => {
      if (dir === '/test') {
        return [
          { name: 'subdir1', isFile: () => false, isDirectory: () => true },
          { name: 'subdir2', isFile: () => false, isDirectory: () => true },
        ] as any;
      }
      if (dir === '/test/subdir1') {
        return [
          { name: 'file1.txt', isFile: () => true, isDirectory: () => false },
        ] as any;
      }
      if (dir === '/test/subdir2') {
        return [
          { name: 'file1.txt', isFile: () => true, isDirectory: () => false },
        ] as any;
      }
      return [];
    });

    const result = await bfsFileSearch('/test', {
      fileName: 'file1.txt',
      maxDirs: 2,
    });
    expect(result).toEqual(['/test/subdir1/file1.txt']);
  });

  it('should respect .gitignore files', async () => {
    const mockFs = vi.mocked(fs);
    const mockGitUtils = vi.mocked(gitUtils);
    mockGitUtils.isGitRepository.mockReturnValue(true);
    mockFs.readdir.mockImplementation(async (dir) => {
      if (dir === '/test') {
        return [
          { name: '.gitignore', isFile: () => true, isDirectory: () => false },
          { name: 'subdir1', isFile: () => false, isDirectory: () => true },
          { name: 'subdir2', isFile: () => false, isDirectory: () => true },
        ] as any;
      }
      if (dir === '/test/subdir1') {
        return [
          { name: 'file1.txt', isFile: () => true, isDirectory: () => false },
        ] as any;
      }
      if (dir === '/test/subdir2') {
        return [
          { name: 'file1.txt', isFile: () => true, isDirectory: () => false },
        ] as any;
      }
      return [];
    });
    mockFs.readFile.mockResolvedValue('subdir2');

    const result = await bfsFileSearch('/test', {
      fileName: 'file1.txt',
      respectGitIgnore: true,
    });
    expect(result).toEqual(['/test/subdir1/file1.txt']);
  });
});
