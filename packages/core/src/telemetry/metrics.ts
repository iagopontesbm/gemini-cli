/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  metrics,
  Attributes,
  ValueType,
  Meter,
  Counter,
  Histogram,
} from '@opentelemetry/api';
import {
  SERVICE_NAME,
  METRIC_TOOL_CALL_COUNT,
  METRIC_TOOL_CALL_LATENCY,
  METRIC_API_REQUEST_COUNT,
  METRIC_API_REQUEST_LATENCY,
  METRIC_TOKEN_USAGE,
  METRIC_SESSION_COUNT,
  METRIC_FILE_OPERATION_COUNT,
  // Performance Monitoring Metrics
  METRIC_STARTUP_TIME,
  METRIC_MEMORY_USAGE,
  METRIC_MEMORY_HEAP_USED,
  METRIC_MEMORY_HEAP_TOTAL,
  METRIC_MEMORY_EXTERNAL,
  METRIC_MEMORY_RSS,
  METRIC_CPU_USAGE,
  METRIC_TOOL_QUEUE_DEPTH,
  METRIC_TOOL_EXECUTION_BREAKDOWN,
  METRIC_TOKEN_EFFICIENCY,
  METRIC_API_REQUEST_BREAKDOWN,
  METRIC_PERFORMANCE_SCORE,
  METRIC_REGRESSION_DETECTION,
  METRIC_BASELINE_COMPARISON,
} from './constants.js';
import { Config } from '../config/config.js';

export enum FileOperation {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
}

export enum PerformanceMetricType {
  STARTUP = 'startup',
  MEMORY = 'memory',
  CPU = 'cpu',
  TOOL_EXECUTION = 'tool_execution',
  API_REQUEST = 'api_request',
  TOKEN_EFFICIENCY = 'token_efficiency',
}

export enum MemoryMetricType {
  HEAP_USED = 'heap_used',
  HEAP_TOTAL = 'heap_total',
  EXTERNAL = 'external',
  RSS = 'rss',
}

export enum ToolExecutionPhase {
  VALIDATION = 'validation',
  PREPARATION = 'preparation',
  EXECUTION = 'execution',
  RESULT_PROCESSING = 'result_processing',
}

export enum ApiRequestPhase {
  REQUEST_PREPARATION = 'request_preparation',
  NETWORK_LATENCY = 'network_latency',
  RESPONSE_PROCESSING = 'response_processing',
  TOKEN_PROCESSING = 'token_processing',
}

let cliMeter: Meter | undefined;
let toolCallCounter: Counter | undefined;
let toolCallLatencyHistogram: Histogram | undefined;
let apiRequestCounter: Counter | undefined;
let apiRequestLatencyHistogram: Histogram | undefined;
let tokenUsageCounter: Counter | undefined;
let fileOperationCounter: Counter | undefined;

// Performance Monitoring Metrics
let startupTimeHistogram: Histogram | undefined;
let memoryUsageGauge: Histogram | undefined; // Using Histogram until ObservableGauge is available
let memoryHeapUsedGauge: Histogram | undefined;
let memoryHeapTotalGauge: Histogram | undefined;
let memoryExternalGauge: Histogram | undefined;
let memoryRssGauge: Histogram | undefined;
let cpuUsageGauge: Histogram | undefined;
let toolQueueDepthGauge: Histogram | undefined;
let toolExecutionBreakdownHistogram: Histogram | undefined;
let tokenEfficiencyHistogram: Histogram | undefined;
let apiRequestBreakdownHistogram: Histogram | undefined;
let performanceScoreGauge: Histogram | undefined;
let regressionDetectionCounter: Counter | undefined;
let baselineComparisonHistogram: Histogram | undefined;

let isMetricsInitialized = false;
let isPerformanceMonitoringEnabled = false;

function getCommonAttributes(config: Config): Attributes {
  return {
    'session.id': config.getSessionId(),
  };
}

export function getMeter(): Meter | undefined {
  if (!cliMeter) {
    cliMeter = metrics.getMeter(SERVICE_NAME);
  }
  return cliMeter;
}

