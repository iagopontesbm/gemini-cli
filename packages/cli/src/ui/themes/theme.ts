/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CSSProperties } from 'react';

export type ThemeType = 'light' | 'dark' | 'ansi' | 'custom';

export interface ColorsTheme {
  type: ThemeType;
  Background: string;
  Foreground: string;
  LightBlue: string;
  AccentBlue: string;
  AccentPurple: string;
  AccentCyan: string;
  AccentGreen: string;
  AccentYellow: string;
  AccentRed: string;
  Comment: string;
  Gray: string;
  GradientColors?: string[];
}

export interface CustomTheme extends ColorsTheme {
  type: 'custom';
  name: string;
}

export const lightTheme: ColorsTheme = {
  type: 'light',
  Background: '#FAFAFA',
  Foreground: '#3C3C43',
  LightBlue: '#89BDCD',
  AccentBlue: '#3B82F6',
  AccentPurple: '#8B5CF6',
  AccentCyan: '#06B6D4',
  AccentGreen: '#3CA84B',
  AccentYellow: '#D5A40A',
  AccentRed: '#DD4C4C',
  Comment: '#008000',
  Gray: '#B7BECC',
  GradientColors: ['#4796E4', '#847ACE', '#C3677F'],
};

export const darkTheme: ColorsTheme = {
  type: 'dark',
  Background: '#1E1E2E',
  Foreground: '#CDD6F4',
  LightBlue: '#ADD8E6',
  AccentBlue: '#89B4FA',
  AccentPurple: '#CBA6F7',
  AccentCyan: '#89DCEB',
  AccentGreen: '#A6E3A1',
  AccentYellow: '#F9E2AF',
  AccentRed: '#F38BA8',
  Comment: '#6C7086',
  Gray: '#6C7086',
  GradientColors: ['#4796E4', '#847ACE', '#C3677F'],
};

export const ansiTheme: ColorsTheme = {
  type: 'ansi',
  Background: 'black',
  Foreground: 'white',
  LightBlue: 'blue',
  AccentBlue: 'blue',
  AccentPurple: 'magenta',
  AccentCyan: 'cyan',
  AccentGreen: 'green',
  AccentYellow: 'yellow',
  AccentRed: 'red',
  Comment: 'gray',
  Gray: 'gray',
};

export class Theme {
  /**
   * The default foreground color for text when no specific highlight rule applies.
   * This is an Ink-compatible color string (hex or name).
   */
  readonly defaultColor: string;
  /**
   * Stores the mapping from highlight.js class names (e.g., 'hljs-keyword')
   * to Ink-compatible color strings (hex or name).
   */
  protected readonly _colorMap: Readonly<Record<string, string>>;

  // --- Static Helper Data ---

