/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { Dirent as FSDirent } from 'fs';
import { getFolderStructure } from './getFolderStructure.js';
import { FileDiscoveryService } from '../services/fileDiscoveryService.js';

// Mock dependencies
vi.mock('../services/fileDiscoveryService.js');
vi.mock('fs/promises');

vi.mock('path', async (importOriginal) => {
  const original = (await importOriginal()) as typeof import('path');
  return {
    ...original,
    resolve: vi.fn((str) => str),
  };
});

// Import mocked modules
import * as path from 'path';
import * as fsPromises from 'fs/promises';
import * as fs from 'fs';

// Mock FileDiscoveryService class
class MockFileDiscoveryService {
  shouldGitIgnoreFile = vi.fn();
  shouldGeminiIgnoreFile = vi.fn();
  filterFiles = vi.fn();
  getGeminiIgnorePatterns = vi.fn();
// Removed unused private methods gitIgnoreFilter and geminiIgnoreFilter
  projectRoot = '/testroot';
}

// Helper to create Dirent-like objects for mocking fs.readdir
const createDirent = (name: string, type: 'file' | 'dir'): FSDirent => ({
  name,
  isFile: () => type === 'file',
  isDirectory: () => type === 'dir',
  isBlockDevice: () => false,
  isCharacterDevice: () => false,
  isSymbolicLink: () => false,
  isFIFO: () => false,
  isSocket: () => false,
  path: '',
  parentPath: '',
});

describe('getFolderStructure gitignore', () => {
  let mockFileDiscoveryService: MockFileDiscoveryService;

  beforeEach(() => {
    vi.resetAllMocks();
    
    // Create a new mock instance for this test
    mockFileDiscoveryService = new MockFileDiscoveryService();
    
    // Mock FileDiscoveryService constructor to return our mock
    vi.mocked(FileDiscoveryService).mockImplementation(() => mockFileDiscoveryService as any);
    
    (path.resolve as Mock).mockImplementation((str: string) => str);

    (fsPromises.readdir as Mock).mockImplementation(async (p) => {
      const dirPath = p.toString();
      if (dirPath === '/testroot') {
        return [
          createDirent('file1.txt', 'file'),
          createDirent('ignored.txt', 'file'),
          createDirent('.gemini', 'dir'),
        ];
      }
      if (dirPath === '/testroot/.gemini') {
        return [createDirent('logs.json', 'file')];
      }
      return [];
    });

    (fs.readFileSync as Mock).mockImplementation((filePath: string) => {
      if (filePath.endsWith('.gitignore')) {
        return 'ignored.txt\n.gemini/logs.json';
      }
      return '';
    });

    (fs.existsSync as Mock).mockReturnValue(true);

    // Configure the mock to ignore specific files
    mockFileDiscoveryService.shouldGitIgnoreFile.mockImplementation((filePath: string) => filePath.includes('ignored.txt') || filePath.includes('.gemini/logs.json'));
  });

  it('should ignore files and folders specified in .gitignore', async () => {
    const structure = await getFolderStructure('/testroot', {
      respectGitIgnore: true,
      fileService: mockFileDiscoveryService as any,
    });



    expect(structure).not.toContain('ignored.txt');
    expect(structure).not.toContain('.gemini/logs.json');
    expect(structure).toContain('file1.txt');
  });

  it('should not ignore files if respectGitIgnore is false', async () => {
    // Override the mock for this specific test
    mockFileDiscoveryService.shouldGitIgnoreFile.mockReturnValue(false);
    
    const structure = await getFolderStructure('/testroot', {
      respectGitIgnore: false,
    });

    expect(structure).toContain('ignored.txt');
    expect(structure).toContain('file1.txt');
  });
});