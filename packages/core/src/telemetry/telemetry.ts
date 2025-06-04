/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DiagConsoleLogger,
  DiagLogLevel,
  diag,
  metrics,
  Attributes,
  ValueType,
  Meter,
  Counter,
  Histogram,
} from '@opentelemetry/api';
import { logs, LogRecord } from '@opentelemetry/api-logs';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  SemanticResourceAttributes,
  SemanticAttributes,
} from '@opentelemetry/semantic-conventions';
import { Resource } from '@opentelemetry/resources';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
} from '@opentelemetry/sdk-trace-node';
import {
  BatchLogRecordProcessor,
  ConsoleLogRecordExporter,
} from '@opentelemetry/sdk-logs';
import {
  ConsoleMetricExporter,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { randomUUID } from 'crypto';
import { Config } from '../config/config.js';

// For troubleshooting, set the log level to DiagLogLevel.DEBUG
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

const SERVICE_NAME = 'gemini-cli';
export const sessionId = randomUUID();

let sdk: NodeSDK | undefined;
let isTelemetryInitialized = false;
let cliMeter: Meter | undefined;

let toolCallCounter: Counter | undefined;
let toolCallDurationHistogram: Histogram | undefined;
let apiRequestCounter: Counter | undefined;
let apiRequestDurationHistogram: Histogram | undefined;
let apiPromptTokenHistogram: Histogram | undefined;

export interface UserPromptEvent {
  'event.name': 'user_prompt';
  'event.timestamp': string; // ISO 8601
  prompt_char_count: number;
  prompt?: string;
}

export interface ToolCallEvent {
  'event.name': 'tool_call';
  'event.timestamp': string; // ISO 8601
  function_name: string;
  function_args: Record<string, unknown>;
  duration_ms: number;
  success: boolean;
  error?: string;
  error_type?: string;
}

export interface ApiRequestEvent {
  'event.name': 'api_request';
  'event.timestamp': string; // ISO 8601
  model: string;
  duration_ms: number;
  prompt_token_count: number;
}

export interface ApiErrorEvent {
  'event.name': 'api_error';
  'event.timestamp': string; // ISO 8601
  model: string;
  error: string;
  error_type?: string;
  status_code?: number | string;
  duration_ms: number;
  attempt: number;
}

export interface ApiResponseEvent {
  'event.name': 'api_response';
  'event.timestamp': string; // ISO 8601
  model: string;
  status_code?: number | string;
  duration_ms: number;
  error?: string;
  attempt: number;
}

export interface CliConfigEvent {
  'event.name': 'cli_config';
  'event.timestamp': string; // ISO 8601
  model: string;
  sandbox_enabled: boolean;
  core_tools_enabled: string;
  approval_mode: string;
  vertex_ai_enabled: boolean;
  log_user_prompts_enabled: boolean;
  file_filtering_respect_git_ignore: boolean;
  file_filtering_allow_build_artifacts: boolean;
}

export type TelemetryEvent =
  | UserPromptEvent
  | ToolCallEvent
  | ApiRequestEvent
  | ApiErrorEvent
  | ApiResponseEvent
  | CliConfigEvent;

const EVENT_USER_PROMPT = 'gemini_cli.user_prompt';
const EVENT_TOOL_CALL = 'gemini_cli.tool_call';
const EVENT_API_REQUEST = 'gemini_cli.api_request';
const EVENT_API_ERROR = 'gemini_cli.api_error';
const EVENT_API_RESPONSE = 'gemini_cli.api_response';
const EVENT_CLI_CONFIG = 'gemini_cli.config';

function parseGrpcEndpoint(
  otlpEndpointSetting: string | undefined,
): string | undefined {
  if (!otlpEndpointSetting) {
    return undefined;
  }
  // Trim leading/trailing quotes that might come from env variables
  const trimmedEndpoint = otlpEndpointSetting.replace(/^["']|["']$/g, '');

  try {
    const url = new URL(trimmedEndpoint);
    // OTLP gRPC exporters expect an endpoint in the format scheme://host:port
    // The `origin` property provides this, stripping any path, query, or hash.
    return url.origin;
  } catch (error) {
    // Log the error for debugging, but return undefined as the URL is invalid.
    diag.error(
      'Invalid OTLP endpoint URL provided:',
      trimmedEndpoint,
      error,
    );
    return undefined;
  }
}

export function initializeTelemetry(config: Config): void {
  if (isTelemetryInitialized || !config.getTelemetryEnabled()) {
    return;
  }

  const geminiCliVersion = config.getUserAgent() || 'unknown';
  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
    [SemanticResourceAttributes.SERVICE_VERSION]: geminiCliVersion,
    'session.id': sessionId,
  });

  const otlpEndpoint = config.getTelemetryOtlpEndpoint();
  const grpcParsedEndpoint = parseGrpcEndpoint(otlpEndpoint);
  const useOtlp = !!grpcParsedEndpoint;

  const spanExporter = useOtlp
    ? new OTLPTraceExporter({ url: grpcParsedEndpoint })
    : new ConsoleSpanExporter();
  const logExporter = useOtlp
    ? new OTLPLogExporter({ url: grpcParsedEndpoint })
    : new ConsoleLogRecordExporter();
  const metricReader = useOtlp
    ? new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: grpcParsedEndpoint }),
        exportIntervalMillis: 10000,
      })
    : new PeriodicExportingMetricReader({
        exporter: new ConsoleMetricExporter(),
        exportIntervalMillis: 10000,
      });

  sdk = new NodeSDK({
    resource,
    spanProcessors: [new BatchSpanProcessor(spanExporter)],
    logRecordProcessor: new BatchLogRecordProcessor(logExporter),
    metricReader,
    instrumentations: [new HttpInstrumentation()],
  });

  try {
    sdk.start();
    console.log('OpenTelemetry SDK started successfully.');
    isTelemetryInitialized = true;
    cliMeter = getMeter();

    toolCallCounter = cliMeter.createCounter('gemini_cli.tool.call.count', {
      description: 'Counts tool calls, tagged by function name and success.',
      valueType: ValueType.INT,
    });
    toolCallDurationHistogram = cliMeter.createHistogram(
      'gemini_cli.tool.call.duration',
      {
        description: 'Duration of tool calls in milliseconds.',
        unit: 'ms',
        valueType: ValueType.INT,
      },
    );
    apiRequestCounter = cliMeter.createCounter('gemini_cli.api.request.count', {
      description: 'Counts API requests, tagged by model and status.',
      valueType: ValueType.INT,
    });
    apiRequestDurationHistogram = cliMeter.createHistogram(
      'gemini_cli.api.request.duration',
      {
        description: 'Duration of API requests in milliseconds.',
        unit: 'ms',
        valueType: ValueType.INT,
      },
    );
    apiPromptTokenHistogram = cliMeter.createHistogram(
      'gemini_cli.api.token.prompt_count',
      {
        description: 'Number of tokens in API prompts.',
        valueType: ValueType.INT,
      },
    );

    const sessionCounter = cliMeter.createCounter('gemini_cli.session.count', {
      description: 'Count of CLI sessions started.',
      valueType: ValueType.INT,
    });
    sessionCounter.add(1);

    logCliConfiguration(config);
  } catch (error) {
    console.error('Error starting OpenTelemetry SDK:', error);
  }

  process.on('SIGTERM', shutdownTelemetry);
  process.on('SIGINT', shutdownTelemetry);
}

