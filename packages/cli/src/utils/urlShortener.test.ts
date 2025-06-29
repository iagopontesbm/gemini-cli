/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shortenUrl, shortenUrlWithFallback } from './urlShortener.js';

// Mock fetch
global.fetch = vi.fn();

describe('urlShortener', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock console.warn to avoid cluttering test output
        vi.spyOn(console, 'warn').mockImplementation(() => { });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('shortenUrl', () => {
        it('should return shortened URL when TinyURL service succeeds', async () => {
            const originalUrl = 'https://accounts.google.com/oauth/authorize?client_id=test&redirect_uri=http://localhost:8080/oauth2callback';
            const shortenedUrl = 'https://tinyurl.com/abc123';

            vi.mocked(fetch).mockResolvedValue({
                ok: true,
                text: async () => shortenedUrl,
            } as Response);

            const result = await shortenUrl(originalUrl);

            expect(result).toBe(shortenedUrl);
            expect(fetch).toHaveBeenCalledWith(
                `https://tinyurl.com/api-create.php?url=${encodeURIComponent(originalUrl)}`,
                expect.objectContaining({
                    method: 'GET',
                    headers: {
                        'User-Agent': 'GeminiCLI URL Shortener',
                    },
                })
            );
        });

        it('should return original URL when TinyURL service fails', async () => {
            const originalUrl = 'https://accounts.google.com/oauth/authorize?client_id=test';

            vi.mocked(fetch).mockResolvedValue({
                ok: false,
                status: 500,
            } as Response);

            const result = await shortenUrl(originalUrl);

            expect(result).toBe(originalUrl);
        });

        it('should return original URL when TinyURL returns invalid response', async () => {
            const originalUrl = 'https://accounts.google.com/oauth/authorize?client_id=test';

            vi.mocked(fetch).mockResolvedValue({
                ok: true,
                text: async () => 'Error: Invalid URL',
            } as Response);

            const result = await shortenUrl(originalUrl);

            expect(result).toBe(originalUrl);
        });

        it('should return original URL when network error occurs', async () => {
            const originalUrl = 'https://accounts.google.com/oauth/authorize?client_id=test';

            vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

            const result = await shortenUrl(originalUrl);

            expect(result).toBe(originalUrl);
            expect(console.warn).toHaveBeenCalledWith(
                'URL shortening failed, using original URL:',
                'Network error'
            );
        });

        it('should return original URL when timeout occurs', async () => {
            const originalUrl = 'https://accounts.google.com/oauth/authorize?client_id=test';

            vi.mocked(fetch).mockRejectedValue(new DOMException('Timeout', 'TimeoutError'));

            const result = await shortenUrl(originalUrl);

            expect(result).toBe(originalUrl);
        });

        it('should validate that shortened URL starts with correct domain', async () => {
            const originalUrl = 'https://accounts.google.com/oauth/authorize?client_id=test';
            const invalidShortenedUrl = 'https://malicious-site.com/abc123';

            vi.mocked(fetch).mockResolvedValue({
                ok: true,
                text: async () => invalidShortenedUrl,
            } as Response);

            const result = await shortenUrl(originalUrl);

            expect(result).toBe(originalUrl); // Should return original due to validation failure
        });
    });

    describe('shortenUrlWithFallback', () => {
        it('should return TinyURL result when TinyURL succeeds', async () => {
            const originalUrl = 'https://accounts.google.com/oauth/authorize?client_id=test';
            const shortenedUrl = 'https://tinyurl.com/abc123';

            vi.mocked(fetch).mockResolvedValue({
                ok: true,
                text: async () => shortenedUrl,
            } as Response);

            const result = await shortenUrlWithFallback(originalUrl);

            expect(result).toBe(shortenedUrl);
            expect(fetch).toHaveBeenCalledTimes(1);
        });

        it('should try is.gd fallback when TinyURL fails', async () => {
            const originalUrl = 'https://accounts.google.com/oauth/authorize?client_id=test';
            const shortenedUrl = 'https://is.gd/abc123';

            // First call (TinyURL) fails
            vi.mocked(fetch)
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                } as Response)
                // Second call (is.gd) succeeds
                .mockResolvedValueOnce({
                    ok: true,
                    text: async () => shortenedUrl,
                } as Response);

            const result = await shortenUrlWithFallback(originalUrl);

            expect(result).toBe(shortenedUrl);
            expect(fetch).toHaveBeenCalledTimes(2);
            expect(fetch).toHaveBeenNthCalledWith(2,
                `https://is.gd/create.php?format=simple&url=${encodeURIComponent(originalUrl)}`,
                expect.objectContaining({
                    method: 'GET',
                    headers: {
                        'User-Agent': 'GeminiCLI URL Shortener',
                    },
                })
            );
        });

        it('should return original URL when all services fail', async () => {
            const originalUrl = 'https://accounts.google.com/oauth/authorize?client_id=test';

            // Both calls fail
            vi.mocked(fetch)
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                } as Response)
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                } as Response);

            const result = await shortenUrlWithFallback(originalUrl);

            expect(result).toBe(originalUrl);
            expect(fetch).toHaveBeenCalledTimes(2);
        });

        it('should return original URL when both services throw errors', async () => {
            const originalUrl = 'https://accounts.google.com/oauth/authorize?client_id=test';

            vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

            const result = await shortenUrlWithFallback(originalUrl);

            expect(result).toBe(originalUrl);
            expect(console.warn).toHaveBeenCalledWith(
                'URL shortening with fallback failed, using original URL:',
                'Network error'
            );
        });

        it('should validate is.gd shortened URLs', async () => {
            const originalUrl = 'https://accounts.google.com/oauth/authorize?client_id=test';
            const invalidShortenedUrl = 'https://malicious-site.com/abc123';

            // TinyURL fails, is.gd returns invalid URL
            vi.mocked(fetch)
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    text: async () => invalidShortenedUrl,
                } as Response);

            const result = await shortenUrlWithFallback(originalUrl);

            expect(result).toBe(originalUrl); // Should return original due to validation failure
        });
    });
}); 