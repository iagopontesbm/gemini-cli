/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Mocked } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCompletion } from './useCompletion.js';
import * as fs from 'fs/promises';
import { FileDiscoveryService } from '@gemini-cli/core';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('@gemini-cli/core', async () => {
  const actual = await vi.importActual('@gemini-cli/core');
  return {
    ...actual,
    FileDiscoveryService: vi.fn(),
    isNodeError: vi.fn((error) => error.code === 'ENOENT'),
    escapePath: vi.fn((path) => path),
    unescapePath: vi.fn((path) => path),
    getErrorMessage: vi.fn((error) => error.message),
  };
});

describe('useCompletion git-aware filtering integration', () => {
  let mockFileDiscoveryService: Mocked<FileDiscoveryService>;
  let mockConfig: {
    fileFiltering?: { enabled?: boolean; respectGitignore?: boolean };
  };
  const testCwd = '/test/project';
  const slashCommands = [
    { name: 'help', description: 'Show help', action: vi.fn() },
    { name: 'clear', description: 'Clear screen', action: vi.fn() },
  ];

  beforeEach(() => {
    mockFileDiscoveryService = {
      initialize: vi.fn(),
      shouldIgnoreFile: vi.fn(),
      filterFiles: vi.fn(),
      getIgnoreInfo: vi.fn(() => ({ gitIgnored: [] })),
      glob: vi.fn().mockResolvedValue([]),
    };

    mockConfig = {
      getFileFilteringRespectGitIgnore: vi.fn(() => true),
      getFileService: vi.fn().mockResolvedValue(mockFileDiscoveryService),
    };

    vi.mocked(FileDiscoveryService).mockImplementation(
      () => mockFileDiscoveryService,
    );
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should filter git-ignored directories from @ completions', async () => {
    // Mock fs.readdir to return both regular and git-ignored directories
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: 'src', isDirectory: () => true },
      { name: 'node_modules', isDirectory: () => true },
      { name: 'dist', isDirectory: () => true },
      { name: 'README.md', isDirectory: () => false },
      { name: '.env', isDirectory: () => false },
    ] as Array<{ name: string; isDirectory: () => boolean }>);

    // Mock git ignore service to ignore certain files
    mockFileDiscoveryService.shouldIgnoreFile.mockImplementation(
      (path: string) =>
        path.includes('node_modules') ||
        path.includes('dist') ||
        path.includes('.env'),
    );

    const { result } = renderHook(() =>
      useCompletion('@', testCwd, true, slashCommands, mockConfig),
    );

    // Wait for async operations to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150)); // Account for debounce
    });

    expect(result.current.suggestions).toHaveLength(2);
    expect(result.current.suggestions).toEqual(
      expect.arrayContaining([
        { label: 'src/', value: 'src/', autoSubmit: true },
        { label: 'README.md', value: 'README.md', autoSubmit: true },
      ]),
    );
    expect(result.current.showSuggestions).toBe(true);
  });

  it('should handle recursive search with git-aware filtering', async () => {
    // Mock the recursive file search scenario
    vi.mocked(fs.readdir).mockImplementation(
      async (dirPath: string | Buffer | URL) => {
        if (dirPath === testCwd) {
          return [
            { name: 'src', isDirectory: () => true },
            { name: 'node_modules', isDirectory: () => true },
            { name: 'temp', isDirectory: () => true },
          ] as Array<{ name: string; isDirectory: () => boolean }>;
        }
        if (dirPath.endsWith('/src')) {
          return [
            { name: 'index.ts', isDirectory: () => false },
            { name: 'components', isDirectory: () => true },
          ] as Array<{ name: string; isDirectory: () => boolean }>;
        }
        if (dirPath.endsWith('/temp')) {
          return [{ name: 'temp.log', isDirectory: () => false }] as Array<{
            name: string;
            isDirectory: () => boolean;
          }>;
        }
        return [] as Array<{ name: string; isDirectory: () => boolean }>;
      },
    );

    // Mock git ignore service
    mockFileDiscoveryService.shouldIgnoreFile.mockImplementation(
      (path: string) => path.includes('node_modules') || path.includes('temp'),
    );

    const { result } = renderHook(() =>
      useCompletion('@t', testCwd, true, slashCommands, mockConfig),
    );

    // Wait for async operations to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    // Should not include anything from node_modules or dist
    const suggestionLabels = result.current.suggestions.map((s) => s.label);
    expect(suggestionLabels).not.toContain('temp/');
    expect(suggestionLabels.some((l) => l.includes('node_modules'))).toBe(
      false,
    );
  });

  it('should work without config (fallback behavior)', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: 'src', isDirectory: () => true },
      { name: 'node_modules', isDirectory: () => true },
      { name: 'README.md', isDirectory: () => false },
    ] as Array<{ name: string; isDirectory: () => boolean }>);

    const { result } = renderHook(() =>
      useCompletion('@', testCwd, true, slashCommands, undefined),
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    // Without config, should include all files
    expect(result.current.suggestions).toHaveLength(3);
    expect(result.current.suggestions).toEqual(
      expect.arrayContaining([
        { label: 'src/', value: 'src/', autoSubmit: true },
        { label: 'node_modules/', value: 'node_modules/', autoSubmit: true },
        { label: 'README.md', value: 'README.md', autoSubmit: true },
      ]),
    );
  });

  it('should handle git discovery service initialization failure gracefully', async () => {
    mockFileDiscoveryService.initialize.mockRejectedValue(
      new Error('Git not found'),
    );

    vi.mocked(fs.readdir).mockResolvedValue([
      { name: 'src', isDirectory: () => true },
      { name: 'README.md', isDirectory: () => false },
    ] as Array<{ name: string; isDirectory: () => boolean }>);

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() =>
      useCompletion('@', testCwd, true, slashCommands, mockConfig),
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    // Since we use centralized service, initialization errors are handled at config level
    // This test should verify graceful fallback behavior
    expect(result.current.suggestions.length).toBeGreaterThanOrEqual(0);
    // Should still show completions even if git discovery fails
    expect(result.current.suggestions.length).toBeGreaterThan(0);

    consoleSpy.mockRestore();
  });

  describe('User Tools Completion', () => {
    const mockUserTools = new Map([
      [
        'git-log',
        {
          name: 'git-log',
          description: 'Show git commit history',
          content: 'Show git log',
          filePath: '/test/git-log.md',
        },
      ],
      [
        'find-math-book',
        {
          name: 'find-math-book',
          description: 'Get a random math book recommendation',
          content: 'Recommend a book',
          filePath: '/test/find-math-book.md',
        },
      ],
      [
        'largest-files',
        {
          name: 'largest-files',
          description: 'Find the largest files in the project',
          content: 'Find large files',
          filePath: '/test/largest-files.md',
        },
      ],
    ]);

    it('should suggest user tools when typing /user-', async () => {
      const { result } = renderHook(() =>
        useCompletion(
          '/user-',
          testCwd,
          true,
          slashCommands,
          mockConfig,
          mockUserTools,
        ),
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      expect(result.current.suggestions).toContainEqual(
        expect.objectContaining({
          label: 'user-git-log',
          value: 'user-git-log',
          description: 'Show git commit history',
        }),
      );
      expect(result.current.suggestions).toContainEqual(
        expect.objectContaining({
          label: 'user-find-math-book',
          value: 'user-find-math-book',
          description: 'Get a random math book recommendation',
        }),
      );
      expect(result.current.suggestions).toContainEqual(
        expect.objectContaining({
          label: 'user-largest-files',
          value: 'user-largest-files',
          description: 'Find the largest files in the project',
        }),
      );
    });

    it('should filter user tools based on partial match', async () => {
      const { result } = renderHook(() =>
        useCompletion(
          '/user-git',
          testCwd,
          true,
          slashCommands,
          mockConfig,
          mockUserTools,
        ),
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      expect(result.current.suggestions).toHaveLength(1);
      expect(result.current.suggestions[0]).toEqual({
        label: 'user-git-log',
        value: 'user-git-log',
        description: 'Show git commit history',
        autoSubmit: false,
      });
    });

    it('should suggest all matching user tools for partial command', async () => {
      const { result } = renderHook(() =>
        useCompletion(
          '/use',
          testCwd,
          true,
          slashCommands,
          mockConfig,
          mockUserTools,
        ),
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      // Should suggest all user tools that start with 'user-'
      const userToolSuggestions = result.current.suggestions.filter((s) =>
        s.value.startsWith('user-'),
      );
      expect(userToolSuggestions).toHaveLength(3);
    });

    it('should show no user tool suggestions when no tools match', async () => {
      const { result } = renderHook(() =>
        useCompletion(
          '/user-xyz',
          testCwd,
          true,
          slashCommands,
          mockConfig,
          mockUserTools,
        ),
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      expect(result.current.suggestions).toHaveLength(0);
    });

    it('should provide default description for tools without description', async () => {
      const toolsWithoutDesc = new Map([
        [
          'no-desc',
          {
            name: 'no-desc',
            description: '',
            content: 'Content',
            filePath: '/test/no-desc.md',
          },
        ],
      ]);

      const { result } = renderHook(() =>
        useCompletion(
          '/user-no',
          testCwd,
          true,
          slashCommands,
          mockConfig,
          toolsWithoutDesc,
        ),
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      expect(result.current.suggestions).toContainEqual(
        expect.objectContaining({
          label: 'user-no-desc',
          value: 'user-no-desc',
          description: 'User-defined tool: no-desc',
        }),
      );
    });
  });

  it('should handle directory-specific completions with git filtering', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { name: 'component.tsx', isDirectory: () => false },
      { name: 'temp.log', isDirectory: () => false },
      { name: 'index.ts', isDirectory: () => false },
    ] as Array<{ name: string; isDirectory: () => boolean }>);

    mockFileDiscoveryService.shouldIgnoreFile.mockImplementation(
      (path: string) => path.includes('.log'),
    );

    const { result } = renderHook(() =>
      useCompletion('@src/comp', testCwd, true, slashCommands, mockConfig),
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    // Should filter out .log files but include matching .tsx files
    expect(result.current.suggestions).toEqual([
      { label: 'component.tsx', value: 'component.tsx', autoSubmit: true },
    ]);
  });

  it('should use glob for top-level @ completions when available', async () => {
    const globResults = [`${testCwd}/src/index.ts`, `${testCwd}/README.md`];
    mockFileDiscoveryService.glob.mockResolvedValue(globResults);

    const { result } = renderHook(() =>
      useCompletion('@s', testCwd, true, slashCommands, mockConfig),
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    expect(mockFileDiscoveryService.glob).toHaveBeenCalledWith('**/s*', {
      cwd: testCwd,
      dot: false,
    });
    expect(fs.readdir).not.toHaveBeenCalled(); // Ensure glob is used instead of readdir
    expect(result.current.suggestions).toEqual([
      { label: 'README.md', value: 'README.md' },
      { label: 'src/index.ts', value: 'src/index.ts' },
    ]);
  });

  it('should include dotfiles in glob search when input starts with a dot', async () => {
    const globResults = [
      `${testCwd}/.env`,
      `${testCwd}/.gitignore`,
      `${testCwd}/src/index.ts`,
    ];
    mockFileDiscoveryService.glob.mockResolvedValue(globResults);

    const { result } = renderHook(() =>
      useCompletion('@.', testCwd, true, slashCommands, mockConfig),
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    expect(mockFileDiscoveryService.glob).toHaveBeenCalledWith('**/.*', {
      cwd: testCwd,
      dot: true,
    });
    expect(fs.readdir).not.toHaveBeenCalled();
    expect(result.current.suggestions).toEqual([
      { label: '.env', value: '.env' },
      { label: '.gitignore', value: '.gitignore' },
      { label: 'src/index.ts', value: 'src/index.ts' },
    ]);
  });
});
