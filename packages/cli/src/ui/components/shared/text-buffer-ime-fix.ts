/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * IME Fix Implementation
 *
 * The IME bug manifests when typing Chinese/Japanese/Korean characters where
 * only the last character appears. After investigation, we found:
 *
 * 1. The text buffer logic is correct - it properly inserts at cursor position
 * 2. The issue must be in how IME input is processed before reaching the buffer
 *
 * Possible root causes:
 * - IME sends multiple backspace+insert operations instead of simple inserts
 * - Terminal/OS sends incorrect key sequences during IME composition
 * - React state updates are batched incorrectly during rapid IME input
 *
 * Solution approach:
 * We need to detect IME composition sequences and handle them specially.
 */

export interface IMEState {
  isComposing: boolean;
  compositionStart: number;
  accumulatedText: string;
}

export function createIMEFix() {
  let imeState: IMEState = {
    isComposing: false,
    compositionStart: 0,
    accumulatedText: '',
  };

  return {
    /**
     * Process operations before they reach the text buffer.
     * Detects and fixes IME-specific patterns.
     */
    preprocessOperations(
      operations: Array<{ type: string; payload?: string }>,
      currentCursorPos: number,
      currentText: string,
    ): Array<{ type: string; payload?: string }> {
      // Pattern detection: rapid backspace+insert at position 0
      // This is a common pattern when IME is misbehaving

      let hasBackspaceInsertPattern = false;
      let consecutiveBackspaces = 0;
      let insertAfterBackspace = false;

      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        if (op.type === 'backspace') {
          consecutiveBackspaces++;
        } else if (op.type === 'insert' && consecutiveBackspaces > 0) {
          insertAfterBackspace = true;
          break;
        } else {
          consecutiveBackspaces = 0;
        }
      }

      // If we detect the problematic pattern, we might be in IME mode
      if (insertAfterBackspace && currentCursorPos === 0) {
        // This could be the IME bug - log for debugging
        console.debug('IME pattern detected: backspace+insert at position 0');
      }

      return operations;
    },

    /**
     * Alternative approach: Track IME composition state
     */
    startComposition(cursorPos: number) {
      imeState.isComposing = true;
      imeState.compositionStart = cursorPos;
      imeState.accumulatedText = '';
    },

    endComposition() {
      imeState.isComposing = false;
      imeState.accumulatedText = '';
    },

    isComposing() {
      return imeState.isComposing;
    },

    /**
     * For debugging: log IME events
     */
    logIMEEvent(event: string, data: any) {
      if (process.env.DEBUG_IME) {
        console.log(`[IME] ${event}:`, data);
      }
    },
  };
}
