/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import { BaseTool, ToolResult } from './tools.js';
import { SchemaValidator } from '../utils/schemaValidator.js';
import { getErrorMessage } from '../utils/errors.js';
import { Config } from '../config/config.js';
import { getResponseText } from '../utils/generateContentResponseUtilities.js';

/**
 * Parameters for the WebSearchTool.
 */
export interface WebSearchToolParams {
  /**
   * The search query.
   */
  query: string;
}

/**
 * A tool to perform web searches using Google Search via the Gemini API.
 */
export class WebSearchTool extends BaseTool<WebSearchToolParams, ToolResult> {
  static readonly Name: string = 'google_web_search';
  private ai: GoogleGenAI | null = null;
  private modelName: string;

  constructor(private readonly config: Config) {
    super(
      WebSearchTool.Name,
      'GoogleWebSearch',
      'Performs a web search using Google Search (via the Gemini API) and returns the results. This tool is useful for finding information on the internet based on a query.',
      {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to find information on the web.',
          },
        },
        required: ['query'],
      },
    );

    const apiKey = this.config.getApiKey();
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    }
    this.modelName = this.config.getModel();
  }

  validateParams(params: WebSearchToolParams): string | null {
    if (
      this.schema.parameters &&
      !SchemaValidator.validate(
        this.schema.parameters as Record<string, unknown>,
        params,
      )
    ) {
      return "Parameters failed schema validation. Ensure 'query' is a string.";
    }
    if (!params.query || params.query.trim() === '') {
      return "The 'query' parameter cannot be empty.";
    }
    return null;
  }

  getDescription(params: WebSearchToolParams): string {
    return `Searching the web for: "${params.query}"`;
  }

  async execute(params: WebSearchToolParams): Promise<ToolResult> {
    const validationError = this.validateParams(params);
    if (validationError) {
      return {
        llmContent: `Error: Invalid parameters provided. Reason: ${validationError}`,
        returnDisplay: `Error: ${validationError}`,
      };
    }

    if (!this.ai) {
      const apiKeyError =
        'Google AI API key is not configured. Cannot perform web search.';
      return {
        llmContent: `Error: ${apiKeyError}`,
        returnDisplay: `Error: ${apiKeyError}`,
      };
    }

    try {
      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: [{ role: 'user', parts: [{ text: params.query }] }],
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const responseText = getResponseText(response);

      if (!responseText || !responseText.trim()) {
        return {
          llmContent: `No search results or information found for query: "${params.query}"`,
          returnDisplay: 'No information found for your query.',
        };
      }

      return {
        llmContent: `Web search results for "${params.query}":\n\n${responseText}`,
        returnDisplay: `Search results for "${params.query}" returned.`,
      };
    } catch (error: unknown) {
      const errorMessage = `Error during web search for query "${params.query}": ${getErrorMessage(error)}`;
      console.error(errorMessage, error);
      return {
        llmContent: `Error: ${errorMessage}`,
        returnDisplay: `Error performing web search.`,
      };
    }
  }
}
