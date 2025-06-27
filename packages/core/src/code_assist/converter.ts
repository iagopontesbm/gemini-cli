/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Content,
  ContentListUnion,
  ContentUnion,
  GenerateContentConfig,
  GenerateContentParameters,
  CountTokensParameters,
  CountTokensResponse,
  GenerateContentResponse,
  GenerationConfigRoutingConfig,
  MediaResolution,
  Candidate,
  ModelSelectionConfig,
  GenerateContentResponsePromptFeedback,
  GenerateContentResponseUsageMetadata,
  Part,
  SafetySetting,
  PartUnion,
  SchemaUnion,
  SpeechConfigUnion,
  ThinkingConfig,
  ToolListUnion,
  ToolConfig,
} from '@google/genai';
import {
  GenerateContentRequest as GenericGenerateContentRequest,
  GenerateContentResponse as GenericGenerateContentResponse,
  CountTokensRequest as GenericCountTokensRequest,
  CountTokensResponse as GenericCountTokensResponse,
  EmbedContentRequest as GenericEmbedContentRequest,
  EmbedContentResponse as GenericEmbedContentResponse,
} from '../core/llmTypes.js';

export interface CAGenerateContentRequest {
  model: string;
  project?: string;
  request: VertexGenerateContentRequest;
}

interface VertexGenerateContentRequest {
  contents: Content[];
  systemInstruction?: Content;
  cachedContent?: string;
  tools?: ToolListUnion;
  toolConfig?: ToolConfig;
  labels?: Record<string, string>;
  safetySettings?: SafetySetting[];
  generationConfig?: VertexGenerationConfig;
}

interface VertexGenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  candidateCount?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  responseLogprobs?: boolean;
  logprobs?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  seed?: number;
  responseMimeType?: string;
  responseSchema?: SchemaUnion;
  routingConfig?: GenerationConfigRoutingConfig;
  modelSelectionConfig?: ModelSelectionConfig;
  responseModalities?: string[];
  mediaResolution?: MediaResolution;
  speechConfig?: SpeechConfigUnion;
  audioTimestamp?: boolean;
  thinkingConfig?: ThinkingConfig;
}

export interface CaGenerateContentResponse {
  response: VertexGenerateContentResponse;
}

interface VertexGenerateContentResponse {
  candidates: Candidate[];
  automaticFunctionCallingHistory?: Content[];
  promptFeedback?: GenerateContentResponsePromptFeedback;
  usageMetadata?: GenerateContentResponseUsageMetadata;
}
export interface CaCountTokenRequest {
  request: VertexCountTokenRequest;
}

interface VertexCountTokenRequest {
  model: string;
  contents: Content[];
}

export interface CaCountTokenResponse {
  totalTokens: number;
}

export function toCountTokenRequest(
  req: CountTokensParameters,
): CaCountTokenRequest {
  return {
    request: {
      model: 'models/' + req.model,
      contents: toContents(req.contents),
    },
  };
}

export function fromCountTokenResponse(
  res: CaCountTokenResponse,
): CountTokensResponse {
  return {
    totalTokens: res.totalTokens,
  };
}

export function toGenerateContentRequest(
  req: GenerateContentParameters,
  project?: string,
): CAGenerateContentRequest {
  return {
    model: req.model,
    project,
    request: toVertexGenerateContentRequest(req),
  };
}

export function fromGenerateContentResponse(
  res: CaGenerateContentResponse,
): GenerateContentResponse {
  const inres = res.response;
  const out = new GenerateContentResponse();
  out.candidates = inres.candidates;
  out.automaticFunctionCallingHistory = inres.automaticFunctionCallingHistory;
  out.promptFeedback = inres.promptFeedback;
  out.usageMetadata = inres.usageMetadata;
  return out;
}

// Adapter for generic GenerateContentRequest to CAGenerateContentRequest
export function toCAGenerateContentRequest(
  req: GenericGenerateContentRequest,
  project?: string,
): CAGenerateContentRequest {
  // TODO: Map more fields from GenericGenerateContentRequest to CAGenerateContentRequest
  // For now, we'll just pass the prompt as a single content item.
  return {
    model: 'gemini-pro', // Assuming a default model for now
    project,
    request: {
      contents: [{ role: 'user', parts: [{ text: req.prompt }] }],
      generationConfig: {
        maxOutputTokens: req.maxTokens,
        temperature: req.temperature,
        topK: req.topK,
        topP: req.topP,
      },
    },
  };
}

