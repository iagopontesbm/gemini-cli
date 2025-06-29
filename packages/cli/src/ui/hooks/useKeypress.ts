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
        console.log('Bracketed paste mode enabled');
      } catch (err) {
        console.error('Failed to enable bracketed paste:', err);
      }
    }

    const maxInputDelay = 10; // Milliseconds, increased for reliability

    const handleInput = () => {
      const keys = keyBufferRef.current;
      if (keys.length === 0) return;

      // Combine all keypresses in the buffer as a paste
      const combinedSequence = keys.map((key) => key.sequence).join('');
      console.log('Timeout paste:', combinedSequence);
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
      console.log('Raw data:', JSON.stringify(input));

      // Check for bracketed paste sequences if enabled
      if (enableBracketedPaste) {
        if (input.includes('\x1b[200~')) {
          isPasteModeRef.current = true;
          pasteBufferRef.current = '';
          console.log('Paste start detected');
          return;
        }
        if (input.includes('\x1b[201~')) {
          isPasteModeRef.current = false;
          const pasteContent = pasteBufferRef.current.replace('\x1b[200~', '').replace('\x1b[201~', '');
          console.log('Paste end, content:', pasteContent);
          if (pasteContent.length > 0) {
            onKeypressRef.current({
              name: '',
              ctrl: false,
              meta: false,
              shift: false,
              paste: true,
              sequence: pasteContent,
            });
          }
          pasteBufferRef.current = '';
          return;
        }
      }

      if (isPasteModeRef.current) {
        pasteBufferRef.current += input;
      } else if (input.length > 1) {
        // Treat multi-character raw input as a paste
        console.log('Raw paste detected:', input);
        onKeypressRef.current({
          name: '',
          ctrl: false,
          meta: false,
          shift: false,
          paste: true,
          sequence: input,
        });
      }
    };

    const handleKeypress = (_: unknown, key: Key) => {
      console.log('Keypress:', JSON.stringify(key.sequence), 'Paste mode:', isPasteModeRef.current);

      if (isPasteModeRef.current) {
        // Skip keypress processing in bracketed paste mode
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
          console.log('Single key:', singleKey.sequence);
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
          console.log('Bracketed paste mode disabled');
        } catch (err) {
          console.error('Failed to disable bracketed paste:', err);
        }
      }

      // Process any remaining buffered input
      if (isPasteModeRef.current && pasteBufferRef.current.length > 0) {
        const pasteContent = pasteBufferRef.current.replace('\x1b[200~', '').replace('\x1b[201~', '');
        console.log('Cleanup paste:', pasteContent);
        if (pasteContent.length > 0) {
          onKeypressRef.current({
            name: '',
            ctrl: false,
            meta: false,
            shift: false,
            paste: true,
            sequence: pasteContent,
          });
        }
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
    };
  }, [isActive, stdin, setRawMode, enableBracketedPaste]);
}
