/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// A new scroll for logging, imbued with the vibrant hues of the terminal.

// Chromatic constants for enchanted logging
const Colors = {
  INFO: '\x1b[36m',    // Cyan for informational messages
  SUCCESS: '\x1b[32m', // Green for success messages
  WARNING: '\x1b[33m', // Yellow for warnings
  ERROR: '\x1b[31m',   // Red for errors
  DEBUG: '\x1b[90m',   // Bright Black/Gray for debug messages
  RESET: '\x1b[0m',    // Reset to default color
};

/**
 * A mystical logging utility to channel messages with vibrant hues.
 */
export const logger = {
  /**
   * Casts an informational message to the console.
   */
  info: (message: string, ...details: unknown[]) => {
    console.log(`${Colors.INFO}[INFO]${Colors.RESET} ${message}`);
    details.forEach((detail) =>
      console.log(`${Colors.INFO}`, detail, `${Colors.RESET}`),
    );
  },

  /**
   * Casts a success message to the console.
   */
  success: (message: string, ...details: unknown[]) => {
    console.log(`${Colors.SUCCESS}[SUCCESS]${Colors.RESET} ${message}`);
    details.forEach((detail) =>
      console.log(`${Colors.SUCCESS}`, detail, `${Colors.RESET}`),
    );
  },

  /**
   * Casts a warning message to the console.
   */
  warn: (message: string, ...details: unknown[]) => {
    console.warn(`${Colors.WARNING}[WARN]${Colors.RESET} ${message}`);
    details.forEach((detail) =>
      console.warn(`${Colors.WARNING}`, detail, `${Colors.RESET}`),
    );
  },

  /**
   * Casts an error message to the console.
   */
  error: (message: string, ...details: unknown[]) => {
    console.error(`${Colors.ERROR}[ERROR]${Colors.RESET} ${message}`);
    details.forEach((detail) =>
      console.error(`${Colors.ERROR}`, detail, `${Colors.RESET}`),
    );
  },

  /**
   * Casts a debug message to the console. Only visible in debug mode.
   */
  debug: (message: string, ...details: unknown[]) => {
    // In a real scenario, this would be conditionally enabled by a config flag.
    // For now, it always logs.
    console.debug(`${Colors.DEBUG}[DEBUG]${Colors.RESET} ${message}`);
    details.forEach((detail) =>
      console.debug(`${Colors.DEBUG}`, detail, `${Colors.RESET}`),
    );
  },
};
