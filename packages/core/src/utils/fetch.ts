/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClientRequest } from 'http';

export class FetchError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

export async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const signal = controller.signal;

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      signal,
      headers: {
        'User-Agent': 'Gemini-CLI/1.0',
      },
    });
    return response;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new FetchError(`Request timed out after ${timeoutMs}ms`, 'TIMEOUT');
    }
    // Re-throw other errors as FetchError
    const err = e as Error;
    throw new FetchError(
      `Failed to fetch URL: ${err.message}`,
      (err as NodeJS.ErrnoException).code,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function isPrivateIp(url: string): boolean {
  try {
    const ip = new URL(url).hostname;
    // Super basic check for private IP ranges.
    // This is not exhaustive but covers the most common cases.
    return (
      ip === 'localhost' ||
      ip.startsWith('127.') ||
      ip.startsWith('10.') ||
      ip.startsWith('192.168.') ||
      (ip.startsWith('172.') &&
        parseInt(ip.split('.')[1], 10) >= 16 &&
        parseInt(ip.split('.')[1], 10) <= 31)
    );
  } catch (e) {
    // If it's not a valid URL, it's not a private IP we can access.
    return false;
  }
}
