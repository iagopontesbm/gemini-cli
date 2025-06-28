/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

declare module 'node-clipboard' {
  export function write(text: string): Promise<void>;
  export function read(): Promise<string>;
} 