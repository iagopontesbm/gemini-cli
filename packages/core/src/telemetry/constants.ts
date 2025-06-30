/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export const SERVICE_NAME = 'gemini-cli';

export const EVENT_USER_PROMPT = 'gemini_cli.user_prompt';
export const EVENT_TOOL_CALL = 'gemini_cli.tool_call';
export const EVENT_API_REQUEST = 'gemini_cli.api_request';
export const EVENT_API_ERROR = 'gemini_cli.api_error';
export const EVENT_API_RESPONSE = 'gemini_cli.api_response';
export const EVENT_CLI_CONFIG = 'gemini_cli.config';

export const METRIC_TOOL_CALL_COUNT = 'gemini_cli.tool.call.count';
export const METRIC_TOOL_CALL_LATENCY = 'gemini_cli.tool.call.latency';
export const METRIC_API_REQUEST_COUNT = 'gemini_cli.api.request.count';
export const METRIC_API_REQUEST_LATENCY = 'gemini_cli.api.request.latency';
export const METRIC_TOKEN_USAGE = 'gemini_cli.token.usage';
export const METRIC_SESSION_COUNT = 'gemini_cli.session.count';
export const METRIC_FILE_OPERATION_COUNT = 'gemini_cli.file.operation.count';

// Performance Monitoring Metrics
export const METRIC_STARTUP_TIME = 'gemini_cli.startup.duration';
export const METRIC_MEMORY_USAGE = 'gemini_cli.memory.usage';
export const METRIC_MEMORY_HEAP_USED = 'gemini_cli.memory.heap.used';
export const METRIC_MEMORY_HEAP_TOTAL = 'gemini_cli.memory.heap.total';
export const METRIC_MEMORY_EXTERNAL = 'gemini_cli.memory.external';
export const METRIC_MEMORY_RSS = 'gemini_cli.memory.rss';
export const METRIC_CPU_USAGE = 'gemini_cli.cpu.usage';
export const METRIC_TOOL_QUEUE_DEPTH = 'gemini_cli.tool.queue.depth';
export const METRIC_TOOL_EXECUTION_BREAKDOWN =
  'gemini_cli.tool.execution.breakdown';
export const METRIC_TOKEN_EFFICIENCY = 'gemini_cli.token.efficiency';
export const METRIC_API_REQUEST_BREAKDOWN = 'gemini_cli.api.request.breakdown';
export const METRIC_PERFORMANCE_SCORE = 'gemini_cli.performance.score';
export const METRIC_REGRESSION_DETECTION = 'gemini_cli.performance.regression';
export const METRIC_BASELINE_COMPARISON =
  'gemini_cli.performance.baseline.comparison';

// Performance Events
export const EVENT_STARTUP_PERFORMANCE = 'gemini_cli.startup.performance';
export const EVENT_MEMORY_USAGE = 'gemini_cli.memory.usage';
export const EVENT_PERFORMANCE_BASELINE = 'gemini_cli.performance.baseline';
export const EVENT_PERFORMANCE_REGRESSION = 'gemini_cli.performance.regression';
