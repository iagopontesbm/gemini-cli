#!/usr/bin/env node
import path from 'path';
import fs from 'fs';
import net from 'net';
import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const GEMINI_DIR = path.join(ROOT_DIR, '.gemini');
const OTEL_DIR = path.join(GEMINI_DIR, 'otel');
const OTEL_CONFIG_FILE = path.join(OTEL_DIR, 'collector-local.yaml');
const OTEL_LOG_FILE = path.join(OTEL_DIR, 'collector.log');
const JAEGER_LOG_FILE = path.join(OTEL_DIR, 'jaeger.log');
const JAEGER_PORT = 16686;
const WORKSPACE_SETTINGS_FILE = path.join(GEMINI_DIR, 'settings.json');
const USER_SETTINGS_FILE = path.join(
  process.env.HOME,
  '.gemini',
  'settings.json',
);

// This configuration is for the primary otelcol-contrib instance.
// It receives from the CLI on 4317, exports traces to Jaeger on 14317,
// and sends metrics/logs to the debug log.
const OTEL_CONFIG_CONTENT = `
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: "localhost:4317"
processors:
  batch:
    timeout: 1s
exporters:
  otlp:
    endpoint: "localhost:14317"
    tls:
      insecure: true
  debug:
    verbosity: detailed
service:
  telemetry:
    logs:
      level: "debug"
    metrics:
      level: "none"
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp]
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [debug]
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [debug]
`;

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function readJsonFile(filePath) {
  if (!fileExists(filePath)) {
    return {};
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function checkForBinary(binaryName) {
  try {
    execSync(`which ${binaryName}`, { stdio: 'ignore' });
    return true;
  } catch (error) {
    console.error(
      `🛑 Error: ${binaryName} not found in your PATH. Please install it.`,
    );
    return false;
  }
}

function waitForPort(port, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const tryConnect = () => {
      const socket = new net.Socket();
      socket.once('connect', () => {
        socket.end();
        resolve();
      });
      socket.once('error', (err) => {
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for port ${port} to open.`));
        } else {
          setTimeout(tryConnect, 500);
        }
      });
      socket.connect(port, 'localhost');
    };
    tryConnect();
  });
}

async function main() {
  // 1. Check for required binaries
  if (!checkForBinary('otelcol-contrib')) process.exit(1);
  if (!checkForBinary('jaeger')) process.exit(1);

  // 2. Kill any existing processes to ensure a clean start.
  console.log('🧹 Cleaning up old processes and logs...');
  try {
    execSync('pkill -f "otelcol-contrib"');
    console.log('✅ Stopped existing otelcol-contrib process.');
  } catch (e) {} // eslint-disable-line no-empty
  try {
    execSync('pkill -f "jaeger"');
    console.log('✅ Stopped existing jaeger process.');
  } catch (e) {} // eslint-disable-line no-empty
  try {
    fs.unlinkSync(OTEL_LOG_FILE);
    console.log('✅ Deleted old collector log.');
  } catch (e) {
    if (e.code !== 'ENOENT') console.error(e);
  }
  try {
    fs.unlinkSync(JAEGER_LOG_FILE);
    console.log('✅ Deleted old jaeger log.');
  } catch (e) {
    if (e.code !== 'ENOENT') console.error(e);
  }

  let jaegerProcess, collectorProcess;
  let jaegerLogFd, collectorLogFd;

  const cleanup = () => {
    console.log('\n👋 Shutting down...');
    [jaegerProcess, collectorProcess].forEach((proc) => {
      if (proc && proc.pid) {
        try {
          console.log(`🛑 Stopping ${proc.spawnargs[0]} (PID: ${proc.pid})...`);
          // Use SIGTERM for a graceful shutdown
          process.kill(proc.pid, 'SIGTERM');
          console.log(`✅ ${proc.spawnargs[0]} stopped.`);
        } catch (e) {
          // It's okay if the process is already gone.
          if (e.code !== 'ESRCH')
            console.error(`Error stopping ${proc.spawnargs[0]}: ${e.message}`);
        }
      }
    });
    [jaegerLogFd, collectorLogFd].forEach((fd) => {
      if (fd)
        try {
          fs.closeSync(fd);
        } catch (e) {} // eslint-disable-line no-empty
    });
  };

  process.on('exit', cleanup);
  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
  });

  if (!fileExists(OTEL_DIR)) fs.mkdirSync(OTEL_DIR, { recursive: true });
  fs.writeFileSync(OTEL_CONFIG_FILE, OTEL_CONFIG_CONTENT);
  console.log('📄 Wrote OTEL collector config.');

  const workspaceSettings = readJsonFile(WORKSPACE_SETTINGS_FILE);
  let settingsModified = false;

  if (workspaceSettings.telemetry !== true) {
    workspaceSettings.telemetry = true;
    settingsModified = true;
    console.log('⚙️  Enabled telemetry in workspace settings.');
  }

  if (workspaceSettings.sandbox !== false) {
    workspaceSettings.sandbox = false;
    settingsModified = true;
    console.log('✅ Disabled sandbox mode for telemetry.');
  }

  if (workspaceSettings.telemetryOtlpEndpoint !== 'http://localhost:4317') {
    workspaceSettings.telemetryOtlpEndpoint = 'http://localhost:4317';
    settingsModified = true;
    console.log('🔧 Set telemetry endpoint to http://localhost:4317.');
  }

  if (settingsModified) {
    writeJsonFile(WORKSPACE_SETTINGS_FILE, workspaceSettings);
    console.log('✅ Workspace settings updated.');
  } else {
    console.log('✅ Telemetry is already configured correctly.');
  }

  // Start Jaeger
  console.log(`🚀 Starting Jaeger service... Logs: ${JAEGER_LOG_FILE}`);
  jaegerLogFd = fs.openSync(JAEGER_LOG_FILE, 'a');
  // The collector is on 4317, so we move jaeger to 14317.
  jaegerProcess = spawn(
    'jaeger',
    ['--set=receivers.otlp.protocols.grpc.endpoint=localhost:14317'],
    { stdio: ['ignore', jaegerLogFd, jaegerLogFd] },
  );
  console.log(`⏳ Waiting for Jaeger to start (PID: ${jaegerProcess.pid})...`);

  try {
    await waitForPort(JAEGER_PORT);
    console.log(
      `✅ Jaeger started successfully. UI: http://localhost:${JAEGER_PORT}`,
    );
  } catch (error) {
    console.error(`🛑 Error: Jaeger failed to start on port ${JAEGER_PORT}.`);
    if (jaegerProcess && jaegerProcess.pid) {
      process.kill(jaegerProcess.pid, 'SIGKILL');
    }
    if (fileExists(JAEGER_LOG_FILE)) {
      console.error('📄 Jaeger Log Output:');
      console.error(fs.readFileSync(JAEGER_LOG_FILE, 'utf-8'));
    }
    process.exit(1);
  }

  // Start the primary OTEL collector
  console.log(`🚀 Starting OTEL collector... Logs: ${OTEL_LOG_FILE}`);
  collectorLogFd = fs.openSync(OTEL_LOG_FILE, 'a');
  collectorProcess = spawn('otelcol-contrib', ['--config', OTEL_CONFIG_FILE], {
    stdio: ['ignore', collectorLogFd, collectorLogFd],
  });
  console.log(
    `⏳ Waiting for OTEL collector to start (PID: ${collectorProcess.pid})...`,
  );

  try {
    await waitForPort(4317);
    console.log(`✅ OTEL collector started successfully.`);
  } catch (error) {
    console.error(`🛑 Error: OTEL collector failed to start on port 4317.`);
    if (collectorProcess && collectorProcess.pid) {
      process.kill(collectorProcess.pid, 'SIGKILL');
    }
    if (fileExists(OTEL_LOG_FILE)) {
      console.error('📄 OTEL Collector Log Output:');
      console.error(fs.readFileSync(OTEL_LOG_FILE, 'utf-8'));
    }
    process.exit(1);
  }

  [jaegerProcess, collectorProcess].forEach((proc) => {
    proc.on('error', (err) => {
      console.error(`${proc.spawnargs[0]} process error:`, err);
      process.exit(1);
    });
  });

  console.log(
    '\n✨ Local telemetry environment is running. Press Ctrl+C to exit.',
  );
}

main();
