/* eslint-disable license-header/header */
/* eslint-disable @typescript-eslint/array-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { TextBuffer } from './text-buffer.js';
import chalk from 'chalk';
import { Box, Text, useInput, useStdin, Key } from 'ink';
import { EventEmitter } from 'node:events';
import React, { useRef, useState } from 'react';
import { useTerminalSize } from '../../hooks/useTerminalSize.js';
import { Colors } from '../../colors.js';

export interface MultilineTextEditorProps {
  // Initial contents.
  readonly initialText?: string;

  // Placeholder text.
  readonly placeholder?: string;

  // Visible width.
  readonly width?: number;

  // Visible height.
  readonly height?: number;

  // Called when the user submits (plain <Enter> key).
  readonly onSubmit?: (text: string) => void;

  // Capture keyboard input.
  readonly focus?: boolean;

  // Called when the internal text buffer updates.
  readonly onChange?: (text: string) => void;

  // Called when the user attempts to navigate past the start of the editor
  // with the up arrow.
  readonly navigateUp?: () => void;

  // Called when the user attempts to navigate past the end of the editor
  // with the down arrow.
  readonly navigateDown?: () => void;

  // Called on all key events to allow the caller. Returns true if the
  // event was handled and should not be passed to the editor.
  readonly inputPreprocessor?: (input: string, key: Key) => boolean;

  // Optional initial cursor position (character offset)
  readonly initialCursorOffset?: number;

  readonly widthUsedByParent: number;
}

// Expose a minimal imperative API so parent components (e.g. TerminalChatInput)
// can query the caret position to implement behaviours like history
// navigation that depend on whether the cursor sits on the first/last line.
export interface MultilineTextEditorHandle {
  /** Current caret row */
  getRow(): number;
  /** Current caret column */
  getCol(): number;
  /** Total number of lines in the buffer */
  getLineCount(): number;
  /** Helper: caret is on the very first row */
  isCursorAtFirstRow(): boolean;
  /** Helper: caret is on the very last row */
  isCursorAtLastRow(): boolean;
  /** Full text contents */
  getText(): string;
  /** Move the cursor to the end of the text */
  moveCursorToEnd(): void;
}