export function initializeMetrics(config: Config): void {
  if (isMetricsInitialized) return;

  const meter = getMeter();
  if (!meter) return;

  // Initialize core metrics
  toolCallCounter = meter.createCounter(METRIC_TOOL_CALL_COUNT, {
    description: 'Counts tool calls, tagged by function name and success.',
    valueType: ValueType.INT,
  });
  toolCallLatencyHistogram = meter.createHistogram(METRIC_TOOL_CALL_LATENCY, {
    description: 'Latency of tool calls in milliseconds.',
    unit: 'ms',
    valueType: ValueType.INT,
  });
  apiRequestCounter = meter.createCounter(METRIC_API_REQUEST_COUNT, {
    description: 'Counts API requests, tagged by model and status.',
    valueType: ValueType.INT,
  });
  apiRequestLatencyHistogram = meter.createHistogram(
    METRIC_API_REQUEST_LATENCY,
    {
      description: 'Latency of API requests in milliseconds.',
      unit: 'ms',
      valueType: ValueType.INT,
    },
  );
  tokenUsageCounter = meter.createCounter(METRIC_TOKEN_USAGE, {
    description: 'Counts the total number of tokens used.',
    valueType: ValueType.INT,
  });
  fileOperationCounter = meter.createCounter(METRIC_FILE_OPERATION_COUNT, {
    description: 'Counts file operations (create, read, update).',
    valueType: ValueType.INT,
  });
  const sessionCounter = meter.createCounter(METRIC_SESSION_COUNT, {
    description: 'Count of CLI sessions started.',
    valueType: ValueType.INT,
  });
  sessionCounter.add(1, getCommonAttributes(config));

  // Initialize performance monitoring metrics if enabled
  initializePerformanceMonitoring(config);

  isMetricsInitialized = true;
}

export function recordToolCallMetrics(
  config: Config,
  functionName: string,
  durationMs: number,
  success: boolean,
  decision?: 'accept' | 'reject' | 'modify',
): void {
  if (!toolCallCounter || !toolCallLatencyHistogram || !isMetricsInitialized)
    return;

  const metricAttributes: Attributes = {
    ...getCommonAttributes(config),
    function_name: functionName,
    success,
    decision,
  };
  toolCallCounter.add(1, metricAttributes);
  toolCallLatencyHistogram.record(durationMs, {
    ...getCommonAttributes(config),
    function_name: functionName,
  });
}

export function recordTokenUsageMetrics(
  config: Config,
  model: string,
  tokenCount: number,
  type: 'input' | 'output' | 'thought' | 'cache' | 'tool',
): void {
  if (!tokenUsageCounter || !isMetricsInitialized) return;
  tokenUsageCounter.add(tokenCount, {
    ...getCommonAttributes(config),
    model,
    type,
  });
}

export function recordApiResponseMetrics(
  config: Config,
  model: string,
  durationMs: number,
  statusCode?: number | string,
  error?: string,
): void {
  if (
    !apiRequestCounter ||
    !apiRequestLatencyHistogram ||
    !isMetricsInitialized
  )
    return;
  const metricAttributes: Attributes = {
    ...getCommonAttributes(config),
    model,
    status_code: statusCode ?? (error ? 'error' : 'ok'),
  };
  apiRequestCounter.add(1, metricAttributes);
  apiRequestLatencyHistogram.record(durationMs, {
    ...getCommonAttributes(config),
    model,
  });
}

export function recordApiErrorMetrics(
  config: Config,
  model: string,
  durationMs: number,
  statusCode?: number | string,
  errorType?: string,
): void {
  if (
    !apiRequestCounter ||
    !apiRequestLatencyHistogram ||
    !isMetricsInitialized
  )
    return;
  const metricAttributes: Attributes = {
    ...getCommonAttributes(config),
    model,
    status_code: statusCode ?? 'error',
    error_type: errorType ?? 'unknown',
  };
  apiRequestCounter.add(1, metricAttributes);
  apiRequestLatencyHistogram.record(durationMs, {
    ...getCommonAttributes(config),
    model,
  });
}

export function recordFileOperationMetric(
  config: Config,
  operation: FileOperation,
  lines?: number,
  mimetype?: string,
  extension?: string,
): void {
  if (!fileOperationCounter || !isMetricsInitialized) return;
  const attributes: Attributes = {
    ...getCommonAttributes(config),
    operation,
  };
  if (lines !== undefined) attributes.lines = lines;
  if (mimetype !== undefined) attributes.mimetype = mimetype;
  if (extension !== undefined) attributes.extension = extension;
  fileOperationCounter.add(1, attributes);
}

// Performance Monitoring Functions