export async function shutdownTelemetry(): Promise<void> {
  if (!isTelemetryInitialized || !sdk) {
    return;
  }
  try {
    await sdk.shutdown();
    console.log('OpenTelemetry SDK shut down successfully.');
  } catch (error) {
    console.error('Error shutting down SDK:', error);
  } finally {
    isTelemetryInitialized = false;
  }
}

const getMeter = () => metrics.getMeter(SERVICE_NAME);

const shouldLogUserPrompts = (config: Config): boolean =>
  config.getTelemetryLogUserPromptsEnabled() ?? false;

export function logCliConfiguration(config: Config): void {
  if (!isTelemetryInitialized) return;

  const attributes: Attributes = {
    'event.name': EVENT_CLI_CONFIG,
    'event.timestamp': new Date().toISOString(),
    model: config.getModel(),
    sandbox_enabled:
      typeof config.getSandbox() === 'string' ? true : config.getSandbox(),
    core_tools_enabled: (config.getCoreTools() ?? []).join(','),
    approval_mode: config.getApprovalMode(),
    vertex_ai_enabled: config.getVertexAI() ?? false,
    log_user_prompts_enabled: config.getTelemetryLogUserPromptsEnabled(),
    file_filtering_respect_git_ignore:
      config.getFileFilteringRespectGitIgnore(),
    file_filtering_allow_build_artifacts:
      config.getFileFilteringAllowBuildArtifacts(),
  };
  const logger = logs.getLogger(SERVICE_NAME);
  const logRecord: LogRecord = {
    body: 'CLI configuration loaded.',
    attributes,
  };
  logger.emit(logRecord);
}

export function logUserPrompt(
  config: Config,
  event: Omit<UserPromptEvent, 'event.name' | 'event.timestamp' | 'prompt'> & {
    prompt: string;
  },
): void {
  const { prompt, ...restOfEventArgs } = event;
  const attributes: Attributes = {
    ...restOfEventArgs,
    'event.name': EVENT_USER_PROMPT,
    'event.timestamp': new Date().toISOString(),
  };
  if (shouldLogUserPrompts(config)) {
    attributes.prompt = prompt;
  }
  const logger = logs.getLogger(SERVICE_NAME);
  const logRecord: LogRecord = {
    body: `User prompt. Length: ${event.prompt_char_count}`,
    attributes,
  };
  logger.emit(logRecord);
}

