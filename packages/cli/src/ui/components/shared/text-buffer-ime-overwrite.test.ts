/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTextBuffer } from './text-buffer.js';

describe('text-buffer IME overwrite bug', () => {
  describe('Potential overwrite scenarios', () => {
    it('should NOT overwrite when inserting at position 0 multiple times', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: '',
          viewport: { width: 80, height: 10 },
          isValidPath: () => true,
        }),
      );

      // Scenario: Each character insertion overwrites at position 0
      const characters = ['你', '好', '世', '界'];
      
      characters.forEach((char) => {
        act(() => {
          // Always insert at position 0 - simulating stuck cursor
          result.current.moveToOffset(0);
          result.current.applyOperations([{ type: 'insert', payload: char }]);
        });
      });

      // If characters prepend correctly, we should see them in reverse order
      expect(result.current.text).toBe('界世好你');
      // If there's an overwrite bug, we might only see '界'
      expect(result.current.text).not.toBe('界');
    });

    it('should handle rapid sequential inserts at position 0', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: '',
          viewport: { width: 80, height: 10 },
          isValidPath: () => true,
        }),
      );

      // Simulate rapid IME input where cursor doesn't update between operations
      act(() => {
        // Multiple operations in one batch
        result.current.applyOperations([
          { type: 'insert', payload: '你' },
          { type: 'insert', payload: '好' },
          { type: 'insert', payload: '世' },
          { type: 'insert', payload: '界' },
        ]);
      });

      // Should insert all characters sequentially
      expect(result.current.text).toBe('你好世界');
    });

    it('simulates the exact bug: cursor=0, insert, but text replaces instead of prepends', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: '',
          viewport: { width: 80, height: 10 },
          isValidPath: () => true,
        }),
      );

      // This test simulates if the text buffer had a bug where
      // inserting at position 0 replaces the entire line
      
      // First character
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: '你' }]);
      });
      const afterFirst = result.current.text;
      expect(afterFirst).toBe('你');

      // Second character - if bug exists, this would replace '你' with '好'
      act(() => {
        result.current.moveToOffset(0);
        result.current.applyOperations([{ type: 'insert', payload: '好' }]);
      });
      const afterSecond = result.current.text;
      
      // Without bug: '好你' (prepended)
      // With replace bug: '好' (replaced)
      expect(afterSecond).toBe('好你');
      expect(afterSecond.length).toBe(2);
    });
  });

  describe('Text buffer state consistency', () => {
    it('should maintain correct cursor position after insert at 0', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'test',
          viewport: { width: 80, height: 10 },
          isValidPath: () => true,
        }),
      );

      act(() => {
        result.current.moveToOffset(0);
      });
      expect(result.current.cursor[1]).toBe(0);

      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: 'X' }]);
      });

      // After inserting 'X' at position 0:
      // Text should be 'Xtest'
      // Cursor should be at position 1
      expect(result.current.text).toBe('Xtest');
      expect(result.current.cursor[1]).toBe(1);
    });

    it('should handle setText operation correctly', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: '你好',
          viewport: { width: 80, height: 10 },
          isValidPath: () => true,
        }),
      );

      // If there's a bug where setText is called instead of insert
      act(() => {
        result.current.setText('世');
      });

      // setText should replace entire content
      expect(result.current.text).toBe('世');
    });
  });
});