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
 * (grouping rapid keypresses within 50ms) as a fallback. Bracketed paste mode
 * is automatically enabled if the terminal supports it, determined by TTY status,
 * TERM environment variable, and successful enabling.
 *
 * Pasted content is sent as a single key event with the full paste in the
 * sequence field and paste set to true. Special keys (e.g., arrow keys) are
 * handled correctly via readline, ensuring terminal functionality is preserved.
 * Robustly handles edge cases like split paste chunks, unterminated sequences
 * (via a 1-second timeout), and partial markers (e.g., \x1b[200, excluding
 * fragments like '~' from paste content). Embedded paste-end markers (\x1b[201~)
 * in pasted content terminate the paste, per terminal protocol behavior, and
 * subsequent content is treated as a new paste if followed by another end marker.
 * Ensures terminal responsiveness by resetting paste state after a short timeout.
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
  const pasteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPasteModeRef = useRef(false);
  const pasteBufferRef = useRef<string>('');
  const pasteHandledRef = useRef(false);
  const isBracketedPasteSupportedRef = useRef(false);
  const partialStartMarkerRef = useRef(false); // Track incomplete \x1b[200

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

    const maxInputDelay = 50; // Milliseconds, for reliable paste detection
    const pasteTimeoutDuration = 1000; // 1 second for unterminated pastes

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
      pasteHandledRef.current = false; // Reset after paste processing
    };

    const resetPasteState = () => {
      if (isPasteModeRef.current && pasteBufferRef.current.length > 0) {
        // Process partial paste as a fallback
        onKeypressRef.current({
          name: '',
          ctrl: false,
          meta: false,
          shift: false,
          paste: true,
          sequence: pasteBufferRef.current,
        });
      }
      isPasteModeRef.current = false;
      pasteBufferRef.current = '';
      pasteHandledRef.current = false;
      partialStartMarkerRef.current = false;
      if (pasteTimeoutRef.current) {
        clearTimeout(pasteTimeoutRef.current);
        pasteTimeoutRef.current = null;
      }
    };

    const handleRawData = (data: Buffer) => {
      if (!isBracketedPasteSupportedRef.current) {
        return;
      }

      let remainingInput = data.toString();

      // Check for incomplete start marker from previous chunk
      if (partialStartMarkerRef.current && remainingInput.startsWith('~')) {
        isPasteModeRef.current = true;
        pasteBufferRef.current = '';
        remainingInput = remainingInput.slice(1); // Skip the '~'
        partialStartMarkerRef.current = false;
        pasteTimeoutRef.current = setTimeout(resetPasteState, pasteTimeoutDuration);
      }

      while (remainingInput.length > 0) {
        if (isPasteModeRef.current) {
          const endMarkerIndex = remainingInput.indexOf('\x1b[201~');
          if (endMarkerIndex !== -1) {
            pasteBufferRef.current += remainingInput.slice(0, endMarkerIndex);

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
              keyBufferRef.current = []; // Clear keypress buffer
            }

            pasteBufferRef.current = '';
            isPasteModeRef.current = false;
            remainingInput = remainingInput.slice(endMarkerIndex + 6);
            if (pasteTimeoutRef.current) {
              clearTimeout(pasteTimeoutRef.current);
              pasteTimeoutRef.current = null;
            }
            continue; // Continue processing remaining input
          } else {
            // Check for non-paste escape sequences (e.g., arrow keys)
            const nonPasteSequences = ['\x1b[A', '\x1b[B', '\x1b[C', '\x1b[D'];
            if (nonPasteSequences.some(seq => remainingInput.startsWith(seq))) {
              resetPasteState();
              break; // Let readline handle the input
            }

            pasteBufferRef.current += remainingInput;
            break; // Wait for the next data chunk for the end marker
          }
        } else {
          const startMarkerIndex = remainingInput.indexOf('\x1b[200~');
          if (startMarkerIndex !== -1) {
            // Start a new paste from the marker
            isPasteModeRef.current = true;
            pasteBufferRef.current = '';
            remainingInput = remainingInput.slice(startMarkerIndex + 6);
            partialStartMarkerRef.current = false;
            pasteTimeoutRef.current = setTimeout(resetPasteState, pasteTimeoutDuration);
            continue;
          } else if (remainingInput.indexOf('\x1b[201~') !== -1) {
            // Treat content before an end marker as a paste if no start marker
            const endMarkerIndex = remainingInput.indexOf('\x1b[201~');
            pasteBufferRef.current = remainingInput.slice(0, endMarkerIndex);
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
              keyBufferRef.current = []; // Clear keypress buffer
            }
            pasteBufferRef.current = '';
            isPasteModeRef.current = false;
            remainingInput = remainingInput.slice(endMarkerIndex + 6);
            partialStartMarkerRef.current = false;
            pasteTimeoutRef.current = setTimeout(resetPasteState, pasteTimeoutDuration);
            continue;
          } else if (remainingInput.startsWith('\x1b[200')) {
            // Handle partial start marker
            partialStartMarkerRef.current = true;
            remainingInput = '';
            break; // Wait for the next chunk
          } else {
            // Not in paste mode and no paste marker; let readline handle it
            break;
          }
        }
      }
    };

    const handleKeypress = (_: unknown, key: Key) => {
      if (isPasteModeRef.current) {
        return;
      }

      if (pasteHandledRef.current) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          pasteHandledRef.current = false;
          timeoutRef.current = null;
        }, maxInputDelay);
        return;
      }

      keyBufferRef.current.push(key);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        const keys = keyBufferRef.current;
        if (keys.length === 1) {
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

    stdin.prependListener('data', handleRawData);
    stdin.prependListener('keypress', handleKeypress);

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
      if (pasteTimeoutRef.current) {
        clearTimeout(pasteTimeoutRef.current);
        pasteTimeoutRef.current = null;
      }

      isPasteModeRef.current = false;
      pasteBufferRef.current = '';
      keyBufferRef.current = [];
      pasteHandledRef.current = false;
      isBracketedPasteSupportedRef.current = false;
      partialStartMarkerRef.current = false;
    };
  }, [isActive, stdin, setRawMode]);
}