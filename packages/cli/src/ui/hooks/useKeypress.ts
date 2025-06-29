/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from 'react';
import { useStdin } from 'ink';
import readline from 'readline';

export interface Key {
  name: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  paste: boolean;
  sequence: string;
}

/**
 * A hook that listens for keypress events from stdin, providing a key object
 * that mirrors the one from Node's `readline` module, with a 'paste' flag
 * indicating whether the input is a paste. Paste detection primarily uses a raw
 * input listener to capture full paste content, with a timeout-based heuristic
 * (grouping rapid keypresses within 10ms) as a fallback. Bracketed paste mode
 * (\x1b[200~ and \x1b[201~) is optional and used only if enabled and supported.
 *
 * Pasted content is sent as a single key event with the full paste in the
 * sequence field and paste set to true, ensuring all characters are captured.
 * Bracketed paste markers are parsed explicitly to avoid buffering them with
 * content, preventing data corruption if the pasted text contains similar sequences.
 *
 * @param onKeypress - The callback function to execute on each keypress or paste.
 * @param options - Options to control the hook's behavior.
 * @param options.isActive - Whether the hook should be actively listening for input.
 * @param options.enableBracketedPaste - Whether to attempt enabling bracketed paste mode (default: false).
 */
export function useKeypress(
  onKeypress: (key: Key) => void,
  {
    isActive,
    enableBracketedPaste = false,
  }: { isActive: boolean; enableBracketedPaste?: boolean },
) {
  const { stdin, setRawMode } = useStdin();
  const onKeypressRef = useRef(onKeypress);
  const keyBufferRef = useRef<Key[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPasteModeRef = useRef(false);
  const pasteBufferRef = useRef<string>('');
  const pasteHandledRef = useRef(false);

  useEffect(() => {
    onKeypressRef.current = onKeypress;
  }, [onKeypress]);

  useEffect(() => {
    if (!isActive || !stdin.isTTY) {
      return;
    }

    setRawMode(true);
    const rl = readline.createInterface({ input: stdin });
    readline.emitKeypressEvents(stdin, rl);

    // Enable bracketed paste mode if requested and stdin is writable
    if (enableBracketedPaste && stdin.writable) {
      try {
        stdin.write('\x1b[?2004h');
      } catch (err) {
        // Silently handle error
      }
    }

    const maxInputDelay = 10; // Milliseconds, increased for reliability

    const handleInput = () => {
      const keys = keyBufferRef.current;
      if (keys.length === 0) return;

      // Combine all keypresses in the buffer as a paste
      const combinedSequence = keys.map((key) => key.sequence).join('');
      onKeypressRef.current({
        name: '',
        ctrl: false,
        meta: false,
        shift: false,
        paste: true,
        sequence: combinedSequence,
      });

      keyBufferRef.current = [];
      timeoutRef.current = null;
    };

    // Raw input listener to capture full paste content
    const handleRawData = (data: Buffer) => {
      const input = data.toString();

      if (enableBracketedPaste) {
        // Parse input for bracketed paste sequences
        let remainingInput = input;
        while (remainingInput.length > 0) {
          if (!isPasteModeRef.current && remainingInput.startsWith('\x1b[200~')) {
            isPasteModeRef.current = true;
            pasteBufferRef.current = '';
            remainingInput = remainingInput.slice(6); // Length of \x1b[200~
            continue;
          }
          if (isPasteModeRef.current && remainingInput.startsWith('\x1b[201~')) {
            isPasteModeRef.current = false;
            if (pasteBufferRef.current.length > 0) {
              pasteHandledRef.current = true;
              onKeypressRef.current({
                name: '',
                ctrl: false,
                meta: false,
                shift: false,
                paste: true,
                sequence: pasteBufferRef.current,
              });
              keyBufferRef.current = []; // Clear keypress buffer to prevent duplicate processing
            }
            pasteBufferRef.current = '';
            remainingInput = remainingInput.slice(6); // Length of \x1b[201~
            continue;
          }
          if (isPasteModeRef.current) {
            // Find the next marker or end of input
            const nextStart = remainingInput.indexOf('\x1b[200~');
            const nextEnd = remainingInput.indexOf('\x1b[201~');
            let nextMarkerPos = -1;
            if (nextStart !== -1 && (nextEnd === -1 || nextStart < nextEnd)) {
              nextMarkerPos = nextStart;
            } else if (nextEnd !== -1) {
              nextMarkerPos = nextEnd;
            }
            const content = nextMarkerPos === -1 ? remainingInput : remainingInput.slice(0, nextMarkerPos);
            pasteBufferRef.current += content;
            remainingInput = nextMarkerPos === -1 ? '' : remainingInput.slice(nextMarkerPos);
          } else {
            break; // Process non-paste input below
          }
        }

        // Handle remaining non-paste input
        // Note: This block (lines ~120–130) previously caused duplicate paste events
        // because multi-character input was processed as a paste here and again
        // by handleKeypress via readline keypress events. Now, pasteHandledRef
        // ensures handleKeypress skips these events, and keyBufferRef is cleared
        // after a paste to prevent duplicate buffering.
        if (remainingInput.length > 0 && !isPasteModeRef.current) {
          if (remainingInput.length > 1) {
            pasteHandledRef.current = true;
            onKeypressRef.current({
              name: '',
              ctrl: false,
              meta: false,
              shift: false,
              paste: true,
              sequence: remainingInput,
            });
            keyBufferRef.current = []; // Clear keypress buffer to prevent duplicate processing
          }
        }
      } else if (input.length > 1) {
        // Treat multi-character raw input as a paste when bracketed paste is disabled
        pasteHandledRef.current = true;
        onKeypressRef.current({
          name: '',
          ctrl: false,
          meta: false,
          shift: false,
          paste: true,
          sequence: input,
        });
        keyBufferRef.current = []; // Clear keypress buffer to prevent duplicate processing
      }
    };

    const handleKeypress = (_: unknown, key: Key) => {
      if (isPasteModeRef.current || pasteHandledRef.current) {
        // Skip processing if in bracketed paste mode or paste was handled by raw data
        pasteHandledRef.current = false; // Reset flag after skipping
        return;
      }

      // Fallback to timeout-based detection for single characters
      keyBufferRef.current.push(key);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        const keys = keyBufferRef.current;
        if (keys.length === 1) {
          // Single keypress
          const singleKey = keys[0];
          if (singleKey.name === 'return' && singleKey.sequence === '\x1b\r') {
            singleKey.meta = true;
          }
          onKeypressRef.current({ ...singleKey, paste: false });
          keyBufferRef.current = [];
          timeoutRef.current = null;
        } else {
          handleInput();
        }
      }, maxInputDelay);
    };

    stdin.on('data', handleRawData);
    stdin.on('keypress', handleKeypress);

    return () => {
      stdin.removeListener('data', handleRawData);
      stdin.removeListener('keypress', handleKeypress);
      rl.close();
      setRawMode(false);

      // Disable bracketed paste mode if enabled
      if (enableBracketedPaste && stdin.writable) {
        try {
          stdin.write('\x1b[?2004l');
        } catch (err) {
          // Silently handle error
        }
      }

      // Process any remaining buffered input
      if (isPasteModeRef.current && pasteBufferRef.current.length > 0) {
        onKeypressRef.current({
          name: '',
          ctrl: false,
          meta: false,
          shift: false,
          paste: true,
          sequence: pasteBufferRef.current,
        });
      } else if (keyBufferRef.current.length > 0) {
        handleInput();
      }

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      isPasteModeRef.current = false;
      pasteBufferRef.current = '';
      keyBufferRef.current = [];
      pasteHandledRef.current = false;
    };
  }, [isActive, stdin, setRawMode, enableBracketedPaste]);
}