// Adapter for CaGenerateContentResponse to generic GenerateContentResponse
export function fromCaGenerateContentResponse(
  res: CaGenerateContentResponse,
): GenericGenerateContentResponse {
  // TODO: Map more fields from CaGenerateContentResponse to GenericGenerateContentResponse
  // For now, we'll just extract the text from the first candidate.
  const text =
    res.response.candidates && res.response.candidates.length > 0
      ? res.response.candidates[0].content?.parts?.[0]?.text ?? ''
      : '';
  return {
    text,
  };
}

// Adapter for generic CountTokensRequest to CaCountTokenRequest
export function toCaCountTokenRequest(
  req: GenericCountTokensRequest,
): CaCountTokenRequest {
  return {
    request: {
      model: 'models/gemini-pro', // Assuming a default model for now
      contents: [{ role: 'user', parts: [{ text: req.prompt }] }],
    },
  };
}

// Adapter for CaCountTokenResponse to generic CountTokensResponse
export function fromCaCountTokenResponse(
  res: CaCountTokenResponse,
): GenericCountTokensResponse {
  return {
    tokenCount: res.totalTokens,
  };
}

// Placeholder adapters for EmbedContent (not yet implemented in CodeAssistServer)
export function toCaEmbedContentRequest(
  req: GenericEmbedContentRequest,
): any {
  // TODO: Implement mapping
  throw new Error('Not implemented');
}

export function fromCaEmbedContentResponse(res: any): GenericEmbedContentResponse {
  // TODO: Implement mapping
  throw new Error('Not implemented');
}

function toVertexGenerateContentRequest(
  req: GenerateContentParameters,
): VertexGenerateContentRequest {
  return {
    contents: toContents(req.contents),
    systemInstruction: maybeToContent(req.config?.systemInstruction),
    cachedContent: req.config?.cachedContent,
    tools: req.config?.tools,
    toolConfig: req.config?.toolConfig,
    labels: req.config?.labels,
    safetySettings: req.config?.safetySettings,
    generationConfig: toVertexGenerationConfig(req.config),
  };
}

function toContents(contents: ContentListUnion): Content[] {
  if (Array.isArray(contents)) {
    // it's a Content[] or a PartsUnion[]
    return contents.map(toContent);
  }
  // it's a Content or a PartsUnion
  return [toContent(contents)];
}

function maybeToContent(content?: ContentUnion): Content | undefined {
  if (!content) {
    return undefined;
  }
  return toContent(content);
}

function toContent(content: ContentUnion): Content {
  if (Array.isArray(content)) {
    // it's a PartsUnion[]
    return {
      role: 'user',
      parts: toParts(content),
    };
  }
  if (typeof content === 'string') {
    // it's a string
    return {
      role: 'user',
      parts: [{ text: content }],
    };
  }
  if ('parts' in content) {
    // it's a Content
    return content;
  }
  // it's a Part
  return {
    role: 'user',
    parts: [content as Part],
  };
}

function toParts(parts: PartUnion[]): Part[] {
  return parts.map(toPart);
}

function toPart(part: PartUnion): Part {
  if (typeof part === 'string') {
    // it's a string
    return { text: part };
  }
  return part;
}

function toVertexGenerationConfig(
  config?: GenerateContentConfig,
): VertexGenerationConfig | undefined {
  if (!config) {
    return undefined;
  }
  return {
    temperature: config.temperature,
    topP: config.topP,
    topK: config.topK,
    candidateCount: config.candidateCount,
    maxOutputTokens: config.maxOutputTokens,
    stopSequences: config.stopSequences,
    responseLogprobs: config.responseLogprobs,
    logprobs: config.logprobs,
    presencePenalty: config.presencePenalty,
    frequencyPenalty: config.frequencyPenalty,
    seed: config.seed,
    responseMimeType: config.responseMimeType,
    responseSchema: config.responseSchema,
    routingConfig: config.routingConfig,
    modelSelectionConfig: config.modelSelectionConfig,
    responseModalities: config.responseModalities,
    mediaResolution: config.mediaResolution,
    speechConfig: config.speechConfig,
    audioTimestamp: config.audioTimestamp,
    thinkingConfig: config.thinkingConfig,
  };
}