  // Mapping from common CSS color names (lowercase) to hex codes (lowercase)
  // Excludes names directly supported by Ink
  private static readonly cssNameToHexMap: Readonly<Record<string, string>> = {
    aliceblue: '#f0f8ff',
    antiquewhite: '#faebd7',
    aqua: '#00ffff',
    aquamarine: '#7fffd4',
    azure: '#f0ffff',
    beige: '#f5f5dc',
    bisque: '#ffe4c4',
    blanchedalmond: '#ffebcd',
    blueviolet: '#8a2be2',
    brown: '#a52a2a',
    burlywood: '#deb887',
    cadetblue: '#5f9ea0',
    chartreuse: '#7fff00',
    chocolate: '#d2691e',
    coral: '#ff7f50',
    cornflowerblue: '#6495ed',
    cornsilk: '#fff8dc',
    crimson: '#dc143c',
    darkblue: '#00008b',
    darkcyan: '#008b8b',
    darkgoldenrod: '#b8860b',
    darkgray: '#a9a9a9',
    darkgrey: '#a9a9a9',
    darkgreen: '#006400',
    darkkhaki: '#bdb76b',
    darkmagenta: '#8b008b',
    darkolivegreen: '#556b2f',
    darkorange: '#ff8c00',
    darkorchid: '#9932cc',
    darkred: '#8b0000',
    darksalmon: '#e9967a',
    darkseagreen: '#8fbc8f',
    darkslateblue: '#483d8b',
    darkslategray: '#2f4f4f',
    darkslategrey: '#2f4f4f',
    darkturquoise: '#00ced1',
    darkviolet: '#9400d3',
    deeppink: '#ff1493',
    deepskyblue: '#00bfff',
    dimgray: '#696969',
    dimgrey: '#696969',
    dodgerblue: '#1e90ff',
    firebrick: '#b22222',
    floralwhite: '#fffaf0',
    forestgreen: '#228b22',
    fuchsia: '#ff00ff',
    gainsboro: '#dcdcdc',
    ghostwhite: '#f8f8ff',
    gold: '#ffd700',
    goldenrod: '#daa520',
    greenyellow: '#adff2f',
    honeydew: '#f0fff0',
    hotpink: '#ff69b4',
    indianred: '#cd5c5c',
    indigo: '#4b0082',
    ivory: '#fffff0',
    khaki: '#f0e68c',
    lavender: '#e6e6fa',
    lavenderblush: '#fff0f5',
    lawngreen: '#7cfc00',
    lemonchiffon: '#fffacd',
    lightblue: '#add8e6',
    lightcoral: '#f08080',
    lightcyan: '#e0ffff',
    lightgoldenrodyellow: '#fafad2',
    lightgray: '#d3d3d3',
    lightgrey: '#d3d3d3',
    lightgreen: '#90ee90',
    lightpink: '#ffb6c1',
    lightsalmon: '#ffa07a',
    lightseagreen: '#20b2aa',
    lightskyblue: '#87cefa',
    lightslategray: '#778899',
    lightslategrey: '#778899',
    lightsteelblue: '#b0c4de',
    lightyellow: '#ffffe0',
    lime: '#00ff00',
    limegreen: '#32cd32',
    linen: '#faf0e6',
    maroon: '#800000',
    mediumaquamarine: '#66cdaa',
    mediumblue: '#0000cd',
    mediumorchid: '#ba55d3',
    mediumpurple: '#9370db',
    mediumseagreen: '#3cb371',
    mediumslateblue: '#7b68ee',
    mediumspringgreen: '#00fa9a',
    mediumturquoise: '#48d1cc',
    mediumvioletred: '#c71585',
    midnightblue: '#191970',
    mintcream: '#f5fffa',
    mistyrose: '#ffe4e1',
    moccasin: '#ffe4b5',
    navajowhite: '#ffdead',
    navy: '#000080',
    oldlace: '#fdf5e6',
    olive: '#808000',
    olivedrab: '#6b8e23',
    orange: '#ffa500',
    orangered: '#ff4500',
    orchid: '#da70d6',
    palegoldenrod: '#eee8aa',
    palegreen: '#98fb98',
    paleturquoise: '#afeeee',
    palevioletred: '#db7093',
    papayawhip: '#ffefd5',
    peachpuff: '#ffdab9',
    peru: '#cd853f',
    pink: '#ffc0cb',
    plum: '#dda0dd',
    powderblue: '#b0e0e6',
    purple: '#800080',
    rebeccapurple: '#663399',
    rosybrown: '#bc8f8f',
    royalblue: '#4169e1',
    saddlebrown: '#8b4513',
    salmon: '#fa8072',
    sandybrown: '#f4a460',
    seagreen: '#2e8b57',
    seashell: '#fff5ee',
    sienna: '#a0522d',
    silver: '#c0c0c0',
    skyblue: '#87ceeb',
    slateblue: '#6a5acd',
    slategray: '#708090',
    slategrey: '#708090',
    snow: '#fffafa',
    springgreen: '#00ff7f',
    steelblue: '#4682b4',
    tan: '#d2b48c',
    teal: '#008080',
    thistle: '#d8bfd8',
    tomato: '#ff6347',
    turquoise: '#40e0d0',
    violet: '#ee82ee',
    wheat: '#f5deb3',
    whitesmoke: '#f5f5f5',
    yellowgreen: '#9acd32',
  };

