# Gemini CLI Observability Guide

Telemetry provides data about Gemini CLI's performance, health, and usage. By enabling it, you can monitor operations, debug issues, and optimize tool usage through traces, metrics, and structured logs.

Gemini CLI's telemetry system is built on the **[OpenTelemetry] (OTEL)** standard, allowing you to send data to any compatible backend.

[OpenTelemetry]: https://opentelemetry.io/

## Enabling telemetry

You can enable telemetry in multiple ways. Configuration is primarily managed via the [`.gemini/settings.json` file](./cli/configuration.md) and environment variables, but CLI flags can override these settings for a specific session.

### Order of precedence

The following lists the precedence for applying telemetry settings, with items listed higher having greater precedence:

1.  **CLI flags (for `gemini` command):**
    - `--telemetry` / `--no-telemetry`: Overrides `telemetry.enabled`.
    - `--telemetry-target <local|gcp>`: Overrides `telemetry.target`.
    - `--telemetry-otlp-endpoint <URL>`: Overrides `telemetry.otlpEndpoint`.
    - `--telemetry-log-prompts` / `--no-telemetry-log-prompts`: Overrides `telemetry.logPrompts`.

1.  **Environment variables:**
    - `OTEL_EXPORTER_OTLP_ENDPOINT`: Overrides `telemetry.otlpEndpoint`.

1.  **Workspace settings file (`.gemini/settings.json`):** Values from the `telemetry` object in this project-specific file.

1.  **User settings file (`~/.gemini/settings.json`):** Values from the `telemetry` object in this global user file.

1.  **Defaults:** applied if not set by any of the above.
    - `telemetry.enabled`: `false`
    - `telemetry.target`: `local`
    - `telemetry.otlpEndpoint`: `http://localhost:4317`
    - `telemetry.logPrompts`: `true`

**For the `npm run telemetry -- --target=<gcp|local>` script:**
The `--target` argument to this script _only_ overrides the `telemetry.target` for the duration and purpose of that script (i.e., choosing which collector to start). It does not permanently change your `settings.json`. The script will first look at `settings.json` for a `telemetry.target` to use as its default.

### Example settings

The following code can be added to your workspace (`.gemini/settings.json`) or user (`~/.gemini/settings.json`) settings to enable telemetry and send the output to Google Cloud:

```json
{
  "telemetry": {
    "enabled": true,
    "target": "gcp"
  },
  "sandbox": false
}
```

## Running an OTEL Collector

An OTEL Collector is a service that receives, processes, and exports telemetry data.
The CLI sends data using the OTLP/gRPC protocol.

Learn more about OTEL exporter standard configuration in [documentation][otel-config-docs].

[otel-config-docs]: https://opentelemetry.io/docs/languages/sdk-configuration/otlp-exporter/

### Local

Use the `npm run telemetry -- --target=local` command to automate the process of setting up a local telemetry pipeline, including configuring the necessary settings in your `.gemini/settings.json` file. The underlying script installs `otelcol-contrib` (the OpenTelemetry Collector) and `jaeger` (The Jaeger UI for viewing traces). To use it:

1.  **Run the command**:
    Execute the command from the root of the repository:

    ```bash
    npm run telemetry -- --target=local
    ```

    The script will:
    - Download Jaeger and OTEL if needed.
    - Start a local Jaeger instance.
    - Start an OTEL collector configured to receive data from Gemini CLI.
    - Automatically enable telemetry in your workspace settings.
    - On exit, disable telemetry.

1.  **View traces**:
    Open your web browser and navigate to **http://localhost:16686** to access the Jaeger UI. Here you can inspect detailed traces of Gemini CLI operations.

1.  **Inspect logs and metrics**:
    The script redirects the OTEL collector output (which includes logs and metrics) to `~/.gemini/tmp/<projectHash>/otel/collector.log`. The script will provide links to view and a command to tail your telemetry data (traces, metrics, logs) locally.

1.  **Stop the services**:
    Press `Ctrl+C` in the terminal where the script is running to stop the OTEL Collector and Jaeger services.

### Google Cloud

Use the `npm run telemetry -- --target=gcp` command to automate setting up a local OpenTelemetry collector that forwards data to your Google Cloud project, including configuring the necessary settings in your `.gemini/settings.json` file. The underlying script installs `otelcol-contrib`. To use it:

