/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shortens a URL using TinyURL service
 * @param url The URL to shorten
 * @returns Promise that resolves to the shortened URL, or the original URL if shortening fails
 */
export async function shortenUrl(url: string): Promise<string> {
    try {
        // TinyURL API endpoint
        const tinyUrlApi = `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`;

        const response = await fetch(tinyUrlApi, {
            method: 'GET',
            headers: {
                'User-Agent': 'GeminiCLI URL Shortener',
            },
            // Set a timeout for the request
            signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
            const shortenedUrl = await response.text();

            // TinyURL returns the shortened URL directly as plain text
            // Validate that we got a proper shortened URL back
            if (shortenedUrl && shortenedUrl.startsWith('https://tinyurl.com/')) {
                return shortenedUrl;
            }
        }

        // If shortening failed, return the original URL
        return url;
    } catch (error) {
        // If there's any error (network, timeout, etc.), return the original URL
        console.warn('URL shortening failed, using original URL:', error instanceof Error ? error.message : String(error));
        return url;
    }
}

/**
 * Shortens a URL with fallback options
 * @param url The URL to shorten
 * @returns Promise that resolves to the shortened URL, or the original URL if all services fail
 */
export async function shortenUrlWithFallback(url: string): Promise<string> {
    try {
        // First try TinyURL
        const result = await shortenUrl(url);
        if (result !== url) {
            return result;
        }

        // If TinyURL failed, try is.gd as fallback
        const isGdApi = `https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`;

        const response = await fetch(isGdApi, {
            method: 'GET',
            headers: {
                'User-Agent': 'GeminiCLI URL Shortener',
            },
            signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
            const shortenedUrl = await response.text();

            // is.gd returns the shortened URL directly as plain text
            if (shortenedUrl && shortenedUrl.startsWith('https://is.gd/')) {
                return shortenedUrl;
            }
        }

        // If all services failed, return the original URL
        return url;
    } catch (error) {
        console.warn('URL shortening with fallback failed, using original URL:', error instanceof Error ? error.message : String(error));
        return url;
    }
} 