  // Define the set of Ink's named colors for quick lookup
  private static readonly inkSupportedNames = new Set([
    'black',
    'red',
    'green',
    'yellow',
    'blue',
    'cyan',
    'magenta',
    'white',
    'gray',
    'grey',
    'blackbright',
    'redbright',
    'greenbright',
    'yellowbright',
    'bluebright',
    'cyanbright',
    'magentabright',
    'whitebright',
  ]);

  /**
   * Creates a new Theme instance.
   * @param name The name of the theme.
   * @param rawMappings The raw CSSProperties mappings from a react-syntax-highlighter theme object.
   */
  constructor(
    readonly name: string,
    readonly type: ThemeType,
    rawMappings: Record<string, CSSProperties>,
    readonly colors: ColorsTheme,
  ) {
    this._colorMap = Object.freeze(this._buildColorMap(rawMappings)); // Build and freeze the map

    // Determine the default foreground color
    const rawDefaultColor = rawMappings['hljs']?.color;
    this.defaultColor =
      (rawDefaultColor ? Theme._resolveColor(rawDefaultColor) : undefined) ??
      ''; // Default to empty string if not found or resolvable
  }

  /**
   * Gets the Ink-compatible color string for a given highlight.js class name.
   * @param hljsClass The highlight.js class name (e.g., 'hljs-keyword', 'hljs-string').
   * @returns The corresponding Ink color string (hex or name) if it exists.
   */
  getInkColor(hljsClass: string): string | undefined {
    return this._colorMap[hljsClass];
  }

  /**
   * Resolves a CSS color value (name or hex) into an Ink-compatible color string.
   * @param colorValue The raw color string (e.g., 'blue', '#ff0000', 'darkkhaki').
   * @returns An Ink-compatible color string (hex or name), or undefined if not resolvable.
   */
  private static _resolveColor(colorValue: string): string | undefined {
    const lowerColor = colorValue.toLowerCase();

    // 1. Check if it's already a hex code
    if (lowerColor.startsWith('#')) {
      return lowerColor; // Use hex directly
    }
    // 2. Check if it's an Ink supported name (lowercase)
    else if (Theme.inkSupportedNames.has(lowerColor)) {
      return lowerColor; // Use Ink name directly
    }
    // 3. Check if it's a known CSS name we can map to hex
    else if (Theme.cssNameToHexMap[lowerColor]) {
      return Theme.cssNameToHexMap[lowerColor]; // Use mapped hex
    }

    // 4. Could not resolve
    console.warn(
      `[Theme] Could not resolve color "${colorValue}" to an Ink-compatible format.`,
    );
    return undefined;
  }

  /**
   * Builds the internal map from highlight.js class names to Ink-compatible color strings.
   * This method is protected and primarily intended for use by the constructor.
   * @param hljsTheme The raw CSSProperties mappings from a react-syntax-highlighter theme object.
   * @returns An Ink-compatible theme map (Record<string, string>).
   */
  protected _buildColorMap(
    hljsTheme: Record<string, CSSProperties>,
  ): Record<string, string> {
    const inkTheme: Record<string, string> = {};
    for (const key in hljsTheme) {
      // Ensure the key starts with 'hljs-' or is 'hljs' for the base style
      if (!key.startsWith('hljs-') && key !== 'hljs') {
        continue; // Skip keys not related to highlighting classes
      }

      const style = hljsTheme[key];
      if (style?.color) {
        const resolvedColor = Theme._resolveColor(style.color);
        if (resolvedColor !== undefined) {
          // Use the original key from the hljsTheme (e.g., 'hljs-keyword')
          inkTheme[key] = resolvedColor;
        }
        // If color is not resolvable, it's omitted from the map,
        // allowing fallback to the default foreground color.
      }
      // We currently only care about the 'color' property for Ink rendering.
      // Other properties like background, fontStyle, etc., are ignored.
    }
    return inkTheme;
  }
}

