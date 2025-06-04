/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { darkTheme, Theme, type ColorsTheme } from './theme.js';

const atomOneDarkColors: ColorsTheme = {
  type: 'dark',
  Background: '#282c34',
  Foreground: '#abb2bf',
  LightBlue: '#61aeee', // For lighter blue elements, like symbols/links
  AccentBlue: '#61aeee', // From hljs-symbol, hljs-link, hljs-title
  AccentPurple: '#c678dd', // From hljs-keyword, hljs-doctag
  AccentCyan: '#56b6c2', // From hljs-literal
  AccentGreen: '#98c379', // From hljs-string, hljs-regexp
  AccentYellow: '#e6c07b', // From hljs-built_in, hljs-class .hljs-title
  AccentRed: '#e06c75', // From hljs-section, hljs-name
  SubtleComment: '#5c6370', // From hljs-comment
  Gray: '#5c6370', // Using comment color as gray
  GradientColors: darkTheme.GradientColors, // Fallback
};

export const AtomOneDark: Theme = new Theme(
  'Atom One',
  'dark',
  {
    hljs: {
      display: 'block',
      overflowX: 'auto',
      padding: '0.5em',
      color: '#abb2bf',
      background: '#282c34',
    },
    'hljs-comment': {
      color: '#5c6370',
      fontStyle: 'italic',
    },
    'hljs-quote': {
      color: '#5c6370',
      fontStyle: 'italic',
    },
    'hljs-doctag': {
      color: '#c678dd',
    },
    'hljs-keyword': {
      color: '#c678dd',
    },
    'hljs-formula': {
      color: '#c678dd',
    },
    'hljs-section': {
      color: '#e06c75',
    },
    'hljs-name': {
      color: '#e06c75',
    },
    'hljs-selector-tag': {
      color: '#e06c75',
    },
    'hljs-deletion': {
      color: '#e06c75',
    },
    'hljs-subst': {
      color: '#e06c75',
    },
    'hljs-literal': {
      color: '#56b6c2',
    },
    'hljs-string': {
      color: '#98c379',
    },
    'hljs-regexp': {
      color: '#98c379',
    },
    'hljs-addition': {
      color: '#98c379',
    },
    'hljs-attribute': {
      color: '#98c379',
    },
    'hljs-meta-string': {
      color: '#98c379',
    },
    'hljs-built_in': {
      color: '#e6c07b',
    },
    'hljs-class .hljs-title': {
      color: '#e6c07b',
    },
    'hljs-attr': {
      color: '#d19a66',
    },
    'hljs-variable': {
      color: '#d19a66',
    },
    'hljs-template-variable': {
      color: '#d19a66',
    },
    'hljs-type': {
      color: '#d19a66',
    },
    'hljs-selector-class': {
      color: '#d19a66',
    },
    'hljs-selector-attr': {
      color: '#d19a66',
    },
    'hljs-selector-pseudo': {
      color: '#d19a66',
    },
    'hljs-number': {
      color: '#d19a66',
    },
    'hljs-symbol': {
      color: '#61aeee',
    },
    'hljs-bullet': {
      color: '#61aeee',
    },
    'hljs-link': {
      color: '#61aeee',
      textDecoration: 'underline',
    },
    'hljs-meta': {
      color: '#61aeee',
    },
    'hljs-selector-id': {
      color: '#61aeee',
    },
    'hljs-title': {
      color: '#61aeee',
    },
    'hljs-emphasis': {
      fontStyle: 'italic',
    },
    'hljs-strong': {
      fontWeight: 'bold',
    },
  },
  atomOneDarkColors,
);