export function initializePerformanceMonitoring(config: Config): void {
  const meter = getMeter();
  if (!meter) return;

  // Check if performance monitoring is enabled in config
  // For now, enable performance monitoring when telemetry is enabled
  // TODO: Add specific performance monitoring settings to config
  isPerformanceMonitoringEnabled = config.getTelemetryEnabled();

  if (!isPerformanceMonitoringEnabled) return;

  // Initialize startup time histogram
  startupTimeHistogram = meter.createHistogram(METRIC_STARTUP_TIME, {
    description:
      'CLI startup time in milliseconds, broken down by initialization phase.',
    unit: 'ms',
    valueType: ValueType.INT,
  });

  // Initialize memory usage histograms (using histograms for now, will upgrade to gauges when available)
  memoryUsageGauge = meter.createHistogram(METRIC_MEMORY_USAGE, {
    description: 'Memory usage in bytes.',
    unit: 'bytes',
    valueType: ValueType.INT,
  });

  memoryHeapUsedGauge = meter.createHistogram(METRIC_MEMORY_HEAP_USED, {
    description: 'Heap memory used in bytes.',
    unit: 'bytes',
    valueType: ValueType.INT,
  });

  memoryHeapTotalGauge = meter.createHistogram(METRIC_MEMORY_HEAP_TOTAL, {
    description: 'Total heap memory in bytes.',
    unit: 'bytes',
    valueType: ValueType.INT,
  });

  memoryExternalGauge = meter.createHistogram(METRIC_MEMORY_EXTERNAL, {
    description: 'External memory in bytes.',
    unit: 'bytes',
    valueType: ValueType.INT,
  });

  memoryRssGauge = meter.createHistogram(METRIC_MEMORY_RSS, {
    description: 'Resident Set Size (RSS) memory in bytes.',
    unit: 'bytes',
    valueType: ValueType.INT,
  });

  // Initialize CPU usage histogram
  cpuUsageGauge = meter.createHistogram(METRIC_CPU_USAGE, {
    description: 'CPU usage percentage.',
    unit: 'percent',
    valueType: ValueType.DOUBLE,
  });

  // Initialize tool queue depth histogram
  toolQueueDepthGauge = meter.createHistogram(METRIC_TOOL_QUEUE_DEPTH, {
    description: 'Number of tools in execution queue.',
    valueType: ValueType.INT,
  });

  // Initialize performance breakdowns
  toolExecutionBreakdownHistogram = meter.createHistogram(
    METRIC_TOOL_EXECUTION_BREAKDOWN,
    {
      description: 'Tool execution time breakdown by phase in milliseconds.',
      unit: 'ms',
      valueType: ValueType.INT,
    },
  );

  tokenEfficiencyHistogram = meter.createHistogram(METRIC_TOKEN_EFFICIENCY, {
    description:
      'Token efficiency metrics (tokens per operation, cache hit rate, etc.).',
    valueType: ValueType.DOUBLE,
  });

  apiRequestBreakdownHistogram = meter.createHistogram(
    METRIC_API_REQUEST_BREAKDOWN,
    {
      description: 'API request time breakdown by phase in milliseconds.',
      unit: 'ms',
      valueType: ValueType.INT,
    },
  );

  // Initialize performance score and regression detection
  performanceScoreGauge = meter.createHistogram(METRIC_PERFORMANCE_SCORE, {
    description: 'Composite performance score (0-100).',
    unit: 'score',
    valueType: ValueType.DOUBLE,
  });

  regressionDetectionCounter = meter.createCounter(
    METRIC_REGRESSION_DETECTION,
    {
      description: 'Performance regression detection events.',
      valueType: ValueType.INT,
    },
  );

  baselineComparisonHistogram = meter.createHistogram(
    METRIC_BASELINE_COMPARISON,
    {
      description:
        'Performance comparison to established baseline (percentage change).',
      unit: 'percent',
      valueType: ValueType.DOUBLE,
    },
  );
}

export function recordStartupPerformance(
  config: Config,
  phase: string,
  durationMs: number,
  details?: Record<string, string | number | boolean>,
): void {
  if (!startupTimeHistogram || !isPerformanceMonitoringEnabled) return;

  const attributes: Attributes = {
    ...getCommonAttributes(config),
    phase,
    ...details,
  };

  startupTimeHistogram.record(durationMs, attributes);
}

