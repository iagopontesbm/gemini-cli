/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTextBuffer } from './text-buffer.js';

describe('text-buffer IME bug reproduction', () => {
  describe('Issue #2361 - Only last character appears during IME input', () => {
    it('should show all characters when typing Chinese sequentially (currently fails)', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: '',
          viewport: { width: 80, height: 10 },
          isValidPath: () => true,
        }),
      );

      // Simulate the IME bug: each character insertion has cursor at 0
      // but the text should accumulate, not replace
      const characters = ['你', '好', '世', '界'];
      
      characters.forEach((char, index) => {
        act(() => {
          // In the bug scenario, cursor is always at 0
          if (index > 0) {
            // Force cursor back to 0 to simulate the bug
            result.current.moveToOffset(0);
          }
          result.current.applyOperations([{ type: 'insert', payload: char }]);
        });
      });

      // With the bug, only '界' would be visible
      // With proper fix, all characters should be present
      expect(result.current.text).toBe('你好世界');
    });

    it('should handle IME input on a line with existing content (currently fails)', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: '史蒂夫',
          viewport: { width: 80, height: 10 },
          isValidPath: () => true,
        }),
      );

      // User moves cursor to beginning
      act(() => {
        result.current.moveToOffset(0);
      });

      // Type new characters with IME bug (cursor stuck at 0)
      const characters = ['你', '好'];
      characters.forEach((char, index) => {
        act(() => {
          if (index > 0) {
            // Bug: cursor gets reset to 0
            result.current.moveToOffset(0);
          }
          result.current.applyOperations([{ type: 'insert', payload: char }]);
        });
      });

      // Expected: "你好史蒂夫" (prepended)
      // With bug: might show "好史蒂夫" or "史蒂夫好" or other incorrect result
      expect(result.current.text).toBe('你好史蒂夫');
    });
  });

  describe('Issue - Position 0 insertions', () => {
    it('should allow ASCII text to be prepended at position 0', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: '史蒂夫',
          viewport: { width: 80, height: 10 },
          isValidPath: () => true,
        }),
      );

      // User explicitly moves to position 0 to prepend
      act(() => {
        result.current.moveToOffset(0);
      });

      // Type ASCII text
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: 'qqs ' }]);
      });

      // Should prepend, not append
      expect(result.current.text).toBe('qqs 史蒂夫');
    });

    it('should allow Chinese text to be prepended at position 0 when user intends to', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: '史蒂夫',
          viewport: { width: 80, height: 10 },
          isValidPath: () => true,
        }),
      );

      // User explicitly moves to position 0 to prepend
      act(() => {
        result.current.moveToOffset(0);
      });

      // Type Chinese text intentionally at beginning
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: '你好' }]);
      });

      // Should prepend, not append
      expect(result.current.text).toBe('你好史蒂夫');
    });
  });

  describe('Normal IME input (without bug)', () => {
    it('should handle normal IME input where cursor advances properly', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: '',
          viewport: { width: 80, height: 10 },
          isValidPath: () => true,
        }),
      );

      // Normal IME input - cursor advances after each character
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: '你' }]);
      });
      expect(result.current.cursor[1]).toBe(1); // Cursor at position 1

      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: '好' }]);
      });
      expect(result.current.cursor[1]).toBe(2); // Cursor at position 2
      expect(result.current.text).toBe('你好');
    });
  });
});