1.  **Prerequisites**:
    - Have a Google Cloud project ID.
    - Export the `GOOGLE_CLOUD_PROJECT` environment variable to make it available to the OTEL collector.
      ```bash
      export OTLP_GOOGLE_CLOUD_PROJECT="your-project-id"
      ```
    - Authenticate with Google Cloud (e.g., run `gcloud auth application-default login` or ensure `GOOGLE_APPLICATION_CREDENTIALS` is set).
    - Ensure your Google Cloud account/service account has the necessary IAM roles: "Cloud Trace Agent", "Monitoring Metric Writer", and "Logs Writer".

1.  **Run the command**:
    Execute the command from the root of the repository:

    ```bash
    npm run telemetry -- --target=gcp
    ```

    The script will:
    - Download the `otelcol-contrib` binary if needed.
    - Start an OTEL collector configured to receive data from Gemini CLI and export it to your specified Google Cloud project.
    - Automatically enable telemetry and disable sandbox mode in your workspace settings (`.gemini/settings.json`).
    - Provide direct links to view traces, metrics, and logs in your Google Cloud Console.
    - On exit (Ctrl+C), it will attempt to restore your original telemetry and sandbox settings.

1.  **Run Gemini CLI:**
    In a separate terminal, run your Gemini CLI commands. This generates telemetry data that the collector captures.

1.  **View telemetry in Google Cloud**:
    Use the links provided by the script to navigate to the Google Cloud Console and view your traces, metrics, and logs.

1.  **Inspect local collector logs**:
    The script redirects the local OTEL collector output to `~/.gemini/tmp/<projectHash>/otel/collector-gcp.log`. The script provides links to view and command to tail your collector logs locally.

1.  **Stop the service**:
    Press `Ctrl+C` in the terminal where the script is running to stop the OTEL Collector.

## Performance Monitoring

Gemini CLI includes comprehensive performance monitoring capabilities that provide insights into startup performance, memory usage, and operational efficiency. These features help identify performance bottlenecks and track system health over time.

### Memory Monitoring

The integrated MemoryMonitor system provides real-time memory tracking with automatic snapshots at key lifecycle points:

- **Startup snapshots**: Captures memory state during CLI initialization phases
- **Operation snapshots**: Monitors memory usage during tool execution and API calls
- **Component-specific monitoring**: Tracks memory usage by different CLI components
- **Growth analysis**: Identifies memory leaks and usage patterns over time

The memory monitor automatically tracks:

- **Heap Usage**: V8 JavaScript heap memory (used and total allocated)
- **External Memory**: Memory used by C++ objects bound to JavaScript
- **RSS (Resident Set Size)**: Physical memory currently used by the process
- **Array Buffers**: Memory used by ArrayBuffer objects

### Performance Scoring and Regression Detection

The performance monitoring system includes automated scoring and regression detection:

- **Baseline comparison**: Compares current performance against established baselines
- **Regression detection**: Automatically identifies performance degradations with configurable severity levels
- **Efficiency metrics**: Tracks token usage efficiency and API request optimization
- **Performance scoring**: Provides composite performance scores (0-100 scale) across different system components

### Startup Performance Analysis

Detailed startup timing analysis breaks down CLI initialization into measurable phases:

- **Settings loading**: Time to load and validate configuration files
- **Extension loading**: Time to discover and initialize CLI extensions
- **Service initialization**: Time to set up file, git, and authentication services
- **Authentication**: Time to validate and refresh authentication credentials
- **Sandbox setup**: Time to configure and enter sandbox environments (when enabled)

This granular timing data helps identify startup bottlenecks and track performance improvements over time.

## Logs and metric reference

The following section describes the structure of logs and metrics generated for Gemini CLI.

- A `sessionId` is included as a common attribute on all logs and metrics.

### Logs

Logs are timestamped records of specific events. The following events are logged for Gemini CLI:

- `gemini_cli.config`: This event occurs once at startup with the CLI's configuration.
  - **Attributes**:
    - `model` (string)
    - `embedding_model` (string)
    - `sandbox_enabled` (boolean)
    - `core_tools_enabled` (string)
    - `approval_mode` (string)
    - `api_key_enabled` (boolean)
    - `vertex_ai_enabled` (boolean)
    - `code_assist_enabled` (boolean)
    - `log_prompts_enabled` (boolean)
    - `file_filtering_respect_git_ignore` (boolean)
    - `debug_mode` (boolean)
    - `mcp_servers` (string)

