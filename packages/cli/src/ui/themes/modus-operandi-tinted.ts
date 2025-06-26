/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Theme, modusOperandiTintedTheme } from './theme.js';

export const ModusOperandiTinted: Theme = new Theme(
  'Modus Operandi Tinted',
  'modus-operandi-tinted',
  {
    hljs: {
      display: 'block',
      overflowX: 'auto',
      padding: '0.5em',
      background: modusOperandiTintedTheme.Background,
      color: modusOperandiTintedTheme.Foreground,
    },
    'hljs-comment': {
      color: modusOperandiTintedTheme.Comment,
      fontStyle: 'italic',
    },
    'hljs-quote': {
      color: modusOperandiTintedTheme.AccentCyan,
      fontStyle: 'italic',
    },
    'hljs-string': {
      color: modusOperandiTintedTheme.AccentGreen,
    },
    'hljs-constant': {
      color: modusOperandiTintedTheme.AccentCyan,
    },
    'hljs-number': {
      color: modusOperandiTintedTheme.AccentPurple,
    },
    'hljs-keyword': {
      color: modusOperandiTintedTheme.AccentYellow,
    },
    'hljs-selector-tag': {
      color: modusOperandiTintedTheme.AccentYellow,
    },
    'hljs-attribute': {
      color: modusOperandiTintedTheme.AccentYellow,
    },
    'hljs-variable': {
      color: modusOperandiTintedTheme.Foreground,
    },
    'hljs-variable.language': {
      color: modusOperandiTintedTheme.LightBlue,
      fontStyle: 'italic',
    },
    'hljs-title': {
      color: modusOperandiTintedTheme.AccentBlue,
    },
    'hljs-section': {
      color: modusOperandiTintedTheme.AccentGreen,
      fontWeight: 'bold',
    },
    'hljs-type': {
      color: modusOperandiTintedTheme.LightBlue,
    },
    'hljs-class .hljs-title': {
      color: modusOperandiTintedTheme.AccentBlue,
    },
    'hljs-tag': {
      color: modusOperandiTintedTheme.LightBlue,
    },
    'hljs-name': {
      color: modusOperandiTintedTheme.AccentBlue,
    },
    'hljs-builtin-name': {
      color: modusOperandiTintedTheme.AccentYellow,
    },
    'hljs-meta': {
      color: modusOperandiTintedTheme.AccentYellow,
    },
    'hljs-symbol': {
      color: modusOperandiTintedTheme.AccentRed,
    },
    'hljs-bullet': {
      color: modusOperandiTintedTheme.AccentYellow,
    },
    'hljs-regexp': {
      color: modusOperandiTintedTheme.AccentCyan,
    },
    'hljs-link': {
      color: modusOperandiTintedTheme.LightBlue,
    },
    'hljs-deletion': {
      color: modusOperandiTintedTheme.AccentRed,
    },
    'hljs-addition': {
      color: modusOperandiTintedTheme.AccentGreen,
    },
    'hljs-emphasis': {
      fontStyle: 'italic',
    },
    'hljs-strong': {
      fontWeight: 'bold',
    },
    'hljs-literal': {
      color: modusOperandiTintedTheme.AccentCyan,
    },
    'hljs-built_in': {
      color: modusOperandiTintedTheme.AccentRed,
    },
    'hljs-doctag': {
      color: modusOperandiTintedTheme.AccentRed,
    },
    'hljs-template-variable': {
      color: modusOperandiTintedTheme.AccentCyan,
    },
    'hljs-selector-id': {
      color: modusOperandiTintedTheme.AccentRed,
    },
  },
  modusOperandiTintedTheme,
);
