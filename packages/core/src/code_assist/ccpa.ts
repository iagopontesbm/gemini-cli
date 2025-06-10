
import { OAuth2Client } from 'google-auth-library';
import {
    LoadCodeAssistResponse,
    LoadCodeAssistRequest,
    OnboardUserRequest,
    LongrunningOperationResponse
} from './types.js';
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
import type { ReadableStream } from 'node:stream/web';
import { ContentGenerator } from '../core/contentGenerator.js';


export const CCPA_ENDPOINT = 'https://cloudcode-pa.googleapis.com';
export const CCPA_API_VERSION = '/v1internal';

export class CcpaServer implements ContentGenerator {
    constructor(
        readonly auth: OAuth2Client,
        readonly projectId: string,
    ) { }

    async generateContentStream(
        req: GenerateContentParameters,
    ): Promise<AsyncGenerator<GenerateContentResponse>> {
        const res = await this.callEndpoint('streamGenerateChat?alt=sse', req,);
        return (async function* (): AsyncGenerator<GenerateContentResponse> {
            const rl = readline.createInterface({
                input: Readable.fromWeb(res.body as ReadableStream<Uint8Array>),
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

    async generateContent(req: GenerateContentParameters,): Promise<GenerateContentResponse> {
        const res = await this.callEndpoint('generateChat', req);
        return (await res.json()) as GenerateContentResponse;
    }

    async onboardUser(req: OnboardUserRequest): Promise<LongrunningOperationResponse> {
        const res = await this.callEndpoint('onboardUser', req);
        return (await res.json()) as LongrunningOperationResponse;
    }

    async loadCodeAssist(req: LoadCodeAssistRequest): Promise<LoadCodeAssistResponse> {
        const res = await this.callEndpoint('loadCodeAssist', req);
        return (await res.json()) as LoadCodeAssistResponse;
    }

    async countTokens(_req: CountTokensParameters): Promise<CountTokensResponse> {
        return { totalTokens: 0, };
    }

    async embedContent(_req: EmbedContentParameters): Promise<EmbedContentResponse> {
        throw Error();
    }

    async callEndpoint(method: string, req: object): Promise<Response> {
        const token = await this.auth.getAccessToken();
        const url = `${CCPA_ENDPOINT}/${CCPA_API_VERSION}:${method}`;
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