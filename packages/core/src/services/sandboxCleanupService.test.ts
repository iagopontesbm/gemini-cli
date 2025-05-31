/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SandboxCleanupService } from './sandboxCleanupService.js';
import { FileDiscoveryService } from './fileDiscoveryService.js';
import * as fs from 'fs/promises';
import fg from 'fast-glob';

// Mock dependencies
vi.mock('./fileDiscoveryService.js');
vi.mock('fs/promises');
vi.mock('fast-glob');

describe('SandboxCleanupService', () => {
  let service: SandboxCleanupService;
  let mockFileDiscoveryService: any;
  const mockProjectRoot = '/test/project';

  beforeEach(() => {
    mockFileDiscoveryService = {
      initialize: vi.fn(),
      shouldIgnoreFile: vi.fn(),
      filterFiles: vi.fn(),
      getIgnoreInfo: vi.fn(() => ({ gitIgnored: [], customIgnored: [] })),
    };
    
    vi.mocked(FileDiscoveryService).mockImplementation(() => mockFileDiscoveryService);
    
    service = new SandboxCleanupService(mockProjectRoot);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize file discovery service', async () => {
      await service.initialize();
      
      expect(FileDiscoveryService).toHaveBeenCalledWith(mockProjectRoot);
      expect(mockFileDiscoveryService.initialize).toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      mockFileDiscoveryService.initialize.mockRejectedValue(new Error('Init failed'));
      
      await expect(service.initialize()).rejects.toThrow('Init failed');
    });
  });

  describe('identifyFilesToClean', () => {
    beforeEach(async () => {
      await service.initialize();
      
      // Mock fg to return some test files
      vi.mocked(fg).mockResolvedValue([
        '/test/project/src/index.ts',
        '/test/project/node_modules/package.json',
        '/test/project/dist/bundle.js',
        '/test/project/.env',
        '/test/project/README.md',
      ]);
    });

    it('should identify git-ignored files for cleanup', async () => {
      mockFileDiscoveryService.shouldIgnoreFile.mockImplementation((path: string) => {
        return path.includes('node_modules') || path.includes('dist') || path.includes('.env');
      });

      const filesToClean = await service.identifyFilesToClean();

      expect(fg).toHaveBeenCalledWith(['**/*'], {
        cwd: mockProjectRoot,
        absolute: true,
        onlyFiles: true,
        dot: true,
        ignore: ['.git/**'],
      });

      expect(filesToClean).toEqual([
        '/test/project/node_modules/package.json',
        '/test/project/dist/bundle.js',
        '/test/project/.env',
      ]);
    });

    it('should not identify non-git-ignored files', async () => {
      mockFileDiscoveryService.shouldIgnoreFile.mockReturnValue(false);

      const filesToClean = await service.identifyFilesToClean();

      expect(filesToClean).toEqual([]);
    });

    it('should preserve files matching preserve patterns', async () => {
      mockFileDiscoveryService.shouldIgnoreFile.mockReturnValue(true);
      vi.mocked(fg).mockResolvedValue([
        '/test/project/important-config.env',
        '/test/project/temp-file.tmp',
      ]);

      const filesToClean = await service.identifyFilesToClean({
        preservePatterns: ['important-config'],
      });

      expect(filesToClean).toEqual(['/test/project/temp-file.tmp']);
    });

    it('should preserve critical files by default', async () => {
      mockFileDiscoveryService.shouldIgnoreFile.mockReturnValue(true);
      vi.mocked(fg).mockResolvedValue([
        '/test/project/.env.example',
        '/test/project/README.md',
        '/test/project/LICENSE',
        '/test/project/temp.log',
      ]);

      const filesToClean = await service.identifyFilesToClean();

      expect(filesToClean).toEqual(['/test/project/temp.log']);
    });

    it('should allow removing critical files in aggressive mode', async () => {
      mockFileDiscoveryService.shouldIgnoreFile.mockReturnValue(true);
      vi.mocked(fg).mockResolvedValue([
        '/test/project/.env.example',
        '/test/project/README.md',
        '/test/project/temp.log',
      ]);

      const filesToClean = await service.identifyFilesToClean({
        aggressiveCleanup: true,
      });

      expect(filesToClean).toEqual([
        '/test/project/.env.example',
        '/test/project/README.md',
        '/test/project/temp.log',
      ]);
    });

    it('should handle file discovery errors gracefully', async () => {
      vi.mocked(fg).mockRejectedValue(new Error('Glob failed'));

      await expect(service.identifyFilesToClean()).rejects.toThrow('Glob failed');
    });
  });

  describe('cleanupSandbox', () => {
    beforeEach(async () => {
      await service.initialize();
      mockFileDiscoveryService.shouldIgnoreFile.mockReturnValue(true);
    });

    it('should perform dry run without removing files', async () => {
      vi.mocked(fg).mockResolvedValue([
        '/test/project/temp1.log',
        '/test/project/temp2.log',
      ]);

      const result = await service.cleanupSandbox({ dryRun: true });

      expect(result.dryRun).toBe(true);
      expect(result.removedFiles).toEqual([
        '/test/project/temp1.log',
        '/test/project/temp2.log',
      ]);
      expect(result.errors).toEqual([]);
      expect(fs.unlink).not.toHaveBeenCalled();
    });

    it('should remove files when not in dry run mode', async () => {
      vi.mocked(fg).mockResolvedValue(['/test/project/temp.log']);
      vi.mocked(fs.unlink).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue([] as any);
      vi.mocked(fs.rmdir).mockResolvedValue(undefined);

      const result = await service.cleanupSandbox({ dryRun: false });

      expect(result.dryRun).toBe(false);
      expect(result.removedFiles).toEqual(['/test/project/temp.log']);
      expect(result.errors).toEqual([]);
      expect(fs.unlink).toHaveBeenCalledWith('/test/project/temp.log');
    });

    it('should handle file removal errors', async () => {
      vi.mocked(fg).mockResolvedValue(['/test/project/temp.log']);
      vi.mocked(fs.unlink).mockRejectedValue(new Error('Permission denied'));

      const result = await service.cleanupSandbox({ dryRun: false });

      expect(result.removedFiles).toEqual([]);
      expect(result.errors).toEqual([
        { file: '/test/project/temp.log', error: 'Permission denied' },
      ]);
    });

    it('should clean up empty directories after file removal', async () => {
      vi.mocked(fg).mockResolvedValue(['/test/project/subdir/temp.log']);
      vi.mocked(fs.unlink).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue([] as any);
      vi.mocked(fs.rmdir).mockResolvedValue(undefined);

      await service.cleanupSandbox({ dryRun: false });

      expect(fs.readdir).toHaveBeenCalledWith('/test/project/subdir');
      expect(fs.rmdir).toHaveBeenCalledWith('/test/project/subdir');
    });

    it('should not remove non-empty directories', async () => {
      vi.mocked(fg).mockResolvedValue(['/test/project/subdir/temp.log']);
      vi.mocked(fs.unlink).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockResolvedValue(['other-file.txt'] as any);

      await service.cleanupSandbox({ dryRun: false });

      expect(fs.readdir).toHaveBeenCalledWith('/test/project/subdir');
      expect(fs.rmdir).not.toHaveBeenCalled();
    });

    it('should not remove project root directory', async () => {
      vi.mocked(fg).mockResolvedValue(['/test/project/temp.log']);
      vi.mocked(fs.unlink).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockImplementation(async (dir) => {
        if (dir === '/test/project') return [] as any;
        return [] as any;
      });

      await service.cleanupSandbox({ dryRun: false });

      expect(fs.rmdir).not.toHaveBeenCalledWith('/test/project');
    });

    it('should handle directory cleanup errors gracefully', async () => {
      vi.mocked(fg).mockResolvedValue(['/test/project/subdir/temp.log']);
      vi.mocked(fs.unlink).mockResolvedValue(undefined);
      vi.mocked(fs.readdir).mockRejectedValue(new Error('Access denied'));

      const result = await service.cleanupSandbox({ dryRun: false });

      expect(result.removedFiles).toEqual(['/test/project/subdir/temp.log']);
      expect(result.errors).toEqual([]);
      // Directory cleanup errors should not affect the main operation
    });
  });

  describe('edge cases', () => {
    it('should handle empty file list', async () => {
      await service.initialize();
      vi.mocked(fg).mockResolvedValue([]);

      const filesToClean = await service.identifyFilesToClean();
      const result = await service.cleanupSandbox();

      expect(filesToClean).toEqual([]);
      expect(result.removedFiles).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it('should handle relative paths correctly', () => {
      const relativeService = new SandboxCleanupService('./relative/path');
      expect(relativeService).toBeInstanceOf(SandboxCleanupService);
    });

    it('should handle preserve patterns with various formats', async () => {
      await service.initialize();
      mockFileDiscoveryService.shouldIgnoreFile.mockReturnValue(true);
      vi.mocked(fg).mockResolvedValue([
        '/test/project/config/app.env',
        '/test/project/logs/app.log',
        '/test/project/temp/cache.tmp',
      ]);

      const filesToClean = await service.identifyFilesToClean({
        preservePatterns: ['config/', '.env', 'logs'],
      });

      expect(filesToClean).toEqual(['/test/project/temp/cache.tmp']);
    });
  });
});