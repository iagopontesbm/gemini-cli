/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { GoogleGenAI, EmbedContentResponse } from '@google/genai';
import { GeminiEmbed } from './geminiEmbed.js';

// Mock the GoogleGenAI class from the '@google/genai' module
vi.mock('@google/genai');

describe('GeminiEmbed', () => {
  const mockEmbedContent = vi.fn();

  beforeEach(() => {
    // Reset singleton instance before each test
    // This is a common pattern for testing singletons
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (GeminiEmbed as any).instance = undefined;

    // Clear all mocks to ensure test isolation
    vi.clearAllMocks();

    // Set up the mock for GoogleGenAI constructor and its methods
    // `vi.mocked` is a helper for TypeScript to get types right
    vi.mocked(GoogleGenAI).mockImplementation(() => ({
        models: {
          embedContent: mockEmbedContent,
        },
      } as unknown as GoogleGenAI)); // Cast to avoid type issues with the mock
  });

  afterEach(() => {
    // A good practice, although beforeEach already handles it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (GeminiEmbed as any).instance = undefined;
  });

  describe('Singleton Pattern', () => {
    it('should throw an error when getInstance is called before initialization', () => {
      expect(() => GeminiEmbed.getInstance()).toThrow(
        'GeminiEmbed has not been initialized. Call initialize(apiKey) first.',
      );
    });

    it('should successfully initialize and create an instance', () => {
      GeminiEmbed.initialize('test-api-key');
      expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
      expect(GoogleGenAI).toHaveBeenCalledTimes(1);
      expect(GeminiEmbed.getInstance()).toBeInstanceOf(GeminiEmbed);
    });

    it('should return the same instance on multiple calls', () => {
      GeminiEmbed.initialize('test-api-key');
      const instance1 = GeminiEmbed.getInstance();
      const instance2 = GeminiEmbed.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should not create a new instance if initialize is called again', () => {
      GeminiEmbed.initialize('first-key');
      const instance1 = GeminiEmbed.getInstance();

      GeminiEmbed.initialize('second-key');
      const instance2 = GeminiEmbed.getInstance();

      expect(instance1).toBe(instance2);
      // The constructor should only have been called once
      expect(GoogleGenAI).toHaveBeenCalledTimes(1);
      expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: 'first-key' });
    });
  });

  describe('generateEmbedding', () => {
    const apiKey = 'test-api-key';
    const text = 'hello world';
    const model = 'models/embedding-001';

    beforeEach(() => {
      GeminiEmbed.initialize(apiKey);
    });

    it('should call embedContent with correct parameters and return embedding', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      const mockResponse: EmbedContentResponse = {
        embeddings: [{ values: mockEmbedding }],
      };
      mockEmbedContent.mockResolvedValue(mockResponse);

      const embedder = GeminiEmbed.getInstance();
      const result = await embedder.generateEmbedding(text, model);

      expect(mockEmbedContent).toHaveBeenCalledTimes(1);
      expect(mockEmbedContent).toHaveBeenCalledWith({
        model,
        contents: [text],
      });
      expect(result).toEqual(mockEmbedding);
    });

    it('should throw an error if API response has no embeddings array', async () => {
      mockEmbedContent.mockResolvedValue({} as EmbedContentResponse); // No `embeddings` key

      const embedder = GeminiEmbed.getInstance();
      await expect(embedder.generateEmbedding(text, model)).rejects.toThrow(
        'No embeddings found',
      );
    });

    it('should throw an error if API response has an empty embeddings array', async () => {
      const mockResponse: EmbedContentResponse = {
        embeddings: [],
      };
      mockEmbedContent.mockResolvedValue(mockResponse);
      const embedder = GeminiEmbed.getInstance();
      await expect(embedder.generateEmbedding(text, model)).rejects.toThrow(
        'No embeddings found',
      );
    });

    it('should throw an error if embedding values are nullish', async () => {
      const mockResponse: EmbedContentResponse = {
        embeddings: [{ values: undefined }], // Can also be null
      };
      mockEmbedContent.mockResolvedValue(mockResponse);

      const embedder = GeminiEmbed.getInstance();
      await expect(embedder.generateEmbedding(text, model)).rejects.toThrow(
        'No values found in embeddings',
      );
    });

    it('should throw an error if embedding values is an empty array', async () => {
      const mockResponse: EmbedContentResponse = {
        embeddings: [{ values: [] }],
      };
      mockEmbedContent.mockResolvedValue(mockResponse);

      const embedder = GeminiEmbed.getInstance();
      await expect(embedder.generateEmbedding(text, model)).rejects.toThrow(
        'No values found in embeddings',
      );
    });

    it('should propagate errors from the API call', async () => {
      const apiError = new Error('API Failure');
      mockEmbedContent.mockRejectedValue(apiError);

      const embedder = GeminiEmbed.getInstance();

      await expect(embedder.generateEmbedding(text, model)).rejects.toThrow(
        'API Failure',
      );
    });
  });
});
