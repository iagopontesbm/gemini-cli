/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { act, renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest'; // Added Mock
import { useSlashCommandProcessor } from './slashCommandProcessor.js';
import { MessageType } from '../types.js';
import * as memoryUtils from '../../config/memoryUtils.js';

// Import the module for mocking its functions
import * as ShowMemoryCommandModule from './useShowMemoryCommand.js';
// import { REFRESH_MEMORY_COMMAND_NAME } from './useRefreshMemoryCommand.js'; // Removed as per lint

// Mock dependencies
vi.mock('../../config/memoryUtils.js');

vi.mock('./useShowMemoryCommand.js', () => ({
  SHOW_MEMORY_COMMAND_NAME: '/showmemory', // Actual value for the processor to use
  createShowMemoryAction: vi.fn(() => vi.fn()),
}));

const mockProcessExit = vi.fn((_code?: number): never => undefined as never);
vi.mock('node:process', () => ({
  exit: mockProcessExit,
}));

describe('useSlashCommandProcessor', () => {
  let mockAddItem: ReturnType<typeof vi.fn>;
  let mockClearItems: ReturnType<typeof vi.fn>;
  let mockRefreshStatic: ReturnType<typeof vi.fn>;
  let mockSetShowHelp: ReturnType<typeof vi.fn>;
  let mockOnDebugMessage: ReturnType<typeof vi.fn>;
  let mockOpenThemeDialog: ReturnType<typeof vi.fn>;
  let mockPerformMemoryRefresh: ReturnType<typeof vi.fn>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockConfig: any;

  beforeEach(() => {
    mockAddItem = vi.fn();
    mockClearItems = vi.fn();
    mockRefreshStatic = vi.fn();
    mockSetShowHelp = vi.fn();
    mockOnDebugMessage = vi.fn();
    mockOpenThemeDialog = vi.fn();
    mockPerformMemoryRefresh = vi.fn().mockResolvedValue(undefined);
    mockConfig = { getDebugMode: vi.fn(() => false) };

    vi.mocked(memoryUtils.addMemoryEntry).mockClear();
    vi.mocked(memoryUtils.deleteLastMemoryEntry).mockClear();
    vi.mocked(memoryUtils.deleteAllAddedMemoryEntries).mockClear();
    mockProcessExit.mockClear();
    // Access the mocked function via the module namespace
    (ShowMemoryCommandModule.createShowMemoryAction as Mock).mockClear();
    mockPerformMemoryRefresh.mockClear(); // mockPerformMemoryRefresh is already a vi.fn()

    const results = vi.mocked(ShowMemoryCommandModule.createShowMemoryAction)
      .mock.results;
    if (results && results.length > 0 && results[0].type === 'return') {
      const returnedMock = results[0].value as Mock;
      if (returnedMock && typeof returnedMock.mockClear === 'function') {
        returnedMock.mockClear();
      }
    }
  });

  // No afterEach with vi.clearAllMocks()

  const getProcessor = () => {
    const { result } = renderHook(() =>
      useSlashCommandProcessor(
        mockConfig,
        mockAddItem,
        mockClearItems,
        mockRefreshStatic,
        mockSetShowHelp,
        mockOnDebugMessage,
        mockOpenThemeDialog,
        mockPerformMemoryRefresh,
      ),
    );
    return result.current;
  };

  describe('/memory add', () => {
    it('should call addMemoryEntry and refresh on valid input', async () => {
      vi.mocked(memoryUtils.addMemoryEntry).mockResolvedValue(undefined);
      const { handleSlashCommand } = getProcessor();
      await act(async () => {
        handleSlashCommand('/memory add Remember this fact');
      });
      expect(mockAddItem).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          type: MessageType.USER,
          text: '/memory add Remember this fact',
        }),
        expect.any(Number),
      );
      expect(memoryUtils.addMemoryEntry).toHaveBeenCalledWith(
        'Remember this fact',
      );
      expect(mockPerformMemoryRefresh).toHaveBeenCalled();
      expect(mockAddItem).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          type: MessageType.INFO,
          text: 'Successfully added to memory: "Remember this fact"',
        }),
        expect.any(Number),
      );
    });

    it('should show usage error if no text is provided', async () => {
      const { handleSlashCommand } = getProcessor();
      await act(async () => {
        handleSlashCommand('/memory add ');
      });
      expect(memoryUtils.addMemoryEntry).not.toHaveBeenCalled();
      expect(mockAddItem).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          type: MessageType.ERROR,
          text: 'Usage: /memory add <text to remember>',
        }),
        expect.any(Number),
      );
    });

    it('should handle error from addMemoryEntry', async () => {
      vi.mocked(memoryUtils.addMemoryEntry).mockRejectedValue(
        new Error('Disk full'),
      );
      const { handleSlashCommand } = getProcessor();
      await act(async () => {
        handleSlashCommand('/memory add Another fact');
      });
      expect(memoryUtils.addMemoryEntry).toHaveBeenCalledWith('Another fact');
      expect(mockAddItem).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          type: MessageType.ERROR,
          text: 'Failed to add memory: Disk full',
        }),
        expect.any(Number),
      );
    });
  });

  describe('/memory delete_last', () => {
    it('should call deleteLastMemoryEntry and refresh if successful', async () => {
      vi.mocked(memoryUtils.deleteLastMemoryEntry).mockResolvedValue(true);
      const { handleSlashCommand } = getProcessor();
      await act(async () => {
        handleSlashCommand('/memory delete_last');
      });
      expect(memoryUtils.deleteLastMemoryEntry).toHaveBeenCalled();
      expect(mockPerformMemoryRefresh).toHaveBeenCalled();
      expect(mockAddItem).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          type: MessageType.INFO,
          text: 'Successfully deleted the last added memory entry.',
        }),
        expect.any(Number),
      );
    });

    it('should inform if no entry was found to delete', async () => {
      vi.mocked(memoryUtils.deleteLastMemoryEntry).mockResolvedValue(false);
      const { handleSlashCommand } = getProcessor();
      await act(async () => {
        handleSlashCommand('/memory delete_last');
      });
      expect(memoryUtils.deleteLastMemoryEntry).toHaveBeenCalled();
      expect(mockPerformMemoryRefresh).not.toHaveBeenCalled();
      expect(mockAddItem).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          type: MessageType.INFO,
          text: 'No added memory entries found to delete.',
        }),
        expect.any(Number),
      );
    });

    it('should handle errors from deleteLastMemoryEntry', async () => {
      vi.mocked(memoryUtils.deleteLastMemoryEntry).mockRejectedValue(
        new Error('File access error'),
      );
      const { handleSlashCommand } = getProcessor();
      await act(async () => {
        handleSlashCommand('/memory delete_last');
      });
      expect(mockAddItem).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          type: MessageType.ERROR,
          text: 'Failed to delete last memory entry: File access error',
        }),
        expect.any(Number),
      );
    });
  });

  describe('/memory delete_all_added', () => {
    it('should call deleteAllAddedMemoryEntries and refresh if successful', async () => {
      vi.mocked(memoryUtils.deleteAllAddedMemoryEntries).mockResolvedValue(3);
      const { handleSlashCommand } = getProcessor();
      await act(async () => {
        handleSlashCommand('/memory delete_all_added');
      });
      expect(memoryUtils.deleteAllAddedMemoryEntries).toHaveBeenCalled();
      expect(mockPerformMemoryRefresh).toHaveBeenCalled();
      expect(mockAddItem).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          type: MessageType.INFO,
          text: 'Successfully deleted 3 added memory entries.',
        }),
        expect.any(Number),
      );
    });

    it('should inform if no entries were found to delete', async () => {
      vi.mocked(memoryUtils.deleteAllAddedMemoryEntries).mockResolvedValue(0);
      const { handleSlashCommand } = getProcessor();
      await act(async () => {
        handleSlashCommand('/memory delete_all_added');
      });
      expect(memoryUtils.deleteAllAddedMemoryEntries).toHaveBeenCalled();
      expect(mockPerformMemoryRefresh).not.toHaveBeenCalled();
      expect(mockAddItem).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          type: MessageType.INFO,
          text: 'No added memory entries found to delete.',
        }),
        expect.any(Number),
      );
    });
  });

  describe('/memory show', () => {
    it('should call the showMemoryAction', async () => {
      const mockReturnedShowAction = vi.fn();
      vi.mocked(ShowMemoryCommandModule.createShowMemoryAction).mockReturnValue(
        mockReturnedShowAction,
      );
      const { handleSlashCommand } = getProcessor();
      await act(async () => {
        handleSlashCommand('/memory show');
      });
      expect(
        ShowMemoryCommandModule.createShowMemoryAction,
      ).toHaveBeenCalledWith(mockConfig, expect.any(Function));
      expect(mockReturnedShowAction).toHaveBeenCalled();
    });
  });

  describe('/memory refresh', () => {
    it('should call performMemoryRefresh', async () => {
      const { handleSlashCommand } = getProcessor();
      await act(async () => {
        handleSlashCommand('/memory refresh');
      });
      expect(mockPerformMemoryRefresh).toHaveBeenCalled();
    });
  });

  describe('Unknown /memory subcommand', () => {
    it('should show an error for unknown /memory subcommand', async () => {
      const { handleSlashCommand } = getProcessor();
      await act(async () => {
        handleSlashCommand('/memory foobar');
      });
      expect(mockAddItem).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          type: MessageType.ERROR,
          text: 'Unknown /memory command: foobar. Available: show, refresh, add, delete_last, delete_all_added',
        }),
        expect.any(Number),
      );
    });
  });

  describe('Other commands', () => {
    it('/help should open help', async () => {
      const { handleSlashCommand } = getProcessor();
      await act(async () => {
        handleSlashCommand('/help');
      });
      expect(mockSetShowHelp).toHaveBeenCalledWith(true);
    });
    // Removed /quit test
  });

  describe('Unknown command', () => {
    it('should show an error for a general unknown command', async () => {
      const { handleSlashCommand } = getProcessor();
      await act(async () => {
        handleSlashCommand('/unknowncommand');
      });
      expect(mockAddItem).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          type: MessageType.ERROR,
          text: 'Unknown command: /unknowncommand',
        }),
        expect.any(Number),
      );
    });
  });
});