/**
 * Creates a Theme instance from a custom theme configuration.
 * @param customTheme The custom theme configuration.
 * @returns A new Theme instance.
 */
export function createCustomTheme(customTheme: CustomTheme): Theme {
  // Generate CSS properties mappings based on the custom theme colors
  const rawMappings: Record<string, CSSProperties> = {
    hljs: {
      display: 'block',
      overflowX: 'auto',
      padding: '0.5em',
      background: customTheme.Background,
      color: customTheme.Foreground,
    },
    'hljs-keyword': {
      color: customTheme.AccentBlue,
    },
    'hljs-literal': {
      color: customTheme.AccentBlue,
    },
    'hljs-symbol': {
      color: customTheme.AccentBlue,
    },
    'hljs-name': {
      color: customTheme.AccentBlue,
    },
    'hljs-link': {
      color: customTheme.AccentBlue,
      textDecoration: 'underline',
    },
    'hljs-built_in': {
      color: customTheme.AccentCyan,
    },
    'hljs-type': {
      color: customTheme.AccentCyan,
    },
    'hljs-number': {
      color: customTheme.AccentGreen,
    },
    'hljs-class': {
      color: customTheme.AccentGreen,
    },
    'hljs-string': {
      color: customTheme.AccentYellow,
    },
    'hljs-meta-string': {
      color: customTheme.AccentYellow,
    },
    'hljs-regexp': {
      color: customTheme.AccentRed,
    },
    'hljs-template-tag': {
      color: customTheme.AccentRed,
    },
    'hljs-subst': {
      color: customTheme.Foreground,
    },
    'hljs-function': {
      color: customTheme.Foreground,
    },
    'hljs-title': {
      color: customTheme.Foreground,
    },
    'hljs-params': {
      color: customTheme.Foreground,
    },
    'hljs-formula': {
      color: customTheme.Foreground,
    },
    'hljs-comment': {
      color: customTheme.Comment,
      fontStyle: 'italic',
    },
    'hljs-quote': {
      color: customTheme.Comment,
      fontStyle: 'italic',
    },
    'hljs-doctag': {
      color: customTheme.Comment,
    },
    'hljs-meta': {
      color: customTheme.Gray,
    },
    'hljs-meta-keyword': {
      color: customTheme.Gray,
    },
    'hljs-tag': {
      color: customTheme.Gray,
    },
    'hljs-variable': {
      color: customTheme.AccentPurple,
    },
    'hljs-template-variable': {
      color: customTheme.AccentPurple,
    },
    'hljs-attr': {
      color: customTheme.LightBlue,
    },
    'hljs-attribute': {
      color: customTheme.LightBlue,
    },
    'hljs-builtin-name': {
      color: customTheme.LightBlue,
    },
    'hljs-section': {
      color: customTheme.AccentYellow,
    },
    'hljs-emphasis': {
      fontStyle: 'italic',
    },
    'hljs-strong': {
      fontWeight: 'bold',
    },
    'hljs-bullet': {
      color: customTheme.AccentYellow,
    },
    'hljs-selector-tag': {
      color: customTheme.AccentYellow,
    },
    'hljs-selector-id': {
      color: customTheme.AccentYellow,
    },
    'hljs-selector-class': {
      color: customTheme.AccentYellow,
    },
    'hljs-selector-attr': {
      color: customTheme.AccentYellow,
    },
    'hljs-selector-pseudo': {
      color: customTheme.AccentYellow,
    },
    'hljs-addition': {
      backgroundColor: customTheme.AccentGreen,
      display: 'inline-block',
      width: '100%',
    },
    'hljs-deletion': {
      backgroundColor: customTheme.AccentRed,
      display: 'inline-block',
      width: '100%',
    },
  };

  return new Theme(customTheme.name, 'custom', rawMappings, customTheme);
}