- `gemini_cli.user_prompt`: This event occurs when a user submits a prompt.
  - **Attributes**:
    - `prompt_length`
    - `prompt` (this attribute is excluded if `log_prompts_enabled` is configured to be `false`)

- `gemini_cli.tool_call`: This event occurs for each function call.
  - **Attributes**:
    - `function_name`
    - `function_args`
    - `duration_ms`
    - `success` (boolean)
    - `decision` (string: "accept", "reject", or "modify", if applicable)
    - `error` (if applicable)
    - `error_type` (if applicable)

- `gemini_cli.api_request`: This event occurs when making a request to Gemini API.
  - **Attributes**:
    - `model`
    - `request_text` (if applicable)

- `gemini_cli.api_error`: This event occurs if the API request fails.
  - **Attributes**:
    - `model`
    - `error`
    - `error_type`
    - `status_code`
    - `duration_ms`

- `gemini_cli.api_response`: This event occurs upon receiving a response from Gemini API.
  - **Attributes**:
    - `model`
    - `status_code`
    - `duration_ms`
    - `error` (optional)
    - `input_token_count`
    - `output_token_count`
    - `cached_content_token_count`
    - `thoughts_token_count`
    - `tool_token_count`
    - `response_text` (if applicable)

- `gemini_cli.startup.performance`: This event occurs during CLI startup with detailed performance metrics.
  - **Attributes**:
    - `phase` (string): Specific startup phase (settings_loading, config_loading, authentication, etc.)
    - `startup_duration_ms` (number): Duration of the startup phase
    - `auth_type` (string): Authentication method used (if applicable)
    - `telemetry_enabled` (boolean): Whether telemetry was enabled during startup
    - `settings_sources` (number): Number of settings sources processed (if applicable)
    - `errors_count` (number): Number of errors encountered during phase (if applicable)
    - `extensions_count` (number): Number of extensions loaded (if applicable)
    - `theme_name` (string): Theme name loaded (if applicable)
    - `sandbox_command` (string): Sandbox command executed (if applicable)
    - `is_tty` (boolean): Whether running in TTY mode (if applicable)
    - `has_question` (boolean): Whether input question was provided (if applicable)

- `gemini_cli.memory.usage`: This event occurs during memory monitoring snapshots.
  - **Attributes**:
    - `context` (string): Context that triggered the memory snapshot
    - `heap_used_mb` (number): V8 heap memory in use (megabytes)
    - `heap_total_mb` (number): Total V8 heap allocated (megabytes)
    - `rss_mb` (number): Resident Set Size (megabytes)
    - `external_mb` (number): External memory usage (megabytes)
    - `array_buffers_mb` (number): Array buffer memory usage (megabytes)
    - `heap_size_limit_mb` (number): V8 heap size limit (megabytes)

- `gemini_cli.performance.baseline`: This event occurs when establishing performance baselines.
  - **Attributes**:
    - `metric_type` (string): Type of performance metric being baselined
    - `baseline_value` (number): Established baseline value
    - `confidence_level` (number): Statistical confidence in baseline
    - `component` (string): Component being monitored

- `gemini_cli.performance.regression`: This event occurs when performance regression is detected.
  - **Attributes**:
    - `metric_type` (string): Type of performance metric that regressed
    - `current_value` (number): Current performance value
    - `baseline_value` (number): Expected baseline value
    - `regression_percentage` (number): Percentage of performance degradation
    - `severity` (string): Regression severity level (low, medium, high)
    - `component` (string): Component experiencing regression

### Metrics

Metrics are numerical measurements of behavior over time. The following metrics are collected for Gemini CLI:

- `gemini_cli.session.count` (Counter, Int): Incremented once per CLI startup.

- `gemini_cli.tool.call.count` (Counter, Int): Counts tool calls.
  - **Attributes**:
    - `function_name`
    - `success` (boolean)
    - `decision` (string: "accept", "reject", or "modify", if applicable)

- `gemini_cli.tool.call.latency` (Histogram, ms): Measures tool call latency.
  - **Attributes**:
    - `function_name`
    - `decision` (string: "accept", "reject", or "modify", if applicable)

- `gemini_cli.api.request.count` (Counter, Int): Counts all API requests.
  - **Attributes**:
    - `model`
    - `status_code`
    - `error_type` (if applicable)

- `gemini_cli.api.request.latency` (Histogram, ms): Measures API request latency.
  - **Attributes**:
    - `model`

