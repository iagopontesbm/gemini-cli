import { renderHook, act } from '@testing-library/react';
import { useInput } from 'ink';
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { useInputNavigation } from './useInputNavigation.js';
import type { Key } from 'ink';

// Mock ink's useInput hook
vi.mock('ink', async (importOriginal) => {
  const originalInk = await importOriginal<typeof import('ink')>();
  return {
    ...originalInk,
    useInput: vi.fn(),
  };
});

describe('useInputNavigation Hook', () => {
  let capturedUseInputCallback: (input: string, key: Key) => void;
  let mockSetQuery: ReturnType<typeof vi.fn>;
  let mockSetHistoryIndex: ReturnType<typeof vi.fn>;
  let mockSetOriginalQueryBeforeNav: ReturnType<typeof vi.fn>;

  const userMessages = ['first message', 'second message'];

  // Default Key object with all keys false/undefined
  const baseKey: Key = {
    upArrow: false,
    downArrow: false,
    leftArrow: false,
    rightArrow: false,
    pageDown: false,
    pageUp: false,
    return: false,
    escape: false,
    ctrl: false,
    shift: false,
    tab: false,
    backspace: false,
    delete: false,
    meta: false,
  };

  // Helper to setup the hook with initial props
  const setupHook = (initialProps: Partial<Parameters<typeof useInputNavigation>[0]> = {}) => {
    mockSetQuery = vi.fn();
    mockSetHistoryIndex = vi.fn();
    mockSetOriginalQueryBeforeNav = vi.fn();

    // Capture the callback passed to useInput
    (useInput as ReturnType<typeof vi.fn>).mockImplementation((callback) => {
      capturedUseInputCallback = callback;
    });

    const defaultProps = {
      isInputActive: true,
      isWaitingForToolConfirmation: false,
      userMessages: userMessages,
      query: '',
      setQuery: mockSetQuery,
      historyIndex: -1,
      setHistoryIndex: mockSetHistoryIndex,
      originalQueryBeforeNav: '',
      setOriginalQueryBeforeNav: mockSetOriginalQueryBeforeNav,
      ...initialProps,
    };

    return renderHook(() => useInputNavigation(defaultProps));
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('up arrow should set query to last message and update index', () => {
    setupHook();
    act(() => {
      capturedUseInputCallback('', { ...baseKey, upArrow: true });
    });
    expect(mockSetOriginalQueryBeforeNav).toHaveBeenCalledWith('');
    expect(mockSetHistoryIndex).toHaveBeenCalledWith(0);
    expect(mockSetQuery).toHaveBeenCalledWith('second message');
  });

  test('multiple up arrows should navigate history', () => {
    setupHook({ historyIndex: 0, query: 'second message' });
    act(() => {
      capturedUseInputCallback('', { ...baseKey, upArrow: true });
    });
    expect(mockSetOriginalQueryBeforeNav).not.toHaveBeenCalled();
    expect(mockSetHistoryIndex).toHaveBeenCalledWith(1);
    expect(mockSetQuery).toHaveBeenCalledWith('first message');
  });

   test('down arrow should navigate back', () => {
    setupHook({ historyIndex: 1, query: 'first message' });
    act(() => {
      capturedUseInputCallback('', { ...baseKey, downArrow: true });
    });
    expect(mockSetHistoryIndex).toHaveBeenCalledWith(0);
    expect(mockSetQuery).toHaveBeenCalledWith('second message');
  });

  test('down arrow from start should restore original query', () => {
    const originalQuery = 'original typed query';
    setupHook({ historyIndex: 0, query: 'second message', originalQueryBeforeNav: originalQuery });
    act(() => {
      capturedUseInputCallback('', { ...baseKey, downArrow: true });
    });
    expect(mockSetHistoryIndex).toHaveBeenCalledWith(-1);
    expect(mockSetQuery).toHaveBeenCalledWith(originalQuery);
  });

  test('typing text while navigating should reset history index', () => {
    setupHook({ historyIndex: 0, query: 'second message' });
    act(() => {
      // Simulate typing 'a' - needs a complete Key object
      capturedUseInputCallback('a', { ...baseKey });
    });
    expect(mockSetHistoryIndex).toHaveBeenCalledWith(-1);
    expect(mockSetOriginalQueryBeforeNav).toHaveBeenCalledWith('');
  });
}); 