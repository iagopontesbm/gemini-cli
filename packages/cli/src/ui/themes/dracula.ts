/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Theme, type ColorsTheme } from './theme.js';

const draculaColors: ColorsTheme = {
  type: 'dark',
  Background: '#282a36',
  Foreground: '#f8f8f2',
  LightBlue: '#8be9fd', // From hljs-keyword, etc.
  AccentBlue: '#8be9fd', // From hljs-keyword, etc.
  AccentPurple: '#ff79c6', // From hljs-function .hljs-keyword
  AccentCyan: '#8be9fd', // Re-using LightBlue as primary cyan
  AccentGreen: '#50fa7b', // A common Dracula green, not directly in syntax but fits
  AccentYellow: '#f1fa8c', // From hljs-string, hljs-title, etc.
  AccentRed: '#ff5555', // A common Dracula red, not directly in syntax but fits
  SubtleComment: '#6272a4', // From hljs-comment
  Gray: '#6272a4', // Using comment color as gray
  GradientColors: ['#ff79c6', '#bd93f9', '#8be9fd'], // Dracula-themed gradient
};

export const Dracula: Theme = new Theme(
  'Dracula',
  'dark',
  {
    hljs: {
      display: 'block',
      overflowX: 'auto',
      padding: '0.5em',
      background: '#282a36',
      color: '#f8f8f2',
    },
    'hljs-keyword': {
      color: '#8be9fd',
      fontWeight: 'bold',
    },
    'hljs-selector-tag': {
      color: '#8be9fd',
      fontWeight: 'bold',
    },
    'hljs-literal': {
      color: '#8be9fd',
      fontWeight: 'bold',
    },
    'hljs-section': {
      color: '#8be9fd',
      fontWeight: 'bold',
    },
    'hljs-link': {
      color: '#8be9fd',
    },
    'hljs-function .hljs-keyword': {
      color: '#ff79c6',
    },
    'hljs-subst': {
      color: '#f8f8f2',
    },
    'hljs-string': {
      color: '#f1fa8c',
    },
    'hljs-title': {
      color: '#f1fa8c',
      fontWeight: 'bold',
    },
    'hljs-name': {
      color: '#f1fa8c',
      fontWeight: 'bold',
    },
    'hljs-type': {
      color: '#f1fa8c',
      fontWeight: 'bold',
    },
    'hljs-attribute': {
      color: '#f1fa8c',
    },
    'hljs-symbol': {
      color: '#f1fa8c',
    },
    'hljs-bullet': {
      color: '#f1fa8c',
    },
    'hljs-addition': {
      color: '#f1fa8c',
    },
    'hljs-variable': {
      color: '#f1fa8c',
    },
    'hljs-template-tag': {
      color: '#f1fa8c',
    },
    'hljs-template-variable': {
      color: '#f1fa8c',
    },
    'hljs-comment': {
      color: '#6272a4',
    },
    'hljs-quote': {
      color: '#6272a4',
    },
    'hljs-deletion': {
      color: '#6272a4',
    },
    'hljs-meta': {
      color: '#6272a4',
    },
    'hljs-doctag': {
      fontWeight: 'bold',
    },
    'hljs-strong': {
      fontWeight: 'bold',
    },
    'hljs-emphasis': {
      fontStyle: 'italic',
    },
  },
  draculaColors,
);