export function logToolCall(
  event: Omit<ToolCallEvent, 'event.name' | 'event.timestamp'>,
): void {
  const attributes: Attributes = {
    ...event,
    'event.name': EVENT_TOOL_CALL,
    'event.timestamp': new Date().toISOString(),
    function_args: JSON.stringify(event.function_args),
  };
  if (event.error) {
    attributes['error.message'] = event.error;
    if (event.error_type) {
      attributes['error.type'] = event.error_type;
    }
  }
  const logger = logs.getLogger(SERVICE_NAME);
  const logRecord: LogRecord = {
    body: `Tool call: ${event.function_name}. Success: ${event.success}. Duration: ${event.duration_ms}ms.`,
    attributes,
  };
  logger.emit(logRecord);

  if (toolCallCounter && toolCallDurationHistogram) {
    const metricAttributes: Attributes = {
      function_name: event.function_name,
      success: event.success,
    };
    toolCallCounter.add(1, metricAttributes);
    toolCallDurationHistogram.record(event.duration_ms, {
      function_name: event.function_name,
    });
  }
}

export function logApiRequest(
  event: Omit<ApiRequestEvent, 'event.name' | 'event.timestamp'>,
): void {
  const attributes: Attributes = {
    ...event,
    'event.name': EVENT_API_REQUEST,
    'event.timestamp': new Date().toISOString(),
  };
  const logger = logs.getLogger(SERVICE_NAME);
  const logRecord: LogRecord = {
    body: `API request to ${event.model}. Tokens: ${event.prompt_token_count}.`,
    attributes,
  };
  logger.emit(logRecord);

  if (apiPromptTokenHistogram) {
    apiPromptTokenHistogram.record(event.prompt_token_count, {
      model: event.model,
    });
  }
}

export function logApiError(
  event: Omit<ApiErrorEvent, 'event.name' | 'event.timestamp'>,
): void {
  const attributes: Attributes = {
    ...event,
    'event.name': EVENT_API_ERROR,
    'event.timestamp': new Date().toISOString(),
    ['error.message']: event.error,
  };
  if (event.error_type) {
    attributes['error.type'] = event.error_type;
  }
  if (typeof event.status_code === 'number' && event.status_code >= 400) {
    attributes[SemanticAttributes.HTTP_STATUS_CODE] = event.status_code;
  } else if (typeof event.status_code === 'number') {
    attributes['rpc.grpc.status_code'] = event.status_code;
  }

  const logger = logs.getLogger(SERVICE_NAME);
  const logRecord: LogRecord = {
    body: `API error for ${event.model}. Error: ${event.error}. Duration: ${event.duration_ms}ms.`,
    attributes,
  };
  logger.emit(logRecord);

  if (apiRequestCounter && apiRequestDurationHistogram) {
    const metricAttributes: Attributes = {
      model: event.model,
      status_code: event.status_code ?? 'error',
      error_type: event.error_type ?? 'unknown',
    };
    apiRequestCounter.add(1, metricAttributes);
    apiRequestDurationHistogram.record(event.duration_ms, {
      model: event.model,
    });
  }
}

export function logApiResponse(
  event: Omit<ApiResponseEvent, 'event.name' | 'event.timestamp'>,
): void {
  const attributes: Attributes = {
    ...event,
    'event.name': EVENT_API_RESPONSE,
    'event.timestamp': new Date().toISOString(),
  };
  if (event.error) {
    attributes['error.message'] = event.error;
  } else if (event.status_code) {
    if (typeof event.status_code === 'number' && event.status_code >= 400) {
      attributes[SemanticAttributes.HTTP_STATUS_CODE] = event.status_code;
    } else if (typeof event.status_code === 'number') {
      attributes[SemanticAttributes.HTTP_STATUS_CODE] = event.status_code;
    }
  }

  const logger = logs.getLogger(SERVICE_NAME);
  const logRecord: LogRecord = {
    body: `API response from ${event.model}. Status: ${event.status_code || 'N/A'}. Duration: ${event.duration_ms}ms.`,
    attributes,
  };
  logger.emit(logRecord);

  if (apiRequestCounter && apiRequestDurationHistogram) {
    const metricAttributes: Attributes = {
      model: event.model,
      status_code: event.status_code ?? (event.error ? 'error' : 'ok'),
    };
    apiRequestCounter.add(1, metricAttributes);
    apiRequestDurationHistogram.record(event.duration_ms, {
      model: event.model,
    });
  }
}

export { SpanStatusCode, ValueType } from '@opentelemetry/api';
export { SemanticAttributes } from '@opentelemetry/semantic-conventions';
