/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTextBuffer } from './text-buffer.js';

describe('text-buffer conservative IME fix', () => {
  describe('Conservative fix activation', () => {
    it('should activate fix when: single CJK char at pos 0, line starts with CJK', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: '你好',
          viewport: { width: 80, height: 10 },
          isValidPath: () => true,
        }),
      );

      // Move to position 0
      act(() => {
        result.current.moveToOffset(0);
      });

      // Insert single CJK character - fix should activate
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: '世' }]);
      });

      // With fix: character appends to end
      expect(result.current.text).toBe('你好世');
    });

    it('should NOT activate fix for ASCII at position 0', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: '你好',
          viewport: { width: 80, height: 10 },
          isValidPath: () => true,
        }),
      );

      // Move to position 0
      act(() => {
        result.current.moveToOffset(0);
      });

      // Insert ASCII - fix should NOT activate
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: 'Hello ' }]);
      });

      // Should prepend normally
      expect(result.current.text).toBe('Hello 你好');
    });

    it('should NOT activate fix when line starts with ASCII', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'Hello',
          viewport: { width: 80, height: 10 },
          isValidPath: () => true,
        }),
      );

      // Move to position 0
      act(() => {
        result.current.moveToOffset(0);
      });

      // Insert CJK - fix should NOT activate (line starts with ASCII)
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: '你' }]);
      });

      // Should prepend normally
      expect(result.current.text).toBe('你Hello');
    });

    it('should NOT activate fix for multi-character CJK insert', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: '世界',
          viewport: { width: 80, height: 10 },
          isValidPath: () => true,
        }),
      );

      // Move to position 0
      act(() => {
        result.current.moveToOffset(0);
      });

      // Insert multiple CJK chars - fix should NOT activate
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: '你好' }]);
      });

      // Should prepend normally
      expect(result.current.text).toBe('你好世界');
    });

    it('should NOT activate fix on empty line', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: '',
          viewport: { width: 80, height: 10 },
          isValidPath: () => true,
        }),
      );

      // Insert CJK at position 0 on empty line
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: '你' }]);
      });

      // Should insert normally
      expect(result.current.text).toBe('你');
    });

    it('should handle sequential single-char CJK inserts with fix', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: '',
          viewport: { width: 80, height: 10 },
          isValidPath: () => true,
        }),
      );

      // First char - no fix (empty line)
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: '你' }]);
      });
      expect(result.current.text).toBe('你');

      // Move cursor to 0
      act(() => {
        result.current.moveToOffset(0);
      });

      // Second char - fix activates (single CJK at 0, line starts with CJK)
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: '好' }]);
      });
      expect(result.current.text).toBe('你好');

      // Move cursor to 0 again
      act(() => {
        result.current.moveToOffset(0);
      });

      // Third char - fix activates again
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: '世' }]);
      });
      expect(result.current.text).toBe('你好世');
    });
  });
});