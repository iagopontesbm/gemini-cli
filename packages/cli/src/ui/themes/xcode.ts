/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { lightTheme, Theme, type ColorsTheme } from './theme.js';

const xcodeColors: ColorsTheme = {
  type: 'light',
  Background: '#fff',
  Foreground: 'black',
  LightBlue: '#0E0EFF', // From hljs-regexp, hljs-link
  AccentBlue: '#1c00cf', // From hljs-title, hljs-symbol, hljs-number
  AccentPurple: '#aa0d91', // From hljs-tag, hljs-keyword, etc.
  AccentCyan: '#3F6E74', // From hljs-variable (a dark teal)
  AccentGreen: '#007400', // From hljs-comment
  AccentYellow: '#836C28', // From hljs-attr (a brownish yellow)
  AccentRed: '#c41a16', // From hljs-code, hljs-string
  SubtleComment: '#007400', // From hljs-comment
  Gray: '#c0c0c0', // From xml .hljs-meta
  GradientColors: lightTheme.GradientColors, // Fallback
};

export const XCode: Theme = new Theme(
  'XCode',
  'light',
  {
    hljs: {
      display: 'block',
      overflowX: 'auto',
      padding: '0.5em',
      background: '#fff',
      color: 'black',
    },
    'xml .hljs-meta': {
      color: '#c0c0c0',
    },
    'hljs-comment': {
      color: '#007400',
    },
    'hljs-quote': {
      color: '#007400',
    },
    'hljs-tag': {
      color: '#aa0d91',
    },
    'hljs-attribute': {
      color: '#aa0d91',
    },
    'hljs-keyword': {
      color: '#aa0d91',
    },
    'hljs-selector-tag': {
      color: '#aa0d91',
    },
    'hljs-literal': {
      color: '#aa0d91',
    },
    'hljs-name': {
      color: '#aa0d91',
    },
    'hljs-variable': {
      color: '#3F6E74',
    },
    'hljs-template-variable': {
      color: '#3F6E74',
    },
    'hljs-code': {
      color: '#c41a16',
    },
    'hljs-string': {
      color: '#c41a16',
    },
    'hljs-meta-string': {
      color: '#c41a16',
    },
    'hljs-regexp': {
      color: '#0E0EFF',
    },
    'hljs-link': {
      color: '#0E0EFF',
    },
    'hljs-title': {
      color: '#1c00cf',
    },
    'hljs-symbol': {
      color: '#1c00cf',
    },
    'hljs-bullet': {
      color: '#1c00cf',
    },
    'hljs-number': {
      color: '#1c00cf',
    },
    'hljs-section': {
      color: '#643820',
    },
    'hljs-meta': {
      color: '#643820',
    },
    'hljs-class .hljs-title': {
      color: '#5c2699',
    },
    'hljs-type': {
      color: '#5c2699',
    },
    'hljs-built_in': {
      color: '#5c2699',
    },
    'hljs-builtin-name': {
      color: '#5c2699',
    },
    'hljs-params': {
      color: '#5c2699',
    },
    'hljs-attr': {
      color: '#836C28',
    },
    'hljs-subst': {
      color: '#000',
    },
    'hljs-formula': {
      backgroundColor: '#eee',
      fontStyle: 'italic',
    },
    'hljs-addition': {
      backgroundColor: '#baeeba',
    },
    'hljs-deletion': {
      backgroundColor: '#ffc8bd',
    },
    'hljs-selector-id': {
      color: '#9b703f',
    },
    'hljs-selector-class': {
      color: '#9b703f',
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
  xcodeColors,
);
