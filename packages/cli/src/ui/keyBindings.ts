/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Key } from 'ink';

/**
 * Key matcher function type
 */
type KeyMatcher = (key: Key, input: string) => boolean;

/**
 * interface for key matchers
 */
export interface KeyMatchers {
  readonly [shortcutName: string]: KeyMatcher;
}

/**
 * key binding matchers
 */
export const keyMatchers: KeyMatchers = {
  // Cursor movement
  home: (key, input) => key.ctrl && input === 'a',
  end: (key, input) => key.ctrl && input === 'e',

  // Text deletion
  killLineRight: (key, input) => key.ctrl && input === 'k',
  killLineLeft: (key, input) => key.ctrl && input === 'u',

  // Screen control
  clearScreen: (key, input) => key.ctrl && input === 'l',

  // History navigation
  historyUp: (key, input) => key.ctrl && input === 'p',
  historyDown: (key, input) => key.ctrl && input === 'n',

  // App level bindings
  showErrorDetails: (key, input) => key.ctrl && input === 'o',
  toggleToolDescriptions: (key, input) => key.ctrl && input === 't',
  quit: (key, input) => key.ctrl && (input === 'c' || input === 'C'),
  exit: (key, input) => key.ctrl && (input === 'd' || input === 'D'),
  showMoreLines: (key, input) => key.ctrl && input === 's',
};