const MultilineTextEditorInner = (
  {
    initialText = '',
    placeholder = '',
    // Width can be provided by the caller.  When omitted we fall back to the
    // current terminal size (minus some padding handled by `useTerminalSize`).
    width,
    height = 10,
    onSubmit,
    focus = true,
    onChange,
    initialCursorOffset,
    widthUsedByParent,
    navigateUp,
    navigateDown,
    inputPreprocessor,
  }: MultilineTextEditorProps,
  ref: React.Ref<MultilineTextEditorHandle | null>,
): React.ReactElement => {
  // ---------------------------------------------------------------------------
  // Editor State
  // ---------------------------------------------------------------------------

  const buffer = useRef(new TextBuffer(initialText, initialCursorOffset));
  const [version, setVersion] = useState(0);

  // Keep track of the current terminal size so that the editor grows/shrinks
  // with the window.  `useTerminalSize` already subtracts a small horizontal
  // padding so that we don't butt up right against the edge.
  const terminalSize = useTerminalSize();

  const effectiveWidth = Math.max(
    20,
    width ?? terminalSize.columns - widthUsedByParent,
  );

  // ---------------------------------------------------------------------------
  // External editor integration helpers.
  // ---------------------------------------------------------------------------

  // Access to stdin so we can toggle raw‑mode while the external editor is
  // in control of the terminal.
  const { stdin, setRawMode } = useStdin();

  /**
   * Launch the user's preferred $EDITOR, blocking until they close it, then
   * reload the edited file back into the in‑memory TextBuffer.  The heavy
   * work is delegated to `TextBuffer.openInExternalEditor`, but we are
   * responsible for temporarily *disabling* raw mode so the child process can
   * interact with the TTY normally.
   */
  const openExternalEditor = React.useCallback(async () => {
    // Preserve the current raw‑mode setting so we can restore it afterwards.
    const wasRaw = stdin?.isRaw ?? false;
    try {
      setRawMode?.(false);
      await buffer.current.openInExternalEditor();
    } catch (err) {
      // Surface the error so it doesn't fail silently – for now we log to
      // stderr.  In the future this could surface a toast / overlay.

      console.error('[MultilineTextEditor] external editor error', err);
    } finally {
      if (wasRaw) {
        setRawMode?.(true);
      }
      // Force a re‑render so the component reflects the mutated buffer.
      setVersion((v) => v + 1);
    }
  }, [buffer, stdin, setRawMode]);

  // ---------------------------------------------------------------------------
  // Keyboard handling.
  // ---------------------------------------------------------------------------

  useInput(
    (input, key) => {
      if (!focus) {
        return;
      }

      if (inputPreprocessor?.(input, key) === true) {
        return;
      }

      // Single‑step editor shortcut: Ctrl+X or Ctrl+E
      // Treat both true Ctrl+Key combinations *and* raw control codes so that
      // the shortcut works consistently in real terminals (raw‑mode) and the
      // ink‑testing‑library stub which delivers only the raw byte (e.g. 0x05
      // for Ctrl‑E) without setting `key.ctrl`.
      const isCtrlX =
        (key.ctrl && (input === 'x' || input === '\x18')) || input === '\x18';
      const isCtrlE =
        (key.ctrl && (input === 'e' || input === '\x05')) ||
        input === '\x05' ||
        (!key.ctrl &&
          input === 'e' &&
          input.length === 1 &&
          input.charCodeAt(0) === 5);
      if (isCtrlX || isCtrlE) {
        openExternalEditor();
        return;
      }

      if (
        process.env['TEXTBUFFER_DEBUG'] === '1' ||
        process.env['TEXTBUFFER_DEBUG'] === 'true'
      ) {
        console.log('[MultilineTextEditor] event', { input, key });
      }

      // 1a) CSI-u / modifyOtherKeys *mode 2* (Ink strips initial ESC, so we
      //     start with '[') – format: "[<code>;<modifiers>u".
      if (input.startsWith('[') && input.endsWith('u')) {
        const m = input.match(/^\[([0-9]+);([0-9]+)u$/);
        if (m && m[1] === '13') {
          const mod = Number(m[2]);
          // In xterm's encoding: bit-1 (value 2) is Shift. Everything >1 that
          // isn't exactly 1 means some modifier was held. We treat *shift or
          // alt present* (2,3,4,6,8,9) as newline; Ctrl (bit-2 / value 4)
          // triggers submit.  See xterm/DEC modifyOtherKeys docs.

          const hasCtrl = Math.floor(mod / 4) % 2 === 1;
          if (hasCtrl) {
            if (onSubmit) {
              onSubmit(buffer.current.getText());
            }
          } else {
            buffer.current.newline();
          }
          setVersion((v) => v + 1);
          return;
        }
      }

      // 1b) CSI-~ / modifyOtherKeys *mode 1* – format: "[27;<mod>;<code>~".
      //     Terminals such as iTerm2 (default), older xterm versions, or when
      //     modifyOtherKeys=1 is configured, emit this legacy sequence.  We
      //     translate it to the same behaviour as the mode‑2 variant above so
      //     that Shift+Enter (newline) / Ctrl+Enter (submit) work regardless
      //     of the user’s terminal settings.
      if (input.startsWith('[27;') && input.endsWith('~')) {
        const m = input.match(/^\[27;([0-9]+);13~$/);
        if (m) {
          const mod = Number(m[1]);
          const hasCtrl = Math.floor(mod / 4) % 2 === 1;

          if (hasCtrl) {
            if (onSubmit) {
              onSubmit(buffer.current.getText());
            }
          } else {
            buffer.current.newline();
          }
          setVersion((v) => v + 1);
          return;
        }
      }

      // 2) Single‑byte control chars ------------------------------------------------
      if (input === '\n') {
        // Ctrl+J or pasted newline → insert newline.
        buffer.current.newline();
        setVersion((v) => v + 1);
        return;
      }

      if (input === '\r') {
        // Plain Enter – submit (works on all basic terminals).
        if (onSubmit) {
          onSubmit(buffer.current.getText());
        }
        return;
      }

      // Let <Esc> fall through so the parent handler (if any) can act on it.

      // Delegate remaining keys to our pure TextBuffer
      if (
        process.env['TEXTBUFFER_DEBUG'] === '1' ||
        process.env['TEXTBUFFER_DEBUG'] === 'true'
      ) {
        console.log('[MultilineTextEditor] key event', { input, key });
      }

      // Up arrow - check for navigation override.
      if (key.upArrow) {
        if (buffer.current.getCursor()[0] === 0 && navigateUp) {
          navigateUp();
          return;
        }
      }

      // Down arrow - check for navigation override.
      if (key.downArrow) {
        if (
          buffer.current.getCursor()[0] ===
            buffer.current.getText().split('\n').length - 1 &&
          navigateDown
        ) {
          navigateDown();
          return;
        }
      }

      const modified = buffer.current.handleInput(
        input,
        key as Record<string, boolean>,
        { height, width: effectiveWidth },
      );
      if (modified) {
        setVersion((v) => v + 1);
      }

      const newText = buffer.current.getText();
      if (onChange) {
        onChange(newText);
      }
    },
    { isActive: focus },
  );

  // ---------------------------------------------------------------------------
  // Rendering helpers.
  // ---------------------------------------------------------------------------

  /* ------------------------------------------------------------------------- */
  /*  Imperative handle – expose a read‑only view of caret & buffer geometry    */
  /* ------------------------------------------------------------------------- */

  React.useImperativeHandle(
    ref,
    () => ({
      getRow: () => buffer.current.getCursor()[0],
      getCol: () => buffer.current.getCursor()[1],
      getLineCount: () => buffer.current.getText().split('\n').length,
      isCursorAtFirstRow: () => buffer.current.getCursor()[0] === 0,
      isCursorAtLastRow: () => {
        const [row] = buffer.current.getCursor();
        const lineCount = buffer.current.getText().split('\n').length;
        return row === lineCount - 1;
      },
      getText: () => buffer.current.getText(),
      moveCursorToEnd: () => {
        buffer.current.move('home');
        const lines = buffer.current.getText().split('\n');
        for (let i = 0; i < lines.length - 1; i++) {
          buffer.current.move('down');
        }
        buffer.current.move('end');
        // Force a re-render
        setVersion((v) => v + 1);
      },
    }),
    [],
  );

  // Read everything from the buffer
  const visibleLines = buffer.current.getVisibleLines({
    height,
    width: effectiveWidth,
  });
  const [cursorRow, cursorCol] = buffer.current.getCursor();
  const scrollRow = (buffer.current as any).scrollRow as number;
  const scrollCol = (buffer.current as any).scrollCol as number;

  return (
    <Box key={version} flexDirection="column">
      {buffer.current.getText().length === 0 && placeholder ? (
        <Text color={Colors.SubtleComment}>{placeholder}</Text>
      ) : (
        visibleLines.map((lineText, idx) => {
          const absoluteRow = scrollRow + idx;

          // apply horizontal slice
          let display = lineText.slice(scrollCol, scrollCol + effectiveWidth);
          if (display.length < effectiveWidth) {
            display = display.padEnd(effectiveWidth, ' ');
          }

          // Highlight the *character under the caret* (i.e. the one immediately
          // to the right of the insertion position) so that the block cursor
          // visually matches the logical caret location.  This makes the
          // highlighted glyph the one that would be replaced by `insert()` and
          // *not* the one that would be removed by `backspace()`.

          if (absoluteRow === cursorRow) {
            const relativeCol = cursorCol - scrollCol;
            const highlightCol = relativeCol;

            if (highlightCol >= 0 && highlightCol < effectiveWidth) {
              const charToHighlight = display[highlightCol] || ' ';
              const highlighted = chalk.inverse(charToHighlight);
              display =
                display.slice(0, highlightCol) +
                highlighted +
                display.slice(highlightCol + 1);
            } else if (relativeCol === effectiveWidth) {
              // Caret sits just past the right edge; show a block cursor in the
              // gutter so the user still sees it.
              display =
                display.slice(0, effectiveWidth - 1) + chalk.inverse(' ');
            }
          }

          return <Text key={idx}>{display}</Text>;
        })
      )}
    </Box>
  );
};

export const MultilineTextEditor = React.forwardRef(MultilineTextEditorInner);
