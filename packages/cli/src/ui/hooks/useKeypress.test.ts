/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeypress, Key } from './useKeypress';
import { useStdin } from 'ink';
import readline from 'readline';

// Mock useStdin and stdin
vi.mock('ink', () => ({
  useStdin: vi.fn(),
}));

// Mock readline
vi.mock('readline', () => ({
  default: {
    createInterface: vi.fn(),
    emitKeypressEvents: vi.fn(),
  },
}));

describe('useKeypress Hook', () => {
  const mockStdin = {
    isTTY: true,
    writable: true,
    write: vi.fn(),
    prependListener: vi.fn(),
    removeListener: vi.fn(),
    emit: vi.fn(),
  };
  const mockSetRawMode = vi.fn();
  const mockRl = {
    close: vi.fn(),
  };
  let onKeypress: (key: Key) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    (useStdin as any).mockReturnValue({
      stdin: mockStdin,
      setRawMode: mockSetRawMode,
    });
    (readline.createInterface as any).mockReturnValue(mockRl);
    process.env.TERM = 'xterm';
    onKeypress = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('should initialize and clean up correctly', () => {
    const { unmount } = renderHook(() =>
      useKeypress(onKeypress, { isActive: true }),
    );

    expect(mockSetRawMode).toHaveBeenCalledWith(true);
    expect(mockStdin.write).toHaveBeenCalledWith('\x1b[?2004h');
    expect(readline.createInterface).toHaveBeenCalledWith({
      input: mockStdin,
    });

    act(() => {
      unmount();
    });

    expect(mockStdin.write).toHaveBeenCalledWith('\x1b[?2004l');
    expect(mockSetRawMode).toHaveBeenCalledWith(false);
    expect(mockRl.close).toHaveBeenCalled();
  });

  it('should handle single keypress', async () => {
    const { result } = renderHook(() =>
      useKeypress(onKeypress, { isActive: true }),
    );

    const keypressListener = mockStdin.prependListener.mock.calls.find(
      (call) => call[0] === 'keypress',
    )?.[1];

    expect(keypressListener).toBeDefined();

    act(() => {
      keypressListener(null, {
        name: 'a',
        ctrl: false,
        meta: false,
        shift: false,
        sequence: 'a',
      });
      vi.advanceTimersByTime(50); // Max input delay
    });

    expect(onKeypress).toHaveBeenCalledWith({
      name: 'a',
      ctrl: false,
      meta: false,
      shift: false,
      paste: false,
      sequence: 'a',
    });
  });

  it('should handle bracketed paste with valid content', async () => {
    const { result } = renderHook(() =>
      useKeypress(onKeypress, { isActive: true }),
    );

    const dataListener = mockStdin.prependListener.mock.calls.find(
      (call) => call[0] === 'data',
    )?.[1];

    expect(dataListener).toBeDefined();

    act(() => {
      dataListener(Buffer.from('\x1b[200~Hello, World!\x1b[201~'));
    });

    expect(onKeypress).toHaveBeenCalledWith({
      name: '',
      ctrl: false,
      meta: false,
      shift: false,
      paste: true,
      sequence: 'Hello, World!',
    });
  });

  it('should handle pasted content containing escape sequences', async () => {
    const { result } = renderHook(() =>
      useKeypress(onKeypress, { isActive: true }),
    );

    const dataListener = mockStdin.prependListener.mock.calls.find(
      (call) => call[0] === 'data',
    )?.[1];

    expect(dataListener).toBeDefined();

    const pastedContent = 'Text with \x1b[A escape';
    act(() => {
      dataListener(Buffer.from(`\x1b[200~${pastedContent}\x1b[201~`));
    });

    expect(onKeypress).toHaveBeenCalledWith({
      name: '',
      ctrl: false,
      meta: false,
      shift: false,
      paste: true,
      sequence: pastedContent,
    });
  });

  it('should handle unterminated paste with timeout', async () => {
    const { result } = renderHook(() =>
      useKeypress(onKeypress, { isActive: true }),
    );

    const dataListener = mockStdin.prependListener.mock.calls.find(
      (call) => call[0] === 'data',
    )?.[1];

    expect(dataListener).toBeDefined();

    act(() => {
      dataListener(Buffer.from('\x1b[200~Partial paste'));
      vi.advanceTimersByTime(1000); // Paste timeout duration
    });

    expect(onKeypress).toHaveBeenCalledWith({
      name: '',
      ctrl: false,
      meta: false,
      shift: false,
      paste: true,
      sequence: 'Partial paste',
    });
  });

  it('should handle rapid keypresses as paste without bracketed mode', async () => {
    const originalWrite = mockStdin.write;
    try {
      mockStdin.write = vi.fn((data) => {
        if (data === '\x1b[?2004h') {
          throw new Error('Bracketed paste not supported');
        }
        return originalWrite(data);
      });

      const { result } = renderHook(() =>
        useKeypress(onKeypress, { isActive: true }),
      );

      const keypressListener = mockStdin.prependListener.mock.calls.find(
        (call) => call[0] === 'keypress',
      )?.[1];

      expect(keypressListener).toBeDefined();

      act(() => {
        keypressListener(null, {
          name: 'h',
          ctrl: false,
          meta: false,
          shift: false,
          sequence: 'h',
        });
        keypressListener(null, {
          name: 'i',
          ctrl: false,
          meta: false,
          shift: false,
          sequence: 'i',
        });
        vi.advanceTimersByTime(50); // Max input delay
      });

      expect(onKeypress).toHaveBeenCalledWith({
        name: '',
        ctrl: false,
        meta: false,
        shift: false,
        paste: true,
        sequence: 'hi',
      });
    } finally {
      mockStdin.write = originalWrite; // Restore original implementation
    }
  });

  it('should ignore keypress events for multi-character paste after bracketed paste', async () => {
    const { result } = renderHook(() =>
      useKeypress(onKeypress, { isActive: true }),
    );

    const dataListener = mockStdin.prependListener.mock.calls.find(
      (call) => call[0] === 'data',
    )?.[1];
    const keypressListener = mockStdin.prependListener.mock.calls.find(
      (call) => call[0] === 'keypress',
    )?.[1];

    expect(dataListener).toBeDefined();
    expect(keypressListener).toBeDefined();

    const pastedContent = 'hello';

    act(() => {
      // Simulate bracketed paste via data event
      dataListener(Buffer.from(`\x1b[200~${pastedContent}\x1b[201~`));

      // Simulate readline emitting keypress events for each character
      for (const char of pastedContent) {
        keypressListener(null, {
          name: char,
          ctrl: false,
          meta: false,
          shift: false,
          sequence: char,
        });
      }
      vi.advanceTimersByTime(50); // Max input delay
    });

    // Verify paste is handled exactly once
    expect(onKeypress).toHaveBeenCalledTimes(1);
    expect(onKeypress).toHaveBeenCalledWith({
      name: '',
      ctrl: false,
      meta: false,
      shift: false,
      paste: true,
      sequence: pastedContent,
    });
  });

  it('should handle bracketed paste with nested paste-end marker', async () => {
    const { result } = renderHook(() =>
      useKeypress(onKeypress, { isActive: true }),
    );

    const dataListener = mockStdin.prependListener.mock.calls.find(
      (call) => call[0] === 'data',
    )?.[1];

    expect(dataListener).toBeDefined();

    act(() => {
      dataListener(Buffer.from('\x1b[200~text\x1b[201~more\x1b[201~'));
    });

    expect(onKeypress).toHaveBeenCalledWith({
      name: '',
      ctrl: false,
      meta: false,
      shift: false,
      paste: true,
      sequence: 'text',
    });

    expect(onKeypress).toHaveBeenCalledWith({
      name: '',
      ctrl: false,
      meta: false,
      shift: false,
      paste: true,
      sequence: 'more',
    });
  });

  it('should reset paste state on non-paste escape sequence', async () => {
    const { result } = renderHook(() =>
      useKeypress(onKeypress, { isActive: true }),
    );

    const dataListener = mockStdin.prependListener.mock.calls.find(
      (call) => call[0] === 'data',
    )?.[1];
    const keypressListener = mockStdin.prependListener.mock.calls.find(
      (call) => call[0] === 'keypress',
    )?.[1];

    expect(dataListener).toBeDefined();
    expect(keypressListener).toBeDefined();

    act(() => {
      dataListener(Buffer.from('\x1b[200~Partial paste'));
      dataListener(Buffer.from('\x1b[A'));
      vi.advanceTimersByTime(50); // Max input delay

      keypressListener(null, {
        name: 'up',
        ctrl: false,
        meta: false,
        shift: false,
        sequence: '\x1b[A',
      });
      vi.advanceTimersByTime(50); // Max input delay
    });

    expect(onKeypress).toHaveBeenCalledWith({
      name: '',
      ctrl: false,
      meta: false,
      shift: false,
      paste: true,
      sequence: 'Partial paste',
    });

    expect(onKeypress).toHaveBeenCalledWith({
      name: 'up',
      ctrl: false,
      meta: false,
      shift: false,
      paste: false,
      sequence: '\x1b[A',
    });
  });

  it('should handle multiple nested paste-end markers', async () => {
    const { result } = renderHook(() =>
      useKeypress(onKeypress, { isActive: true }),
    );

    const dataListener = mockStdin.prependListener.mock.calls.find(
      (call) => call[0] === 'data',
    )?.[1];

    expect(dataListener).toBeDefined();

    act(() => {
      dataListener(Buffer.from('\x1b[200~a\x1b[201~b\x1b[201~c\x1b[201~'));
    });

    expect(onKeypress).toHaveBeenCalledTimes(3);
    expect(onKeypress).toHaveBeenCalledWith({
      name: '',
      ctrl: false,
      meta: false,
      shift: false,
      paste: true,
      sequence: 'a',
    });
    expect(onKeypress).toHaveBeenCalledWith({
      name: '',
      ctrl: false,
      meta: false,
      shift: false,
      paste: true,
      sequence: 'b',
    });
    expect(onKeypress).toHaveBeenCalledWith({
      name: '',
      ctrl: false,
      meta: false,
      shift: false,
      paste: true,
      sequence: 'c',
    });
  });

  it('should handle partial paste markers', async () => {
    const { result } = renderHook(() =>
      useKeypress(onKeypress, { isActive: true }),
    );

    const dataListener = mockStdin.prependListener.mock.calls.find(
      (call) => call[0] === 'data',
    )?.[1];

    expect(dataListener).toBeDefined();

    act(() => {
      dataListener(Buffer.from('\x1b[200~text\x1b[201'));
      vi.advanceTimersByTime(1000); // Paste timeout duration
    });

    expect(onKeypress).toHaveBeenCalledWith({
      name: '',
      ctrl: false,
      meta: false,
      shift: false,
      paste: true,
      sequence: 'text\x1b[201',
    });

    act(() => {
      dataListener(Buffer.from('\x1b[200'));
      dataListener(Buffer.from('~more\x1b[201~'));
    });

    expect(onKeypress).toHaveBeenCalledWith({
      name: '',
      ctrl: false,
      meta: false,
      shift: false,
      paste: true,
      sequence: 'more',
    });
  });

  it('should handle keypress after bracketed paste', async () => {
    const { result } = renderHook(() =>
      useKeypress(onKeypress, { isActive: true }),
    );

    const dataListener = mockStdin.prependListener.mock.calls.find(
      (call) => call[0] === 'data',
    )?.[1];
    const keypressListener = mockStdin.prependListener.mock.calls.find(
      (call) => call[0] === 'keypress',
    )?.[1];

    expect(dataListener).toBeDefined();
    expect(keypressListener).toBeDefined();

    act(() => {
      // Simulate bracketed paste
      dataListener(Buffer.from('\x1b[200~hello\x1b[201~'));
      vi.advanceTimersByTime(50); // Ensure paste is processed
      // Simulate a subsequent keypress
      keypressListener(null, {
        name: 'a',
        ctrl: false,
        meta: false,
        shift: false,
        sequence: 'a',
      });
      vi.advanceTimersByTime(50); // Max input delay for keypress
    });

    // Expect paste event
    expect(onKeypress).toHaveBeenCalledWith({
      name: '',
      ctrl: false,
      meta: false,
      shift: false,
      paste: true,
      sequence: 'hello',
    });

    // Expect subsequent keypress to be processed
    expect(onKeypress).toHaveBeenCalledWith({
      name: 'a',
      ctrl: false,
      meta: false,
      shift: false,
      paste: false,
      sequence: 'a',
    });
  });

  it('should handle new paste within timeout of previous paste', async () => {
    const { result } = renderHook(() =>
      useKeypress(onKeypress, { isActive: true }),
    );

    const dataListener = mockStdin.prependListener.mock.calls.find(
      (call) => call[0] === 'data',
    )?.[1];

    expect(dataListener).toBeDefined();

    act(() => {
      dataListener(Buffer.from('\x1b[200~text\x1b[201~'));
      vi.advanceTimersByTime(500); // Within 1-second timeout
      dataListener(Buffer.from('\x1b[200~more\x1b[201~'));
    });

    expect(onKeypress).toHaveBeenCalledTimes(2);
    expect(onKeypress).toHaveBeenCalledWith({
      name: '',
      ctrl: false,
      meta: false,
      shift: false,
      paste: true,
      sequence: 'text',
    });
    expect(onKeypress).toHaveBeenCalledWith({
      name: '',
      ctrl: false,
      meta: false,
      shift: false,
      paste: true,
      sequence: 'more',
    });
  });
});