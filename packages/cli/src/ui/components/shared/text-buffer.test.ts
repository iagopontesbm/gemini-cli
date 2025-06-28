/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTextBuffer } from './text-buffer.js';

describe('text-buffer IME input handling', () => {
  describe('Chinese/Japanese/Korean input', () => {
    it('should handle IME input at the beginning of an empty line', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: '',
          viewport: { width: 80, height: 10 },
          isValidPath: () => true,
        }),
      );

      // Simulate IME input where cursor stays at 0
      act(() => {
        // First character
        result.current.applyOperations([{ type: 'insert', payload: '你' }]);
      });
      expect(result.current.text).toBe('你');

      // Second character - cursor would normally be at 0 causing overwrite
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: '好' }]);
      });
      expect(result.current.text).toBe('你好');
    });

    it('should handle IME input in the middle of a line', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'Hello world',
          viewport: { width: 80, height: 10 },
          isValidPath: () => true,
        }),
      );

      // Move cursor to position 6 (after "Hello ")
      act(() => {
        // Move to end first, then use moveToOffset
        result.current.move('end');
        // Now move back to position 6
        result.current.moveToOffset(6);
      });

      // Insert Chinese characters
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: '你好' }]);
      });
      expect(result.current.text).toBe('Hello 你好world');

      // Verify cursor position is maintained correctly after insertion
      expect(result.current.cursor[1]).toBe(8); // 6 + 2 characters
    });

    it('should NOT move cursor to end when genuinely inserting at position 0', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'existing text',
          viewport: { width: 80, height: 10 },
          isValidPath: () => true,
        }),
      );

      // Explicitly move cursor to beginning
      act(() => {
        result.current.move('home');
      });

      // This represents a case where user wants to prepend
      // The fix should not activate here because this is intentional position 0
      act(() => {
        result.current.applyOperations([
          { type: 'insert', payload: 'prefix ' },
        ]);
      });

      expect(result.current.text).toBe('prefix existing text');
    });

    it('should handle IME input at the end of a line', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'Hello',
          viewport: { width: 80, height: 10 },
          isValidPath: () => true,
        }),
      );

      // Move cursor to end
      act(() => {
        result.current.move('end');
      });

      // Insert Japanese characters
      act(() => {
        result.current.applyOperations([
          { type: 'insert', payload: 'こんにちは' },
        ]);
      });
      expect(result.current.text).toBe('Helloこんにちは');
    });

    it('should handle IME input with multiple lines', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'Line 1\nLine 2\nLine 3',
          viewport: { width: 80, height: 10 },
          isValidPath: () => true,
        }),
      );

      // Move to second line, position 0
      act(() => {
        // Calculate offset for line 2, position 0
        // Line 1 is "Line 1\n" = 7 chars
        result.current.moveToOffset(7);
      });

      // Insert Korean characters
      act(() => {
        result.current.applyOperations([
          { type: 'insert', payload: '안녕하세요' },
        ]);
      });

      const lines = result.current.text.split('\n');
      expect(lines[0]).toBe('Line 1');
      expect(lines[1]).toBe('안녕하세요Line 2');
      expect(lines[2]).toBe('Line 3');
    });

    it('should handle sequential IME character input (simulating the bug)', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: '',
          viewport: { width: 80, height: 10 },
          isValidPath: () => true,
        }),
      );

      // Simulate the bug where cursor stays at 0 during IME composition
      const characters = ['你', '好', '世', '界'];

      characters.forEach((char) => {
        act(() => {
          // In the bug scenario, cursor would be stuck at 0
          // But our text buffer should handle this correctly
          result.current.applyOperations([{ type: 'insert', payload: char }]);
        });
      });

      expect(result.current.text).toBe('你好世界');
    });

    it('should handle mixed English and CJK input', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: '',
          viewport: { width: 80, height: 10 },
          isValidPath: () => true,
        }),
      );

      // Type mixed content
      const inputs = ['Hello', ' ', '世界', ' ', 'world'];

      inputs.forEach((input) => {
        act(() => {
          result.current.applyOperations([{ type: 'insert', payload: input }]);
        });
      });

      expect(result.current.text).toBe('Hello 世界 world');
    });

    it('should handle IME input after navigation', () => {
      const { result } = renderHook(() =>
        useTextBuffer({
          initialText: 'Test text here',
          viewport: { width: 80, height: 10 },
          isValidPath: () => true,
        }),
      );

      // Navigate to position 5 (after "Test ")
      act(() => {
        result.current.moveToOffset(5);
      });

      // Insert Japanese
      act(() => {
        result.current.applyOperations([{ type: 'insert', payload: '日本語' }]);
      });

      expect(result.current.text).toBe('Test 日本語text here');
    });
  });

  describe('IME 0x7f bug fix', () => {
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
        result.current.applyOperations([
          { type: 'insert', payload: '你\x7f好' },
        ]);
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
        result.current.applyOperations([
          { type: 'insert', payload: 'abc\x7fd' },
        ]);
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
        result.current.applyOperations([
          { type: 'insert', payload: '你\x7f好' },
        ]);
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
        result.current.applyOperations([
          { type: 'insert', payload: '你\x7f好' },
        ]);
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