- `gemini_cli.token.usage` (Counter, Int): Counts the number of tokens used.
  - **Attributes**:
    - `model`
    - `type` (string: "input", "output", "thought", "cache", or "tool")

- `gemini_cli.file.operation.count` (Counter, Int): Counts file operations.
  - **Attributes**:
    - `operation` (string: "create", "read", "update"): The type of file operation.
    - `lines` (Int, if applicable): Number of lines in the file.
    - `mimetype` (string, if applicable): Mimetype of the file.
    - `extension` (string, if applicable): File extension of the file.

- `gemini_cli.startup.duration` (Histogram, ms): Measures CLI startup time with phase breakdown.
  - **Attributes**:
    - `phase` (string): Specific startup phase (settings_loading, config_loading, authentication, etc.)
    - `auth_type` (string): Authentication method used (if applicable)
    - `telemetry_enabled` (boolean): Whether telemetry was enabled during startup
    - `settings_sources` (number): Number of settings sources processed (if applicable)
    - `errors_count` (number): Number of errors encountered during phase (if applicable)
    - `extensions_count` (number): Number of extensions loaded (if applicable)
    - `theme_name` (string): Theme name loaded (if applicable)
    - `sandbox_command` (string): Sandbox command executed (if applicable)
    - `is_tty` (boolean): Whether running in TTY mode (if applicable)
    - `has_question` (boolean): Whether input question was provided (if applicable)

- `gemini_cli.memory.usage` (Histogram, bytes): General memory usage measurement.
  - **Attributes**:
    - `component` (string): CLI component being monitored
    - `memory_type` (string): Type of memory metric (general usage)

- `gemini_cli.memory.heap.used` (Histogram, bytes): V8 heap memory currently in use.
  - **Attributes**:
    - `component` (string): CLI component being monitored
    - `memory_type` (string): "heap_used"

- `gemini_cli.memory.heap.total` (Histogram, bytes): Total V8 heap memory allocated.
  - **Attributes**:
    - `component` (string): CLI component being monitored
    - `memory_type` (string): "heap_total"

- `gemini_cli.memory.external` (Histogram, bytes): Memory usage of C++ objects bound to JavaScript.
  - **Attributes**:
    - `component` (string): CLI component being monitored
    - `memory_type` (string): "external"

- `gemini_cli.memory.rss` (Histogram, bytes): Resident Set Size - physical memory currently used.
  - **Attributes**:
    - `component` (string): CLI component being monitored
    - `memory_type` (string): "rss"

- `gemini_cli.cpu.usage` (Histogram, percent): CPU usage percentage by component.
  - **Attributes**:
    - `component` (string): CLI component being monitored

- `gemini_cli.tool.queue.depth` (Histogram, Int): Number of tool calls waiting in execution queue.

- `gemini_cli.tool.execution.breakdown` (Histogram, ms): Detailed timing of tool execution phases.
  - **Attributes**:
    - `function_name` (string): Name of the tool being executed
    - `phase` (string): Execution phase (validation, preparation, execution, result_processing)

- `gemini_cli.token.efficiency` (Histogram, double): Token efficiency metrics including ratios and cache hit rates.
  - **Attributes**:
    - `model` (string): Gemini model used
    - `metric` (string): Type of efficiency metric being measured
    - `context` (string): Context for the efficiency measurement

- `gemini_cli.api.request.breakdown` (Histogram, ms): Detailed API request timing by processing phase.
  - **Attributes**:
    - `model` (string): Gemini model used
    - `phase` (string): Request phase (request_preparation, network_latency, response_processing, token_processing)

- `gemini_cli.performance.score` (Histogram, double): Overall performance score (0-100 scale).
  - **Attributes**:
    - `category` (string): Performance category being scored
    - `baseline` (number): Baseline value for comparison (if applicable)

- `gemini_cli.performance.regression` (Counter, Int): Count of detected performance regressions.
  - **Attributes**:
    - `metric` (string): Performance metric that regressed
    - `severity` (string): Regression severity level (low, medium, high)
    - `current_value` (number): Current performance value
    - `baseline_value` (number): Expected baseline value

- `gemini_cli.performance.baseline.comparison` (Histogram, percent): Performance comparison to established baseline (percentage change).
  - **Attributes**:
    - `metric` (string): Type of performance metric being compared
    - `category` (string): Performance category
    - `current_value` (number): Current performance value
    - `baseline_value` (number): Baseline performance value
