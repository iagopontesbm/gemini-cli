/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleAuth } from 'google-auth-library';
import {
  GenerateContentResponse,
  GenerateContentParameters,
  CountTokensParameters,
  EmbedContentResponse,
  CountTokensResponse,
  EmbedContentParameters,
} from '@google/genai';
import { Readable } from 'stream';
import * as readline from 'readline';
import { ContentGenerator } from './contentGenerator.js';

const domain = 'https://cloudcode-pa.googleapis.com';
const apiVersion = 'v1internal';

export class CodeAssistContentGenerator implements ContentGenerator {
  private projectId: string;

  private auth: GoogleAuth;

  constructor(projectId: string) {
    this.projectId = projectId;
    this.auth = new GoogleAuth({
      scopes: [
        'https://www.googleapis.com/auth/cloud-platform',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
    });
  }

  async generateContent(
    request: GenerateContentParameters,
  ): Promise<GenerateContentResponse> {
    const response = await this.callCodeAssist('generateChat', request);
    return (await response.json()) as GenerateContentResponse;
  }

  async generateContentStream(
    request: GenerateContentParameters,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const response = await this.callCodeAssist(
      'streamGenerateChat?alt=sse',
      request,
    );
    return (async function* (): AsyncGenerator<GenerateContentResponse> {
      const rl = readline.createInterface({
        input: Readable.fromWeb(response.body as ReadableStream),
        crlfDelay: Infinity, // Recognizes '\r\n' and '\n' as line breaks
      });

      let bufferedLines: string[] = [];
      for await (const line of rl) {
        // blank lines are used to separate JSON objects in the stream
        if (line === '') {
          if (bufferedLines.length === 0) {
            continue; // no data to yield
          }
          yield JSON.parse(bufferedLines.join('\n')) as GenerateContentResponse;
          bufferedLines = []; // Reset the buffer after yielding
        } else if (line.startsWith('data: ')) {
          bufferedLines.push(line.slice(6).trim());
        } else {
          throw new Error(
            `Unexpected line format in streamGenerateChat response: ${line}`,
          );
        }
      }
    })();
  }

  async countTokens(
    _request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    return {
      totalTokens: 0,
    };
  }

  async embedContent(
    _request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    throw Error();
  }

  private async callCodeAssist(method: string, req: object): Promise<Response> {
    const token = await this.auth.getAccessToken();
    const url = `${domain}/${apiVersion}:${method}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Goog-User-Project': this.projectId,
      },
      body: JSON.stringify(req),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch from ${url}: ${response.status} ${errorText}`,
      );
    }
    return response;
  }
}