/**
 * Validates a custom theme configuration.
 * @param customTheme The custom theme to validate.
 * @returns An object with isValid boolean and error message if invalid.
 */
export function validateCustomTheme(customTheme: Partial<CustomTheme>): {
  isValid: boolean;
  error?: string;
} {
  // Check required fields
  const requiredFields: (keyof CustomTheme)[] = [
    'name',
    'Background',
    'Foreground',
    'LightBlue',
    'AccentBlue',
    'AccentPurple',
    'AccentCyan',
    'AccentGreen',
    'AccentYellow',
    'AccentRed',
    'Comment',
    'Gray',
  ];

  for (const field of requiredFields) {
    if (!customTheme[field]) {
      return {
        isValid: false,
        error: `Missing required field: ${field}`,
      };
    }
  }

  // Validate color format (basic hex validation)
  const colorFields: (keyof CustomTheme)[] = [
    'Background',
    'Foreground',
    'LightBlue',
    'AccentBlue',
    'AccentPurple',
    'AccentCyan',
    'AccentGreen',
    'AccentYellow',
    'AccentRed',
    'Comment',
    'Gray',
  ];

  for (const field of colorFields) {
    const color = customTheme[field] as string;
    if (!isValidColor(color)) {
      return {
        isValid: false,
        error: `Invalid color format for ${field}: ${color}`,
      };
    }
  }

  // Validate theme name
  if (customTheme.name && !isValidThemeName(customTheme.name)) {
    return {
      isValid: false,
      error: `Invalid theme name: ${customTheme.name}`,
    };
  }

  return { isValid: true };
}

/**
 * Checks if a color string is valid (hex, named color, or Ink-supported color).
 * @param color The color string to validate.
 * @returns True if the color is valid.
 */
function isValidColor(color: string): boolean {
  // Hex color validation
  if (color.startsWith('#')) {
    return /^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/.test(color);
  }

  // Named color validation (basic check for common names)
  const validNamedColors = new Set([
    'black', 'red', 'green', 'yellow', 'blue', 'cyan', 'magenta', 'white',
    'gray', 'grey', 'blackbright', 'redbright', 'greenbright', 'yellowbright',
    'bluebright', 'cyanbright', 'magentabright', 'whitebright',
    // Add more common CSS color names as needed
  ]);

  return validNamedColors.has(color.toLowerCase());
}

/**
 * Checks if a theme name is valid.
 * @param name The theme name to validate.
 * @returns True if the theme name is valid.
 */
function isValidThemeName(name: string): boolean {
  // Theme name should be non-empty and not contain invalid characters
  return name.trim().length > 0 && name.trim().length <= 50;
}

/**
 * Creates a default custom theme based on the specified type.
 * @param name The name for the custom theme.
 * @param type The base theme type to derive from.
 * @returns A new custom theme configuration.
 */
export function createDefaultCustomTheme(name: string, type: 'light' | 'dark'): CustomTheme {
  const baseTheme = type === 'light' ? lightTheme : darkTheme;
  
  return {
    type: 'custom',
    name,
    Background: baseTheme.Background,
    Foreground: baseTheme.Foreground,
    LightBlue: baseTheme.LightBlue,
    AccentBlue: baseTheme.AccentBlue,
    AccentPurple: baseTheme.AccentPurple,
    AccentCyan: baseTheme.AccentCyan,
    AccentGreen: baseTheme.AccentGreen,
    AccentYellow: baseTheme.AccentYellow,
    AccentRed: baseTheme.AccentRed,
    Comment: baseTheme.Comment,
    Gray: baseTheme.Gray,
    GradientColors: baseTheme.GradientColors,
  };
}
