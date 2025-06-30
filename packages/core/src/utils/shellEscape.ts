/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Escapes a string for safe use as a shell argument.
 * This prevents command injection when constructing shell commands.
 * 
 * @param str The string to escape
 * @returns The escaped string safe for shell use
 */
export function escapeShellArg(str: string): string {
  // For empty strings, return quoted empty string
  if (str === '') {
    return "''";
  }

  // Check if the string contains any characters that need escaping
  // This includes backticks, which can cause command substitution
  const needsEscaping = /[^A-Za-z0-9_\-.\/]/.test(str);
  
  if (!needsEscaping) {
    return str;
  }

  // Use single quotes to prevent all expansions (including backtick command substitution)
  // Single quotes preserve everything literally except for single quotes themselves
  // To include a single quote, we end the quoted string, add an escaped single quote, and start a new quoted string
  return "'" + str.replace(/'/g, "'\\''") + "'";
}

/**
 * Escapes a commit message for safe use with git commit -m
 * @param message The commit message to escape
 * @returns The properly escaped commit message
 */
export function escapeGitCommitMessage(message: string): string {
  return escapeShellArg(message);
}