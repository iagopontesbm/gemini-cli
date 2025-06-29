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
    emit: vi.fn(), // Added to simulate event emission
  };
  const mockSetRawMode = vi.fn();
  const mockRl = {
    close: vi.fn(),
  };
  let onKeypress: (key: Key) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    (useStdin as any).mockReturnValue({
      stdin: mockStdin,
      setRawMode: mockSetRawMode,
    });
    (readline.createInterface as any).mockReturnValue(mockRl);
    process.env.TERM = 'xterm';
    onKeypress = vi.fn();
  });

  afterEach(() => {
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
    vi.useFakeTimers();
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
    vi.useFakeTimers();
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
    vi.useFakeTimers();
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
    vi.useFakeTimers();
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
    vi.useFakeTimers();
    (useStdin as any).mockReturnValue({
      stdin: { ...mockStdin, isTTY: true },
      setRawMode: mockSetRawMode,
    });

    // Mock bracketed paste as unsupported
    const originalWrite = mockStdin.write;
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
  });

  it('should ignore keypress events for multi-character paste after bracketed paste', async () => {
    vi.useFakeTimers();
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
});