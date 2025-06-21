/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from 'react';
import { useStdin } from 'ink';
import readline from 'readline';
import { PassThrough } from 'stream';

export interface Key {
  name: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  sequence: string;
}

/**
 * A hook that listens for keypress events from stdin, providing a
 * key object that mirrors the one from Node's `readline` module.
 * It handles multi-line pastes as a single event.
 *
 * @param onKeypress - The callback function to execute on each keypress.
 * @param options - Options to control the hook's behavior.
 * @param options.isActive - Whether the hook should be actively listening for input.
 */
export function useKeypress(
  onKeypress: (key: Key) => void,
  { isActive }: { isActive: boolean },
) {
  const { stdin, setRawMode } = useStdin();
  const onKeypressRef = useRef(onKeypress);

  useEffect(() => {
    onKeypressRef.current = onKeypress;
  }, [onKeypress]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    setRawMode(true);

    return () => {
      setRawMode(false);
    };
  }, [isActive, setRawMode]);

  useEffect(() => {
    if (!isActive || !stdin.isTTY) {
      return;
    }

    const keypressStream = new PassThrough();
    const rl = readline.createInterface({
      input: keypressStream,
      escapeCodeTimeout: 50,
    });

    const handleKeypress = (_: unknown, key: Key) => {
      onKeypressRef.current(key);
    };

    const handleData = (data: Buffer) => {
      const sequence = data.toString('utf8');

      // Any data chunk that is longer than 6 characters is treated as a paste.
      if (sequence.length > 6) {
        onKeypressRef.current({
          name: '',
          ctrl: false,
          meta: false,
          shift: false,
          sequence,
        });
        return;
      }
      // Otherwise, we push it to readline to handle charcater by character.
      keypressStream.write(data);
    };

    readline.emitKeypressEvents(keypressStream, rl);
    keypressStream.on('keypress', handleKeypress);
    stdin.on('data', handleData);

    return () => {
      keypressStream.removeListener('keypress', handleKeypress);
      stdin.removeListener('data', handleData);
      rl.close();
    };
  }, [isActive, stdin]);
}
