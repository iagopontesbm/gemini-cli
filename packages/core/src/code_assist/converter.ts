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

declare interface VertexRequest {
  contents: Content[];
  systemInstruction?: Content;
  cachedContent?: string;
  tools?: ToolListUnion;
  toolConfig?: ToolConfig;
  labels?: Record<string, string>
  safetySettings?: SafetySetting[];
  generationConfig: VertexGenerationConfig;
}

declare interface VertexGenerationConfig {
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

declare interface VertexResponse {
  candidates: Candidate[];
  automaticFunctionCallingHistory?: Content[];
  promptFeedback?: GenerateContentResponsePromptFeedback;
  usageMetadata?: GenerateContentResponseUsageMetadata;
}

export function toCcpaRequest(req: GenerateContentParameters, project?: string): Object {
  return {
    model: req.model,
    project: project,
    request: toVertexRequest(req),
  };
}

export function fromCcpaResponse(res: Object): GenerateContentResponse {
  if ('response' in res) {
    return fromVertexResponse(res.response as Object);
  }
  throw new Error("no response field in ccpa response");
}


export function fromVertexResponse(res: Object): GenerateContentResponse {
  const vres = res as VertexResponse;
  const resp = new GenerateContentResponse();
  resp.candidates = vres.candidates;
  resp.automaticFunctionCallingHistory = vres.automaticFunctionCallingHistory;
  resp.promptFeedback = vres.promptFeedback;
  resp.usageMetadata = vres.usageMetadata;
  return resp;
}


export function toVertexRequest(req: GenerateContentParameters): VertexRequest {
  return {
    contents: toVertexContents(req.contents),
    systemInstruction: maybeToVertexContent(req.config?.systemInstruction),
    cachedContent: req.config?.cachedContent,
    tools: req.config?.tools,
    toolConfig: req.config?.toolConfig,
    labels: req.config?.labels,
    safetySettings: req.config?.safetySettings,
    generationConfig: toVertexGenerationConfig(req.config),
  };
}

function toVertexContents(contents: ContentListUnion): Content[] {
  if (Array.isArray(contents)) {
    // it's a Content[] or a PartsUnion[]
    return contents.map(toVertexContent);
  }
  // it's a Content or a PartsUnion
  return [toVertexContent(contents)];
}

function maybeToVertexContent(content?: ContentUnion): Content | undefined {
  if (!content) {
    return undefined;
  }
  return toVertexContent(content);
}

function toVertexContent(content: ContentUnion): Content {
  if (Array.isArray(content)) {
    // it's a PartsUnion[]
    return {
      role: 'user',
      parts: toVertexParts(content),
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

function toVertexParts(parts: PartUnion[]): Part[] {
  return parts.map(toVertexPart);
}

function toVertexPart(part: PartUnion): Part {
  if (typeof part === 'string') {
    // it's a string
    return { text: part };
  }
  return part;
}

function toVertexGenerationConfig(
  config?: GenerateContentConfig,
): VertexGenerationConfig {
  if (!config) {
    return {};
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
