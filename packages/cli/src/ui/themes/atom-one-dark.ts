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
      color: atomOneDarkColors.Foreground,
      background: atomOneDarkColors.Background,
    },
    'hljs-comment': {
      color: atomOneDarkColors.SubtleComment,
      fontStyle: 'italic',
    },
    'hljs-quote': {
      color: atomOneDarkColors.SubtleComment,
      fontStyle: 'italic',
    },
    'hljs-doctag': {
      color: atomOneDarkColors.AccentPurple,
    },
    'hljs-keyword': {
      color: atomOneDarkColors.AccentPurple,
    },
    'hljs-formula': {
      color: atomOneDarkColors.AccentPurple,
    },
    'hljs-section': {
      color: atomOneDarkColors.AccentRed,
    },
    'hljs-name': {
      color: atomOneDarkColors.AccentRed,
    },
    'hljs-selector-tag': {
      color: atomOneDarkColors.AccentRed,
    },
    'hljs-deletion': {
      color: atomOneDarkColors.AccentRed,
    },
    'hljs-subst': {
      color: atomOneDarkColors.AccentRed,
    },
    'hljs-literal': {
      color: atomOneDarkColors.AccentCyan,
    },
    'hljs-string': {
      color: atomOneDarkColors.AccentGreen,
    },
    'hljs-regexp': {
      color: atomOneDarkColors.AccentGreen,
    },
    'hljs-addition': {
      color: atomOneDarkColors.AccentGreen,
    },
    'hljs-attribute': {
      color: atomOneDarkColors.AccentGreen,
    },
    'hljs-meta-string': {
      color: atomOneDarkColors.AccentGreen,
    },
    'hljs-built_in': {
      color: atomOneDarkColors.AccentYellow,
    },
    'hljs-class .hljs-title': {
      color: atomOneDarkColors.AccentYellow,
    },
    'hljs-attr': {
      color: atomOneDarkColors.AccentYellow,
    },
    'hljs-variable': {
      color: atomOneDarkColors.AccentYellow,
    },
    'hljs-template-variable': {
      color: atomOneDarkColors.AccentYellow,
    },
    'hljs-type': {
      color: atomOneDarkColors.AccentYellow,
    },
    'hljs-selector-class': {
      color: atomOneDarkColors.AccentYellow,
    },
    'hljs-selector-attr': {
      color: atomOneDarkColors.AccentYellow,
    },
    'hljs-selector-pseudo': {
      color: atomOneDarkColors.AccentYellow,
    },
    'hljs-number': {
      color: atomOneDarkColors.AccentYellow,
    },
    'hljs-symbol': {
      color: atomOneDarkColors.AccentBlue,
    },
    'hljs-bullet': {
      color: atomOneDarkColors.AccentBlue,
    },
    'hljs-link': {
      color: atomOneDarkColors.AccentBlue,
      textDecoration: 'underline',
    },
    'hljs-meta': {
      color: atomOneDarkColors.AccentBlue,
    },
    'hljs-selector-id': {
      color: atomOneDarkColors.AccentBlue,
    },
    'hljs-title': {
      color: atomOneDarkColors.AccentBlue,
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