export function recordMemoryUsage(
  config: Config,
  memoryType: MemoryMetricType,
  bytes: number,
  component?: string,
): void {
  if (!isPerformanceMonitoringEnabled) return;

  const attributes: Attributes = {
    ...getCommonAttributes(config),
    memory_type: memoryType,
    component,
  };

  switch (memoryType) {
    case MemoryMetricType.HEAP_USED:
      memoryHeapUsedGauge?.record(bytes, attributes);
      break;
    case MemoryMetricType.HEAP_TOTAL:
      memoryHeapTotalGauge?.record(bytes, attributes);
      break;
    case MemoryMetricType.EXTERNAL:
      memoryExternalGauge?.record(bytes, attributes);
      break;
    case MemoryMetricType.RSS:
      memoryRssGauge?.record(bytes, attributes);
      break;
    default:
      memoryUsageGauge?.record(bytes, attributes);
  }
}

export function recordCpuUsage(
  config: Config,
  percentage: number,
  component?: string,
): void {
  if (!cpuUsageGauge || !isPerformanceMonitoringEnabled) return;

  const attributes: Attributes = {
    ...getCommonAttributes(config),
    component,
  };

  cpuUsageGauge.record(percentage, attributes);
}

export function recordToolQueueDepth(config: Config, queueDepth: number): void {
  if (!toolQueueDepthGauge || !isPerformanceMonitoringEnabled) return;

  const attributes: Attributes = {
    ...getCommonAttributes(config),
  };

  toolQueueDepthGauge.record(queueDepth, attributes);
}

export function recordToolExecutionBreakdown(
  config: Config,
  functionName: string,
  phase: ToolExecutionPhase,
  durationMs: number,
): void {
  if (!toolExecutionBreakdownHistogram || !isPerformanceMonitoringEnabled)
    return;

  const attributes: Attributes = {
    ...getCommonAttributes(config),
    function_name: functionName,
    phase,
  };

  toolExecutionBreakdownHistogram.record(durationMs, attributes);
}

export function recordTokenEfficiency(
  config: Config,
  model: string,
  metric: string,
  value: number,
  context?: string,
): void {
  if (!tokenEfficiencyHistogram || !isPerformanceMonitoringEnabled) return;

  const attributes: Attributes = {
    ...getCommonAttributes(config),
    model,
    metric,
    context,
  };

  tokenEfficiencyHistogram.record(value, attributes);
}

export function recordApiRequestBreakdown(
  config: Config,
  model: string,
  phase: ApiRequestPhase,
  durationMs: number,
): void {
  if (!apiRequestBreakdownHistogram || !isPerformanceMonitoringEnabled) return;

  const attributes: Attributes = {
    ...getCommonAttributes(config),
    model,
    phase,
  };

  apiRequestBreakdownHistogram.record(durationMs, attributes);
}

export function recordPerformanceScore(
  config: Config,
  score: number,
  category: string,
  baseline?: number,
): void {
  if (!performanceScoreGauge || !isPerformanceMonitoringEnabled) return;

  const attributes: Attributes = {
    ...getCommonAttributes(config),
    category,
    baseline,
  };

  performanceScoreGauge.record(score, attributes);
}

export function recordPerformanceRegression(
  config: Config,
  metric: string,
  currentValue: number,
  baselineValue: number,
  severity: 'low' | 'medium' | 'high',
): void {
  if (
    !regressionDetectionCounter ||
    !baselineComparisonHistogram ||
    !isPerformanceMonitoringEnabled
  )
    return;

  const attributes: Attributes = {
    ...getCommonAttributes(config),
    metric,
    severity,
    current_value: currentValue,
    baseline_value: baselineValue,
  };

  regressionDetectionCounter.add(1, attributes);

  if (baselineValue !== 0) {
    const percentageChange =
      ((currentValue - baselineValue) / baselineValue) * 100;
    baselineComparisonHistogram.record(percentageChange, attributes);
  }
}

export function recordBaselineComparison(
  config: Config,
  metric: string,
  currentValue: number,
  baselineValue: number,
  category: string,
): void {
  if (!baselineComparisonHistogram || !isPerformanceMonitoringEnabled) return;

  if (baselineValue === 0) {
    console.warn('Baseline value is zero, skipping comparison.');
    return;
  }
  const percentageChange =
    ((currentValue - baselineValue) / baselineValue) * 100;

  const attributes: Attributes = {
    ...getCommonAttributes(config),
    metric,
    category,
    current_value: currentValue,
    baseline_value: baselineValue,
  };

  baselineComparisonHistogram.record(percentageChange, attributes);
}

// Utility function to check if performance monitoring is enabled
export function isPerformanceMonitoringActive(): boolean {
  return isPerformanceMonitoringEnabled && isMetricsInitialized;
}
