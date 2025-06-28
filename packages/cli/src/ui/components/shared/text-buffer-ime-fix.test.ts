/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTextBuffer } from './text-buffer.js';

describe('text-buffer IME 0x7f fix', () => {
  describe('IME bug pattern detection and fixing', () => {
    it('should fix single CJK char + 0x7f + CJK char pattern', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: '',
          viewport: { width: 80, height: 10 },
          isValidPath: () => true,
        }),
      );

      // IME sends: 你 + DEL + 好
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: '你\x7f好' }]);
      });
      
      // With fix: 0x7f is filtered out, both characters remain
      expect(result.current.text).toBe('你好');
    });

    it('should handle complete IME sequence with multiple 0x7f', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: '',
          viewport: { width: 80, height: 10 },
          isValidPath: () => true,
        }),
      );

      // Simulate typing "你好世界" with IME bug
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: '你' }]);
      });
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: '\x7f好' }]);
      });
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: '\x7f世' }]);
      });
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: '\x7f界' }]);
      });

      // All characters should be present
      expect(result.current.text).toBe('你好世界');
    });

    it('should not affect normal backspace operations', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'Hello',
          viewport: { width: 80, height: 10 },
          isValidPath: () => true,
        }),
      );

      // Move cursor to end (cursor would be at position 5)
      act(() => {
        result.current.moveToOffset(5);
      });

      // Normal backspace (not part of IME pattern) 
      // This is a single 0x7f with no CJK context
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: '\x7f' }]);
      });
      
      // Should delete last character
      expect(result.current.text).toBe('Hell');
    });

    it('should not affect ASCII text with 0x7f', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: '',
          viewport: { width: 80, height: 10 },
          isValidPath: () => true,
        }),
      );

      // ASCII text with 0x7f should process normally
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: 'abc\x7fd' }]);
      });
      
      // 'abc' + backspace + 'd' = 'abd'
      expect(result.current.text).toBe('abd');
    });

    it('should handle mixed ASCII and CJK with 0x7f correctly', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: '',
          viewport: { width: 80, height: 10 },
          isValidPath: () => true,
        }),
      );

      // Mixed content: ASCII + CJK with 0x7f
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: 'Hello ' }]);
      });
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: '你\x7f好' }]);
      });
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: ' world' }]);
      });
      
      expect(result.current.text).toBe('Hello 你好 world');
    });

    it('should handle Japanese IME input', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: '',
          viewport: { width: 80, height: 10 },
          isValidPath: () => true,
        }),
      );

      // Japanese characters with 0x7f
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: 'こ' }]);
      });
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: '\x7fん' }]);
      });
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: '\x7fに' }]);
      });
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: '\x7fち' }]);
      });
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: '\x7fは' }]);
      });

      expect(result.current.text).toBe('こんにちは');
    });

    it('should handle Korean IME input', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: '',
          viewport: { width: 80, height: 10 },
          isValidPath: () => true,
        }),
      );

      // Korean characters with 0x7f
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: '안' }]);
      });
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: '\x7f녕' }]);
      });
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: '\x7f하' }]);
      });
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: '\x7f세' }]);
      });
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: '\x7f요' }]);
      });

      expect(result.current.text).toBe('안녕하세요');
    });

    it('should handle position 0 insertions correctly', () => {
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

      // Insert with IME bug pattern
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: '你\x7f好' }]);
      });

      // Should prepend correctly
      expect(result.current.text).toBe('你好世界');
    });

    it('should handle real-world IME sequence', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: '',
          viewport: { width: 80, height: 10 },
          isValidPath: () => true,
        }),
      );

      // Simulate actual IME typing sequence for "你好世界"
      // First char: just insert
      act(() => {
        result.current.insert('你');
      });
      expect(result.current.text).toBe('你');

      // Subsequent chars: IME sends DEL + char
      act(() => {
        result.current.insert('\x7f好');
      });
      expect(result.current.text).toBe('你好');

      act(() => {
        result.current.insert('\x7f世');
      });
      expect(result.current.text).toBe('你好世');

      act(() => {
        result.current.insert('\x7f界');
      });
      expect(result.current.text).toBe('你好世界');
    });
  });
});