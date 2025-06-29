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
 * indicating whether the input is a paste. Paste detection uses bracketed paste
 * mode (\x1b[200~ and \x1b[201~) when supported, with a timeout-based heuristic
 * (grouping rapid keypresses within 10ms) as a fallback. Bracketed paste mode
 * is automatically enabled if the terminal supports it, determined by TTY status,
 * TERM environment variable, and successful enabling.
 *
 * Pasted content is sent as a single key event with the full paste in the
 * sequence field and paste set to true. Special keys (e.g., arrow keys) are
 * handled correctly via readline, ensuring terminal functionality is preserved.
 *
 * @param onKeypress - The callback function to execute on each keypress or paste.
 * @param options - Options to control the hook's behavior.
 * @param options.isActive - Whether the hook should be actively listening for input.
 */
export function useKeypress(
  onKeypress: (key: Key) => void,
  { isActive }: { isActive: boolean },
) {
  const { stdin, setRawMode } = useStdin();
  const onKeypressRef = useRef(onKeypress);
  const keyBufferRef = useRef<Key[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPasteModeRef = useRef(false);
  const pasteBufferRef = useRef<string>('');
  const pasteHandledRef = useRef(false);
  const isBracketedPasteSupportedRef = useRef(false);

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

    // Detect bracketed paste support
    const term = process.env.TERM?.toLowerCase() || '';
    const knownSupportedTerms = [
      'xterm',
      'screen',
      'tmux',
      'rxvt',
      'linux',
      'cygwin',
      'st',
      'alacritty',
      'kitty',
    ];
    const isLikelySupported =
      stdin.writable &&
      knownSupportedTerms.some((supportedTerm) => term.includes(supportedTerm));

    if (isLikelySupported) {
      try {
        stdin.write('\x1b[?2004h');
        isBracketedPasteSupportedRef.current = true;
      } catch (err) {
        // Silently handle error, fallback to timeout-based detection
        isBracketedPasteSupportedRef.current = false;
      }
    }

    const maxInputDelay = 20; // Milliseconds for paste detection reliability

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

      if (isBracketedPasteSupportedRef.current) {
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
            break; // Let readline handle non-paste input
          }
        }
      }
      // Non-bracketed input is handled by handleKeypress via readline
    };

    const handleKeypress = (_: unknown, key: Key) => {
      if (isPasteModeRef.current || pasteHandledRef.current) {
        // Skip processing if in bracketed paste mode or paste was handled by raw data
        pasteHandledRef.current = false; // Reset flag after skipping
        return;
      }

      // Timeout-based detection for single characters and pastes
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

      // Disable bracketed paste mode if it was enabled
      if (isBracketedPasteSupportedRef.current && stdin.writable) {
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
      isBracketedPasteSupportedRef.current = false;
    };
  }, [isActive, stdin, setRawMode]);
}